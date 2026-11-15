#!/usr/bin/env python3
"""
Build tajweed-coloured Quran text for Tadabbur.

Source: Quran.com word-by-word tajweed text (text_uthmani_tajweed), one entry per word position,
the same word positions as data/surah/NNN.json. It is a slightly different Uthmani encoding from
our plain Uthmani text, so in tajweed mode the reader shows THIS text as published (never a
merge of the two). Its own fingerprints are kept in data/checksums-tajweed.json.

Markup is reduced to <span class="tj tj-RULE">…</span> (nesting kept). Any other tag fails the build.
Output: data/tajweed/NNN.json  ->  { src, ayahs: [[word html, …], …] }
"""
import datetime, hashlib, html, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "tajweed")
QC = "https://api.quran.com/api/v4"
RULE_OPEN = re.compile(r'<rule class=([A-Za-z_-]+)>')
ANY_TAG = re.compile(r"<[^>]*>")
KNOWN = {
    "ham_wasl", "laam_shamsiyah", "slnt", "madda_normal", "madda_permissible", "madda_necessary",
    "madda_obligatory", "madda_obligatory_mottasel", "madda_obligatory_monfasel", "qalaqah", "ghunnah",
    "ikhafa", "ikhafa_shafawi", "iqlab", "idgham_ghunnah", "idgham_wo_ghunnah", "idgham_shafawi",
    "idgham_mutajanisayn", "idgham_mutaqaribayn", "custom-alef-maksora",
}


def fetch(n, page):
    p = os.path.join(CACHE, f"{n:03d}_{page}.json")
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        url = f"{QC}/verses/by_chapter/{n}?words=true&per_page=50&page={page}&fields=verse_key&word_fields=text_uthmani_tajweed"
        for i in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "tadabbur-data-builder/1.0"})
                with urllib.request.urlopen(req, timeout=60) as r, open(p, "wb") as f:
                    f.write(r.read())
                break
            except Exception as e:  # noqa: BLE001
                print(f"  retry {n}/{page}: {e}", file=sys.stderr)
                time.sleep(2 ** i)
    return json.load(open(p, encoding="utf-8"))


def chapter(n):
    verses, page = [], 1
    while True:
        d = fetch(n, page)
        verses += d["verses"]
        if not d["pagination"]["next_page"]:
            return verses
        page += 1


def convert(raw, where):
    """<rule class=x>…</rule> -> <span class="tj tj-x">…</span>; text escaped; anything else is an error."""
    out, pos, depth = [], 0, 0
    for m in re.finditer(r"<rule class=([A-Za-z_-]+)>|</rule>|<[^>]*>", raw):
        out.append(html.escape(raw[pos:m.start()], quote=False))
        tok = m.group(0)
        if m.group(1):
            if m.group(1) not in KNOWN:
                sys.exit(f"{where}: unknown tajweed rule {m.group(1)!r}")
            out.append(f'<span class="tj tj-{m.group(1)}">'); depth += 1
        elif tok == "</rule>":
            out.append("</span>"); depth -= 1
        else:
            sys.exit(f"{where}: unexpected tag {tok!r}")
        pos = m.end()
    out.append(html.escape(raw[pos:], quote=False))
    if depth != 0:
        sys.exit(f"{where}: unbalanced tags")
    return "".join(out)


def main():
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    with ThreadPoolExecutor(4) as ex:
        all_verses = dict(zip([c["n"] for c in chapters], ex.map(lambda c: chapter(c["n"]), chapters)))
    sums, rules = {}, {}
    os.makedirs(os.path.join(DATA, "tajweed"), exist_ok=True)
    for c in chapters:
        n = c["n"]
        ours = json.load(open(os.path.join(DATA, "surah", f"{n:03d}.json"), encoding="utf-8"))["ayahs"]
        verses = all_verses[n]
        assert len(verses) == len(ours) == c["ayahs"], n
        out = []
        for v, a in zip(verses, ours):
            assert v["verse_key"] == a["k"]
            words = [w for w in v["words"] if w["char_type_name"] == "word"]
            if len(words) != len(a["w"]) or [w["position"] for w in words] != list(range(1, len(a["w"]) + 1)):
                sys.exit(f"{a['k']}: tajweed has {len(words)} words, our list has {len(a['w'])}")
            row = []
            for w in words:
                raw = w.get("text_uthmani_tajweed") or ""
                if not ANY_TAG.sub("", raw).strip():
                    sys.exit(f"{a['k']} word {w['position']}: empty tajweed text")
                for r in RULE_OPEN.findall(raw):
                    rules[r] = rules.get(r, 0) + 1
                row.append(convert(raw, f"{a['k']}:{w['position']}"))
            out.append(row)
        sums[n] = [hashlib.sha256(" ".join(html.unescape(ANY_TAG.sub("", w)) for w in row).encode()).hexdigest()[:16] for row in out]
        with open(os.path.join(DATA, "tajweed", f"{n:03d}.json"), "w", encoding="utf-8") as f:
            json.dump({"src": "qc-tajweed", "ayahs": out}, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(DATA, "checksums-tajweed.json"), "w") as f:
        json.dump({str(k): v for k, v in sums.items()}, f, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qc-tajweed"] = {
        "title": "Tajweed-coloured Quran text (Uthmani, word by word)",
        "publisher": "Quran.com", "url": "https://quran.com",
        "via": f"{QC}/verses/by_chapter/{{n}}?words=true&word_fields=text_uthmani_tajweed",
        "note": ("Shown as published in tajweed mode, one entry per word position (the same positions as our word list). "
                 "It's a slightly different Uthmani encoding from the plain text, so it has its own fingerprints "
                 "(data/checksums-tajweed.json); the two are never mixed. Rule markup only adds colour. "
                 f"Rules used: {', '.join(f'{k} {v:,}' for k, v in sorted(rules.items(), key=lambda x: -x[1]))}."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    print(f"tajweed: 114 surahs; {sum(rules.values()):,} marked spans; rules: {sorted(rules)}")


if __name__ == "__main__":
    main()
