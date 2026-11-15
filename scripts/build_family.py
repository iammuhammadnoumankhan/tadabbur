#!/usr/bin/env python3
"""
Build the prophets' family links for Tadabbur, using ONLY relations the Quranic Arabic Corpus
ontology states in its knowledge base: (son-of X Y), (daughter-of X Y), (adopted-son-of X Y).

Starting from every prophet in data/stories.json, it follows those relations to relatives
(e.g. Azar, Maryam, Imran) and records names (English + Arabic) as the ontology gives them.
Nothing is inferred (no siblings or grandparents are added): the page draws what is stated.

On top of the ontology, EVIDENCED adds links that an ayah or a Sahih hadith states itself
(approved by the project owner on 2026-11-15; see docs/FAMILY_CANDIDATES.md). Each carries its
evidence, and the build asserts the evidence text is really there: the Arabic wording of the hadith
in our copy of Bukhari/Muslim, or the ayah's wording in Saheeh International.

Output: data/family.json -> { src, people: {id: {en, ar, prophet}}, links: [[rel, child, parent], …] }
Run after build_stories.py.
"""
import datetime, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_stories import get, text, mentions  # noqa: E402  (same cached, polite fetching)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FAMILY = ("son-of", "daughter-of", "adopted-son-of")
HADITH_CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "hadith")

# New people (names as written in the evidence's Arabic text).
EXTRA_PEOPLE = {
    "ibrahim-son-of-muhammad": {"en": "Ibrahim", "ar": "إبراهيم"},
    "fatimah": {"en": "Fatimah", "ar": "فاطمة"},
    "zainab": {"en": "Zainab", "ar": "زينب"},
    "umamah": {"en": "Umamah", "ar": "أمامة"},
    "abdullah": {"en": "Abdullah", "ar": "عبد الله"},
    "abbas": {"en": "Al-Abbas", "ar": "العباس"},
    "abu-talib": {"en": "Abu Talib", "ar": "أبو طالب"},
    "abdul-muttalib": {"en": "Abdul-Muttalib", "ar": "عبد المطلب"},
}
# (rel, a, b): "a rel b". Evidence: ("ayah", key, English words in Saheeh International)
#                                   or (collection, our hadith number, [Arabic phrases, harakat removed]).
EVIDENCED = [
    (("brother-of", "harun", "musa"), [("ayah", "20:30", "Aaron, my brother"), ("ayah", "19:53", "his brother Aaron"),
                                        ("ayah", "28:34", "my brother Aaron"), ("ayah", "20:94", "O son of my mother")]),
    (("son-of", "ibrahim-son-of-muhammad", "muhammad"), [("muslim", 6025, ["ولد لي الليلة غلام فسميته باسم أبي إبراهيم"]),
                                                         ("bukhari", 1063, ["أن ابنا للنبي صلى الله عليه وسلم مات، يقال له إبراهيم"])]),
    (("daughter-of", "fatimah", "muhammad"), [("bukhari", 3092, ["فاطمة ـ عليها السلام ـ ابنة رسول الله"]),
                                              ("muslim", 4580, ["فاطمة بنت رسول الله"])]),
    (("daughter-of", "zainab", "muhammad"), [("bukhari", 516, ["أمامة بنت زينب بنت رسول الله"]),
                                             ("muslim", 2173, ["لما ماتت زينب بنت رسول الله"])]),
    (("daughter-of", "umamah", "zainab"), [("bukhari", 516, ["أمامة بنت زينب بنت رسول الله"])]),
    (("son-of", "muhammad", "abdullah"), [("bukhari", 2699, ["أنا رسول الله وأنا محمد بن عبد الله"])]),
    (("uncle-of", "abbas", "muhammad"), [("bukhari", 1468, ["العباس بن عبد المطلب فعم رسول الله"])]),
    (("uncle-of", "abu-talib", "muhammad"), [("bukhari", 3884, ["أن أبا طالب، لما حضرته الوفاة دخل عليه النبي", "أى عم"])]),
    (("descendant-of", "muhammad", "abdul-muttalib"), [("bukhari", 2864, ["أنا النبي لا كذب أنا ابن عبد المطلب"])]),
]
HARAKAT = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")


def evidence_records():
    from build_data import sunnah_url
    cols = {}
    def col(c):
        if c not in cols:
            ara = json.load(open(os.path.join(HADITH_CACHE, f"ara-{c}.json"), encoding="utf-8"))["hadiths"]
            eng = json.load(open(os.path.join(HADITH_CACHE, f"eng-{c}.json"), encoding="utf-8"))["hadiths"]
            cols[c] = ({h["hadithnumber"]: HARAKAT.sub("", h["text"]) for h in ara}, {h["hadithnumber"]: h for h in eng})
        return cols[c]
    out = []
    for (rel, a, b), evs in EVIDENCED:
        recs = []
        for ev in evs:
            if ev[0] == "ayah":
                _, key, words = ev
                s_, a_ = map(int, key.split(":"))
                text = json.load(open(os.path.join(DATA, "tr", "20", f"{s_:03d}.json"), encoding="utf-8"))[a_ - 1]
                assert words in text, f"{key}: '{words}' not in Saheeh International"
                recs.append({"type": "ayah", "key": key, "quote": words})
            else:
                c, num, phrases = ev
                ar, en = col(c)
                for ph in phrases:
                    assert ph in ar[num], f"{c} {num}: Arabic phrase not found: {ph}"
                h = en[num]
                label = str(int(num)) if c == "bukhari" else str(h.get("arabicnumber", num)).split(".")[0]
                recs.append({"type": "hadith", "c": c, "num": label, "url": sunnah_url(c, h), "quote": phrases[0]})
        out.append({"rel": rel, "a": a, "b": b, "evidence": recs})
    return out
REL = re.compile(r"\(([a-z-]+) ([a-z-]+) ([a-z-]+) \)")


def concept(cid):
    raw = get(f"/concept.jsp?id={cid}", f"concept_{cid}.html")
    t = text(raw)
    m = re.search(r"<title>\s*(.*?)\s+-\s+Ontology", raw)
    en = html.unescape(m.group(1)).strip() if m else cid
    ar = re.search(rf"{re.escape(en)} \(\s*([^)]+?)\s*\)", t)
    rels = [r for r in REL.findall(t) if r[0] in FAMILY]
    return en, (ar.group(1) if ar else ""), rels


def main():
    st = json.load(open(os.path.join(DATA, "stories.json"), encoding="utf-8"))
    prophets = {p["id"]: p for p in st["prophets"]}
    people, links = {}, set()
    todo, seen = list(prophets), set()
    while todo:
        cid = todo.pop()
        if cid in seen:
            continue
        seen.add(cid)
        en, ar, rels = concept(cid)
        p = prophets.get(cid)
        people[cid] = {"en": p["en"] if p else en, "ar": p["ar"] if p else ar, "prophet": bool(p), "concept": True}
        if not p:                                         # prophets' ayahs are in stories.json; relatives' come from here
            people[cid]["ayahs"] = sorted({f"{s}:{a}" for s, a, w in mentions(cid)}, key=lambda k: tuple(map(int, k.split(":"))))
        for rel, a, b in rels:
            if cid not in (a, b):
                continue                                  # only relations about this person
            links.add((rel, a, b))
            for other in (a, b):
                if other not in seen:
                    todo.append(other)
    for pid, v in EXTRA_PEOPLE.items():
        assert pid not in people, pid
        people[pid] = {**v, "prophet": False}
    evidenced = evidence_records()
    for e in evidenced:
        assert e["a"] in people and e["b"] in people, e
        assert (e["rel"], e["a"], e["b"]) not in links, e
    out = {"src": ["qac-ontology", "sahih-hadith-text", "qc-tr-20"], "people": dict(sorted(people.items())),
           "links": sorted(list(l) for l in links), "evidenced": evidenced}
    with open(os.path.join(DATA, "family.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qac-ontology"]["note"] = s["qac-ontology"]["note"].split(" Family links:")[0] + (
        f" Family links: only the ontology's stated son-of / daughter-of / adopted-son-of relations "
        f"({len(out['links'])} links); nothing is inferred. A further {len(evidenced)} links are added only where an ayah or a "
        f"Sahih hadith states the relation (Arabic text checked by the build), each shown with its evidence.")
    s["qac-ontology"]["fetched"] = datetime.date.today().isoformat()
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    for l in out["links"]:
        print(f"  {people[l[1]]['en']} — {l[0]} — {people[l[2]]['en']}")
    for e in evidenced:
        print(f"  + {people[e['a']]['en']} — {e['rel']} — {people[e['b']]['en']}  "
              + ", ".join(x["key"] if x["type"] == "ayah" else f"{x['c']} {x['num']}" for x in e["evidence"]))
    print(f"{len(out['links'])} ontology links + {len(evidenced)} evidenced, {len(people)} people")


if __name__ == "__main__":
    main()
