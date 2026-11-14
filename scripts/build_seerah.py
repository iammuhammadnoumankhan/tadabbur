#!/usr/bin/env python3
"""
Build the Seerah timeline for Tadabbur from Sahih al-Bukhari only.

- The 23-year frame and the few dated moments come from hadith whose own text
  states the time (checked below: the build fails if the text doesn't say it).
- Every other event is a chapter cluster of Bukhari, given by its hadith-number
  range. Events are listed in the order Imam al-Bukhari arranged them, which is
  mostly but not strictly chronological. We assign no years of our own.
- Ayahs linked to an event are only those that its hadith texts cite explicitly.

Run after scripts/build_data.py (uses its hadith cache).
Output: data/seerah.json (index) + data/seerah/<id>.json (hadith texts)
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "hadith")

# ---------------------------------------------------------------- dated anchors
# (id, hadith, phrases that MUST appear in the English text, year since first revelation, how it's computed)
ANCHORS = [
    ("revelation", 3902, ["age of forty"], 0,
     "Start of revelation, at the age of forty (Bukhari 3902)."),
    ("khadija", 3896, ["three years before"], 10,
     "Khadija died three years before the migration (Bukhari 3896): 13 − 3 = year 10."),
    ("hijrah", 3902, ["thirteen years", "ordered to migrate"], 13,
     "He stayed in Makkah thirteen years, then was ordered to migrate (Bukhari 3902)."),
    ("conquest", 4276, ["eight and a half years after his migration"], 21.5,
     "Left for Makkah eight and a half years after the migration (Bukhari 4276): 13 + 8.5 = year 21.5."),
    ("death", 3902, ["ten years", "sixty-three"], 23,
     "Lived as an emigrant ten years and died at sixty-three (Bukhari 3902): 13 + 10 = year 23."),
]

# ---------------------------------------------------------------- events = Bukhari chapter clusters
# id, English name, Urdu name, period, [first, last] hadith numbers, optional regex to keep only hadith that mention it
EVENTS = [
    ("revelation", "Beginning of revelation in the cave of Hira", "غارِ حرا میں وحی کا آغاز", "makkah", (3, 4), None),
    ("abyssinia", "Migration to Abyssinia", "ہجرتِ حبشہ", "makkah", (3872, 3881), None),
    ("isra", "Al-Isra and Al-Mi'raj (the Night Journey)", "اسراء و معراج", "makkah", (3886, 3888), None),
    ("aqaba", "Pledges of al-Aqaba with the Ansar", "بیعتِ عقبہ", "makkah", (3889, 3893), None),
    ("khadija", "Death of Khadija", "حضرت خدیجہؓ کی وفات", "makkah", (3896, 3896), None),
    ("hijrah", "The Hijrah to Madinah", "ہجرتِ مدینہ", "makkah", (3905, 3925), r"migrat|Thaur|cave|Medina|emigrat"),
    ("badr", "Battle of Badr", "غزوۂ بدر", "madinah", (3949, 4027), r"\bBadr\b"),
    ("nadir", "Banu an-Nadir", "بنو نضیر", "madinah", (4028, 4034), None),
    ("uhud", "Battle of Uhud", "غزوۂ اُحد", "madinah", (4035, 4085), r"\bUhud\b"),
    ("raji", "Ar-Raji' and Bi'r Ma'una", "رجیع و بئرِ معونہ", "madinah", (4086, 4096), None),
    ("khandaq", "Battle of the Trench (al-Ahzab)", "غزوۂ خندق (احزاب)", "madinah", (4097, 4116), None),
    ("quraiza", "Banu Quraiza", "بنو قریظہ", "madinah", (4117, 4124), None),
    ("mustaliq", "Banu al-Mustaliq and the incident of al-Ifk", "غزوۂ بنی المصطلق اور واقعۂ افک", "madinah", (4138, 4143), None),
    ("hudaibiya", "Treaty of al-Hudaibiya", "صلحِ حدیبیہ", "madinah", (4147, 4191), None),
    ("khaibar", "Khaibar", "غزوۂ خیبر", "madinah", (4195, 4249), None),
    ("qada", "'Umrat al-Qada", "عمرۃ القضاء", "madinah", (4251, 4259), None),
    ("mutah", "Mu'tah", "غزوۂ موتہ", "madinah", (4260, 4268), None),
    ("conquest", "Conquest of Makkah", "فتحِ مکہ", "madinah", (4274, 4313), None),
    ("hunain", "Hunain", "غزوۂ حنین", "madinah", (4314, 4323), None),
    ("taif", "Siege of at-Ta'if", "محاصرۂ طائف", "madinah", (4324, 4327), None),
    ("delegations", "Delegations to the Prophet ﷺ", "وفود کی آمد", "madinah", (4365, 4394), None),
    ("wada", "The Farewell Hajj", "حجۃ الوداع", "madinah", (4395, 4414), None),
    ("tabuk", "Tabuk", "غزوۂ تبوک", "madinah", (4415, 4427), None),
    ("death", "Illness and death of the Prophet ﷺ", "نبی ﷺ کی بیماری اور وفات", "madinah", (4428, 4473), None),
]

REF = re.compile(r"\(\s*(?:V\.\s*)?(\d{1,3})\s*[.:]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\)")


def load(name):
    with open(os.path.join(CACHE, name), encoding="utf-8") as f:
        return {h["hadithnumber"]: h for h in json.load(f)["hadiths"]}


def main():
    eng, urd, ara = load("eng-bukhari.json"), load("urd-bukhari.json"), load("ara-bukhari.json")
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    counts = {c["n"]: c["ayahs"] for c in chapters}

    anchors = []
    for aid, num, must, year, how in ANCHORS:
        t = eng[num]["text"]
        for m in must:
            assert m in t, f"anchor {aid}: Bukhari {num} no longer contains {m!r}"
        anchors.append({"id": aid, "year": year, "hadith": num, "how": how,
                        "url": f"https://sunnah.com/bukhari:{num}"})

    os.makedirs(os.path.join(DATA, "seerah"), exist_ok=True)
    index = []
    for order, (eid, en, ur, period, (a, b), pat) in enumerate(EVENTS, 1):
        nums = [n for n in range(a, b + 1) if n in eng and (not pat or re.search(pat, eng[n]["text"] or "", re.I))]
        assert nums, eid
        refs = set()
        recs = []
        for n in nums:
            r = set()
            for m in REF.finditer(eng[n]["text"] or ""):
                s, x, y = int(m.group(1)), int(m.group(2)), m.group(3)
                y = int(y) if y else x
                if 1 <= s <= 114 and 1 <= x <= y <= counts[s] and y - x < 40:
                    r |= {f"{s}:{k}" for k in range(x, y + 1)}
            refs |= r
            recs.append({"num": n, "en": eng[n]["text"], "ur": (urd.get(n) or {}).get("text"),
                         "ar": (ara.get(n) or {}).get("text"), "refs": sorted(r),
                         "url": f"https://sunnah.com/bukhari:{n}"})
        with open(os.path.join(DATA, "seerah", f"{eid}.json"), "w", encoding="utf-8") as f:
            json.dump(recs, f, ensure_ascii=False, separators=(",", ":"))
        anchor = next((x for x in anchors if x["id"] == eid), None)
        index.append({
            "id": eid, "order": order, "name": {"en": en, "ur": ur}, "period": period,
            "range": [a, b], "count": len(nums), "first": nums[0],
            "refs": sorted(refs, key=lambda k: tuple(map(int, k.split(":")))),
            "surahs": sorted({int(k.split(":")[0]) for k in refs}),
            "year": anchor["year"] if anchor else None,
        })
    out = {
        "src": "sahih-hadith-text",
        "frame": {"years": 23, "makkah": 13, "madinah": 10, "hadith": 3902,
                  "text": eng[3902]["text"], "ur": urd[3902]["text"], "url": "https://sunnah.com/bukhari:3902"},
        "anchors": anchors,
        "events": index,
        "note": ("Events follow the order of Imam al-Bukhari's chapters (Book 1 'Revelation', Book 63 'Merits of the Ansar', "
                 "Book 64 'Al-Maghazi'). That arrangement is mostly but not strictly chronological. Only the moments marked "
                 "with a year are dated, each by a hadith that states the time."),
    }
    with open(os.path.join(DATA, "seerah.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    # surah -> events, for the surah page
    by_surah = {}
    for e in index:
        for s in e["surahs"]:
            by_surah.setdefault(s, []).append(e["id"])
    with open(os.path.join(DATA, "seerah-by-surah.json"), "w", encoding="utf-8") as f:
        json.dump(by_surah, f, separators=(",", ":"))
    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    import datetime
    s["seerah-timeline"] = {
        "title": "Seerah timeline (events and dated moments)",
        "publisher": "Sahih al-Bukhari, via fawazahmed0/hadith-api",
        "url": "https://sunnah.com/bukhari",
        "note": ("23-year frame from Bukhari 3902. Dated moments only where a hadith states the time: "
                 + " ".join(a["how"] for a in anchors) + " " + out["note"]
                 + " Each event lists the hadith of its Bukhari chapter (hadith-number range shown)."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    print("\n".join(f"{e['order']:2} {e['id']:12} {e['count']:3} hadith  {len(e['refs']):3} ayahs  surahs {e['surahs'][:8]}" for e in index))


if __name__ == "__main__":
    main()
