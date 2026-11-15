#!/usr/bin/env python3
"""
Tadabbur data builder.

Downloads Quran text, translations, word-by-word meanings, surah introductions
and Sahih hadith from established public sources, then writes small static JSON
files into /data. Every piece of content is tagged with a source id that is
described in data/sources.json.

NOTHING here is authored by us: this script only fetches, re-shapes and indexes.

Usage:  python3 scripts/build_data.py            (uses .cache/ for raw downloads)
"""
import json, os, re, sys, time, html, hashlib, datetime, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache")
QC = "https://api.quran.com/api/v4"
HADITH_CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions"
TODAY = datetime.date.today().isoformat()
UA = {"User-Agent": "tadabbur-data-builder/1.0"}

# Translations offered to readers (Quran.com resource ids). Every variant the
# public API offers for Urdu & English is included; the reader chooses.
TRANSLATIONS = {
    # Urdu
    234: ("ur", "Fateh Muhammad Jalandhari"),
    54:  ("ur", "Maulana Muhammad Junagarhi"),
    97:  ("ur", "Syed Abul A'la Maududi — Tafheem-ul-Quran"),
    158: ("ur", "Dr. Israr Ahmad — Bayan-ul-Quran"),
    151: ("ur", "Shaykh al-Hind Mahmud al-Hasan (Tafsir-e-Usmani)"),
    819: ("ur", "Maulana Wahiduddin Khan"),
    156: ("ur", "Fi Zilal al-Quran — Sayyid Qutb (Urdu)"),
    831: ("ur-Latn", "Abul A'la Maududi — Roman Urdu"),
    # English
    20:  ("en", "Saheeh International"),
    84:  ("en", "Mufti Taqi Usmani"),
    85:  ("en", "M.A.S. Abdel Haleem"),
    95:  ("en", "Abul A'la Maududi (Tafhim commentary)"),
    203: ("en", "Al-Hilali & Muhsin Khan"),
    19:  ("en", "Mohammed Marmaduke Pickthall"),
    22:  ("en", "Abdullah Yusuf Ali"),
    149: ("en", "Fadel Soliman — Bridges' translation"),
}
DEFAULT_TRANSLATIONS = [234, 20]

# Tafsirs (Quran.com resource ids) offered in Urdu and English.
TAFSIRS = {
    160: ("ur", "Tafsir Ibn Kathir (Urdu)"),
    159: ("ur", "Bayan ul Quran — Dr. Israr Ahmad"),
    818: ("ur", "Tazkir ul Quran — Maulana Wahiduddin Khan"),
    157: ("ur", "Fi Zilal al-Quran — Sayyid Qutb (Urdu)"),
    169: ("en", "Tafsir Ibn Kathir (Abridged)"),
    168: ("en", "Ma'arif al-Qur'an — Mufti Muhammad Shafi"),
    817: ("en", "Tazkirul Quran — Maulana Wahiduddin Khan"),
}
TAFSIR_DEFAULT = {"ur": 160, "en": 169}

HADITH = {
    "bukhari": ("Sahih al-Bukhari", "Muhammad ibn Isma'il al-Bukhari (d. 256 AH)"),
    "muslim":  ("Sahih Muslim", "Muslim ibn al-Hajjaj (d. 261 AH)"),
}


# ---------------------------------------------------------------- helpers
def fetch(url, cache_name=None, tries=4):
    if cache_name:
        p = os.path.join(CACHE, cache_name)
        if os.path.exists(p):
            with open(p, "rb") as f:
                return json.loads(f.read())
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
            if cache_name:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as f:
                    f.write(raw)
            return json.loads(raw)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            wait = 2 ** i
            print(f"  retry {i+1} {url} ({e}); waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"failed: {url}")


def write(rel, obj):
    p = os.path.join(DATA, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


SUP = re.compile(r"<sup[^>]*>.*?</sup>", re.S)
TAG = re.compile(r"<[^>]+>")


def clean_translation(t):
    """Remove footnote markers / markup only. Words are never altered."""
    t = SUP.sub("", t or "")
    t = TAG.sub("", t)
    return html.unescape(t).strip()


# ---------------------------------------------------------------- chapters
def build_chapters():
    print("chapters …")
    en = fetch(f"{QC}/chapters?language=en", "qc/chapters_en.json")["chapters"]
    ur = fetch(f"{QC}/chapters?language=ur", "qc/chapters_ur.json")["chapters"]
    ur_by = {c["id"]: c for c in ur}
    out = []
    for c in en:
        out.append({
            "n": c["id"],
            "ar": c["name_arabic"],
            "name": c["name_simple"],
            "nameC": c["name_complex"],
            "meaning": {"en": c["translated_name"]["name"], "ur": ur_by[c["id"]]["translated_name"]["name"]},
            "place": c["revelation_place"],          # makkah | madinah
            "order": c["revelation_order"],          # position in revelation order
            "ayahs": c["verses_count"],
            "bismillah": c["bismillah_pre"],
            "pages": c["pages"],
            "src": "qc-chapters",
        })
    assert len(out) == 114 and sum(c["ayahs"] for c in out) == 6236
    assert sorted(c["order"] for c in out) == list(range(1, 115))
    return out


def build_chapter_info(chapters):
    print("surah introductions …")
    def one(args):
        n, lang = args
        d = fetch(f"{QC}/chapters/{n}/info?language={lang}", f"qc/info_{lang}_{n}.json")["chapter_info"]
        return n, lang, d
    jobs = [(c["n"], l) for c in chapters for l in ("en", "ur")]
    res = {}
    with ThreadPoolExecutor(6) as ex:
        for n, lang, d in ex.map(one, jobs):
            res.setdefault(n, {})[lang] = {
                "html": d.get("text") or "",
                "short": d.get("short_text"),
                "source": d.get("source"),  # attribution string supplied by Quran.com
                "lang": d.get("language_name"),
            }
    for n, v in res.items():
        write(f"info/{n:03d}.json", {"src": "qc-chapter-info", **v})


# ---------------------------------------------------------------- verses + words
def fetch_chapter_verses(n, lang):
    verses, page = [], 1
    while True:
        url = (f"{QC}/verses/by_chapter/{n}?language={lang}&words=true&per_page=50&page={page}"
               f"&fields=text_uthmani,text_indopak&word_fields=text_uthmani,text_indopak")
        d = fetch(url, f"qc/verses_{lang}_{n}_{page}.json")
        verses += d["verses"]
        if not d["pagination"]["next_page"]:
            return verses
        page += 1


def build_verses(chapters):
    print("verses + word-by-word (en, ur) …")
    def one(c):
        n = c["n"]
        en = fetch_chapter_verses(n, "en")
        ur = fetch_chapter_verses(n, "ur")
        assert len(en) == c["ayahs"] == len(ur), n
        ayahs = []
        for ve, vu in zip(en, ur):
            assert ve["verse_key"] == vu["verse_key"]
            wu = {w["position"]: w for w in vu["words"]}
            words = []
            for w in ve["words"]:
                if w["char_type_name"] != "word":
                    continue
                words.append({
                    "u": w["text_uthmani"],
                    "i": w.get("text_indopak"),
                    "tl": (w.get("transliteration") or {}).get("text"),
                    "en": (w.get("translation") or {}).get("text"),
                    "ur": ((wu.get(w["position"]) or {}).get("translation") or {}).get("text"),
                    "a": w.get("audio_url"),
                })
            ayahs.append({
                "k": ve["verse_key"], "n": ve["verse_number"], "id": ve["id"],
                "u": ve["text_uthmani"], "i": ve["text_indopak"],
                "juz": ve["juz_number"], "page": ve["page_number"],
                "sajdah": bool(ve.get("sajdah_number")),
                "w": words,
            })
        write(f"surah/{n:03d}.json", {"n": n, "src": {"text": "qc-text", "wbw": "qc-wbw"}, "ayahs": ayahs})
        return n, [hashlib.sha256(a["u"].encode()).hexdigest()[:16] for a in ayahs]
    sums = {}
    with ThreadPoolExecutor(4) as ex:
        for n, h in ex.map(one, chapters):
            sums[n] = h
            print(f"  surah {n}", end="\r")
    print()
    return sums


def build_translations(chapters):
    print("translations …")
    meta = []
    for rid, (lang, label) in TRANSLATIONS.items():
        d = fetch(f"{QC}/quran/translations/{rid}", f"qc/tr_{rid}.json")["translations"]
        assert len(d) == 6236, (rid, len(d))
        i = 0
        for c in chapters:
            texts = [clean_translation(t["text"]) for t in d[i:i + c["ayahs"]]]
            i += c["ayahs"]
            write(f"tr/{rid}/{c['n']:03d}.json", texts)
        meta.append({"id": rid, "lang": lang, "name": label, "src": f"qc-tr-{rid}"})
        print(f"  {rid} {label}")
    write("translations.json", {"default": DEFAULT_TRANSLATIONS, "list": meta})
    return meta


# ---------------------------------------------------------------- hadith
REF = re.compile(r"\(\s*(?:V\.\s*)?(\d{1,3})\s*[.:]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\)")


QUOTE_WORDS = 6        # a hadith "quotes" an ayah when its Arabic contains this many consecutive words of it
QUOTE_MAX_AYAHS = 3    # phrases found in more ayahs than this are too common to point at one ayah
AR_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
AR_NORM = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"})


def ar_words(t):
    """Arabic words without harakat, with common letter variants unified (for matching only)."""
    return AR_MARKS.sub("", t or "").translate(AR_NORM).split()


AYAH_WORDS = {}


def quote_index(chapters):
    plain = fetch(f"{QC}/quran/verses/imlaei_simple", "qc/imlaei_simple.json")["verses"]
    keys = [f"{c['n']}:{a}" for c in chapters for a in range(1, c["ayahs"] + 1)]
    assert [v["verse_key"] for v in plain] == keys
    idx = {}
    for k, v in zip(keys, plain):
        w = ar_words(v["text_imlaei_simple"])
        AYAH_WORDS[k] = w
        for i in range(len(w) - QUOTE_WORDS + 1):
            idx.setdefault(" ".join(w[i:i + QUOTE_WORDS]), set()).add(k)
    return {win: ks for win, ks in idx.items() if len(ks) <= QUOTE_MAX_AYAHS}


def longest_run(ayah_words, hadith_text):
    """Most consecutive words of the ayah that appear, in order, in the hadith."""
    best = 0
    for i in range(len(ayah_words)):
        for j in range(len(ayah_words), i + best, -1):
            if f" {' '.join(ayah_words[i:j])} " in hadith_text:
                best = j - i
                break
    return best


def quoted_ayahs(hadith_words, windows):
    """Ayahs the hadith quotes. When a quoted phrase occurs in several ayahs, keep only the ayah with the
    longest quoted run; if they tie, the quote doesn't show which ayah is meant, so none is linked."""
    text = f" {' '.join(hadith_words)} "
    runs, found = {}, set()
    for i in range(len(hadith_words) - QUOTE_WORDS + 1):
        ks = windows.get(" ".join(hadith_words[i:i + QUOTE_WORDS]))
        if not ks:
            continue
        for k in ks:
            if k not in runs:
                runs[k] = longest_run(AYAH_WORDS[k], text)
        top = max(runs[k] for k in ks)
        winners = [k for k in ks if runs[k] == top]
        if len(winners) == 1:
            found.add(winners[0])
    return found


def sunnah_url(slug, h):
    if slug == "bukhari":
        n = h["hadithnumber"]
        return f"https://sunnah.com/bukhari:{int(n) if float(n).is_integer() else n}"
    book, inbook = h["reference"]["book"], h["reference"]["hadith"]       # sunnah.com/muslim/<book>/<in-book>
    return f"https://sunnah.com/muslim/{'introduction' if book == 0 else book}/{inbook}"


def build_hadith(chapters):
    """Link a hadith to an ayah ONLY when the hadith itself points to it:
       - "cited":  its English translation cites the ayah reference, e.g. "(8.24)" or "(V.2:255)";
       - "quoted": its Arabic text contains 6+ consecutive words of the ayah (common phrases ignored).
       Nothing is linked by topic or by our judgement."""
    print("sahih hadith …")
    counts = {c["n"]: c["ayahs"] for c in chapters}
    windows = quote_index(chapters)
    per_surah, stats = {}, {}
    for slug in HADITH:
        eng = fetch(f"{HADITH_CDN}/eng-{slug}.json", f"hadith/eng-{slug}.json")
        urd = fetch(f"{HADITH_CDN}/urd-{slug}.json", f"hadith/urd-{slug}.json")
        ara = fetch(f"{HADITH_CDN}/ara-{slug}.json", f"hadith/ara-{slug}.json")
        u_by = {h["hadithnumber"]: h["text"] for h in urd["hadiths"]}
        a_by = {h["hadithnumber"]: h["text"] for h in ara["hadiths"]}
        books = eng["metadata"]["sections"]
        n_cited = n_quoted = linked = 0
        for h in eng["hadiths"]:
            num = h["hadithnumber"]
            cited = set()
            for m in REF.finditer(h["text"] or ""):
                s, a1, a2 = int(m.group(1)), int(m.group(2)), m.group(3)
                a2 = int(a2) if a2 else a1
                if 1 <= s <= 114 and 1 <= a1 <= a2 <= counts[s] and a2 - a1 < 40:
                    cited |= {f"{s}:{a}" for a in range(a1, a2 + 1)}
            quoted = quoted_ayahs(ar_words(a_by.get(num)), windows)
            refs = cited | quoted
            if not refs:
                continue
            linked += 1
            n_cited += bool(cited)
            n_quoted += bool(quoted)
            order = lambda k: tuple(map(int, k.split(":")))
            rec = {
                "c": slug, "num": num,
                "book": h["reference"]["book"], "bookName": books.get(str(h["reference"]["book"])),
                "inBook": h["reference"]["hadith"],
                "en": h["text"], "ur": u_by.get(num), "ar": a_by.get(num),
                "refs": sorted(refs, key=order), "cited": sorted(cited, key=order), "quoted": sorted(quoted, key=order),
                "url": sunnah_url(slug, h),
            }
            for s in {int(k.split(":")[0]) for k in refs}:
                per_surah.setdefault(s, []).append(rec)
        stats[slug] = {"linked": linked, "cited": n_cited, "quoted": n_quoted}
        print(f"  {slug}: {linked} hadith linked ({n_cited} cite an ayah in English, {n_quoted} quote one in Arabic)")
    index = {}
    for s, recs in sorted(per_surah.items()):
        recs.sort(key=lambda r: (r["c"] != "bukhari", r["num"]))
        write(f"hadith/{s:03d}.json", recs)
        by_ayah = {}
        for r in recs:
            for k in r["refs"]:
                if k.startswith(f"{s}:"):
                    by_ayah[k] = by_ayah.get(k, 0) + 1
        index[s] = by_ayah
    write("hadith-index.json", index)
    return stats


# ---------------------------------------------------------------- sources
def build_sources(tr_meta, hadith_stats):
    s = {
        "qc-chapters": {
            "title": "Surah list, names, revelation place and revelation order",
            "publisher": "Quran.com / Quran Foundation (waqf)", "url": "https://quran.com",
            "via": f"{QC}/chapters", "note": "Revelation order follows the order used by Quran.com (based on narrations largely attributed to Ibn Abbas). Scholars differ on the exact order; treat it as approximate."},
        "qc-chapter-info": {
            "title": "Surah introductions (name, period of revelation, theme, background)",
            "publisher": "Quran.com", "url": "https://quran.com",
            "via": f"{QC}/chapters/{{n}}/info", "note": "The original author is named in each introduction's 'source' field (e.g. Sayyid Abul A'la Maududi, Tafhim al-Quran)."},
        "qc-text": {
            "title": "Arabic Quran text (Uthmani and IndoPak scripts)",
            "publisher": "Quran.com", "url": "https://quran.com",
            "via": f"{QC}/verses/by_chapter", "note": "Displayed unmodified. SHA-256 fingerprints of every ayah are stored in data/checksums.json."},
        "qc-wbw": {
            "title": "Word-by-word meanings (English & Urdu) and transliteration",
            "publisher": "Quran.com", "url": "https://quran.com", "via": f"{QC}/verses/by_chapter?words=true"},
        "qc-word-audio": {
            "title": "Word-by-word pronunciation audio", "publisher": "Quran.com",
            "url": "https://quran.com", "via": "https://audio.qurancdn.com/wbw/{surah}_{ayah}_{word}.mp3",
            "note": "Streamed live when a word is played."},
        "ayah-audio": {
            "title": "Ayah recitation audio — Mishary Rashid Alafasy",
            "publisher": "Islamic Network CDN (alquran.cloud)", "url": "https://alquran.cloud/cdn"},
        "sahih-hadith-text": {
            "title": "Sahih al-Bukhari & Sahih Muslim (Arabic, English, Urdu)",
            "publisher": "fawazahmed0/hadith-api (public, Unlicense)", "url": "https://github.com/fawazahmed0/hadith-api",
            "note": ("A hadith is linked to an ayah ONLY when the hadith itself points to it: its English translation cites the "
                     "ayah reference (e.g. '(8.24)'), or its Arabic text quotes at least 6 consecutive words of the ayah "
                     "(phrases found in more than 3 ayahs are ignored; when a phrase occurs in several ayahs, only the ayah with the longest quoted run is linked, and none on a tie). We add no links of our own. Each hadith links to "
                     "sunnah.com for verification; Sahih Muslim is referenced by book and in-book number, as on sunnah.com. "
                     + "; ".join(f"{HADITH[k][0]}: {v['linked']} hadith ({v['cited']} cited, {v['quoted']} quoted)"
                                 for k, v in hadith_stats.items()) + ".")},
    }
    for t in tr_meta:
        s[t["src"]] = {"title": f"Translation — {t['name']}", "lang": t["lang"],
                       "publisher": "Quran.com", "url": f"https://quran.com/1?translations={t['id']}",
                       "via": f"{QC}/quran/translations/{t['id']}",
                       "note": "Footnote markers removed for display; text otherwise unmodified."}
    for k in s:
        s[k]["fetched"] = TODAY
    merge_sources(s)


def merge_sources(new):
    """Update data/sources.json without dropping entries other build scripts added."""
    p = os.path.join(DATA, "sources.json")
    cur = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    cur.update(new)
    write("sources.json", cur)


def build_tafsirs():
    """Tafsir is large, so only the list and citations are bundled. The reader fetches each
    ayah's commentary live from Quran.com's public API, unmodified, and names the author."""
    print("tafsir list …")
    res = fetch(f"{QC}/resources/tafsirs", "qc/tafsirs.json")["tafsirs"]
    by_id = {t["id"]: t for t in res}
    meta, srcs = [], {}
    for tid, (lang, label) in TAFSIRS.items():
        t = by_id.get(tid)
        assert t, f"tafsir {tid} no longer offered by Quran.com"
        meta.append({"id": tid, "lang": lang, "name": label, "author": t.get("author_name"), "src": f"qc-tafsir-{tid}"})
        srcs[f"qc-tafsir-{tid}"] = {
            "title": f"Tafsir — {label}", "lang": lang, "publisher": "Quran.com",
            "url": "https://quran.com", "via": f"{QC}/tafsirs/{tid}/by_ayah/{{key}}",
            "note": ("Loaded live, ayah by ayah, and shown as published (only unsafe HTML is stripped). "
                     f"Author as listed by Quran.com: {t.get('author_name')}."),
            "fetched": TODAY}
    write("tafsirs.json", {"api": f"{QC}/tafsirs/{{id}}/by_ayah/{{key}}", "default": TAFSIR_DEFAULT, "list": meta})
    merge_sources(srcs)


def main():
    os.makedirs(DATA, exist_ok=True)
    chapters = build_chapters()
    write("chapters.json", chapters)
    build_chapter_info(chapters)
    sums = build_verses(chapters)
    write("checksums.json", {str(k): v for k, v in sorted(sums.items())})
    tr = build_translations(chapters)
    hs = build_hadith(chapters)
    build_sources(tr, hs)
    build_tafsirs()
    print("done.")


if __name__ == "__main__":
    main()
