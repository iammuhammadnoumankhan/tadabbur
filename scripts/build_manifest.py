#!/usr/bin/env python3
"""
Write data/manifest.json: the schema version and a summary of every dataset,
so any client (web, mobile, desktop) can check compatibility before using data.
See docs/DATA.md. Run last, after all other build scripts.
"""
import datetime, glob, json, os

SCHEMA = 1
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def load(rel):
    return json.load(open(os.path.join(DATA, rel), encoding="utf-8"))


def main():
    chs = load("chapters.json")
    trs = load("translations.json")["list"]
    words = sum(len(a["w"]) for p in glob.glob(os.path.join(DATA, "surah", "*.json"))
                for a in json.load(open(p, encoding="utf-8"))["ayahs"])
    hadith_nums = {(r["c"], r["num"]) for p in glob.glob(os.path.join(DATA, "hadith", "*.json"))
                   for r in json.load(open(p, encoding="utf-8"))}
    manifest = {
        "schema": SCHEMA,
        "built": datetime.date.today().isoformat(),
        "counts": {
            "surahs": len(chs),
            "ayahs": sum(c["ayahs"] for c in chs),
            "words": words,
            "translations": len(trs),
            "tafsirs": len(load("tafsirs.json")["list"]),
            "hadith_linked": len(hadith_nums),
            "seerah_events": len(load("seerah.json")["events"]),
            "prophets": len(load("stories.json")["prophets"]),
            "roots": len(load("roots/index.json")["roots"]),
            "vocab": len(load("vocab.json")["items"]),
            "reciters": len(load("audio/reciters.json")["list"]),
            "pages_madani": load("layout/madani/index.json")["pages"],
            "pages_indopak": load("layout/indopak/index.json")["pages"],
        },
        "datasets": [
            {"id": "chapters", "files": ["chapters.json"], "src": ["qc-chapters"]},
            {"id": "quran-text", "files": ["surah/NNN.json", "checksums.json"], "src": ["qc-text", "qc-wbw"]},
            {"id": "indopak", "files": ["indopak/NNN.json", "checksums-indopak.json"], "src": ["dk-indopak-text", "dk-indopak-font"]},
            {"id": "layout", "files": ["layout/<madani|indopak>/index.json", "layout/<madani|indopak>/PPP.json"], "src": ["qc-layout-madani", "dk-indopak-text"]},
            {"id": "tajweed", "files": ["tajweed/NNN.json", "checksums-tajweed.json"], "src": ["qc-tajweed"]},
            {"id": "translations", "files": ["translations.json", "tr/<id>/NNN.json"], "src": [t["src"] for t in trs]},
            {"id": "surah-info", "files": ["info/NNN.json"], "src": ["qc-chapter-info"]},
            {"id": "tafsir", "files": ["tafsirs.json"], "src": [t["src"] for t in load("tafsirs.json")["list"]]},
            {"id": "hadith", "files": ["hadith-index.json", "hadith/NNN.json"], "src": ["sahih-hadith-text"]},
            {"id": "seerah", "files": ["seerah.json", "seerah/<id>.json", "seerah-by-surah.json"], "src": ["seerah-timeline", "sahih-hadith-text"]},
            {"id": "prophets", "files": ["stories.json", "stories-by-surah.json", "family.json"], "src": ["qac-ontology"]},
            {"id": "search", "files": ["search/ar.json", "search/tr-<id>.json"], "src": ["qc-imlaei-simple"]},
            {"id": "roots", "files": ["morph/NNN.json", "roots/index.json", "roots/<id>.json"], "src": ["qac-morphology"]},
            {"id": "vocab", "files": ["vocab.json"], "src": ["tadabbur-vocab", "qac-morphology"]},
            {"id": "recitations", "files": ["audio/reciters.json", "audio/<reciter id>/NNN.json"], "src": [r["src"] for r in load("audio/reciters.json")["list"]]},
        ],
    }
    with open(os.path.join(DATA, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("manifest:", manifest["counts"])


if __name__ == "__main__":
    main()
