#!/usr/bin/env python3
"""
Build search index files for Tadabbur (search runs entirely in the browser).

- data/search/ar.json      : plain Arabic (Quran.com 'imlaei simple', modern spelling,
                             no harakat), one string per ayah, in mushaf order. Used only
                             to match what people type; the reader still shows the
                             Uthmani/IndoPak text.
- data/search/tr-<id>.json : each translation's 6,236 ayahs in one file, re-packed from
                             data/tr/<id>/NNN.json (no new content).

Run after scripts/build_data.py.
"""
import json, os, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "qc")
URL = "https://api.quran.com/api/v4/quran/verses/imlaei_simple"


def main():
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, "imlaei_simple.json")
    if not os.path.exists(p):
        req = urllib.request.Request(URL, headers={"User-Agent": "tadabbur-data-builder/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, "wb") as f:
            f.write(r.read())
    verses = json.load(open(p, encoding="utf-8"))["verses"]
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    keys = [f"{c['n']}:{a}" for c in chapters for a in range(1, c["ayahs"] + 1)]
    assert [v["verse_key"] for v in verses] == keys, "ayah order mismatch"

    out = os.path.join(DATA, "search")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "ar.json"), "w", encoding="utf-8") as f:
        json.dump([v["text_imlaei_simple"] for v in verses], f, ensure_ascii=False, separators=(",", ":"))

    trs = json.load(open(os.path.join(DATA, "translations.json"), encoding="utf-8"))["list"]
    for t in trs:
        texts = []
        for c in chapters:
            texts += json.load(open(os.path.join(DATA, "tr", str(t["id"]), f"{c['n']:03d}.json"), encoding="utf-8"))
        assert len(texts) == 6236, t["id"]
        with open(os.path.join(out, f"tr-{t['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(texts, f, ensure_ascii=False, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qc-imlaei-simple"] = {
        "title": "Plain Arabic text for search (modern spelling, no harakat)",
        "publisher": "Quran.com", "url": "https://quran.com", "via": URL,
        "note": "Used only to match typed Arabic. Results always show the Quran in the reader's chosen script.",
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    print(f"search index: ar + {len(trs)} translations")


if __name__ == "__main__":
    main()
