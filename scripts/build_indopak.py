#!/usr/bin/env python3
"""
Build IndoPak (South Asian) script data for Tadabbur from DigitalKhatt.

Text : DigitalKhatt IndoPak Quran text (digitalkhatt.org, MIT licence),
       typeset after the IndoPak 'Quraan Al Majeed' mushaf.
Font : DigitalKhatt IndoPak font (github.com/DigitalKhatt/indopakfont, SIL OFL 1.1).

The text is never edited. We only split it into ayahs (at the ۝<number> markers)
and into words (at spaces), then line those words up with Quran.com's word list
so the word-by-word meanings attach to the right word.

Output: data/indopak/NNN.json  ->  { "src": ..., "bismillah": str, "ayahs": [ [word, ...], ... ] }
Run after scripts/build_data.py.
"""
import json, os, re, sys, unicodedata, urllib.request, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "dk")
TEXT_URL = "https://raw.githubusercontent.com/DigitalKhatt/digitalkhatt.org/master/ClientApp/src/app/services/quran_text_indopak_15.ts"
FONT_URL = "https://github.com/DigitalKhatt/indopakfont/releases/download/v1.0.0-beta.1/indopak.woff2"
LICENCE_URL = "https://raw.githubusercontent.com/DigitalKhatt/indopakfont/main/LICENSE"
DIGITS = "٠١٢٣٤٥٦٧٨٩"


def download(url, name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        req = urllib.request.Request(url, headers={"User-Agent": "tadabbur-data-builder/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, "wb") as f:
            f.write(r.read())
    return p


def has_letter(t):
    return any(unicodedata.category(c) == "Lo" for c in t)


def letters(t):
    return sum(1 for c in t if unicodedata.category(c) == "Lo")


def parse_surahs(src):
    lines = re.findall(r"'((?:[^'\\]|\\.)*)'", src)
    surahs, cur = [], None
    for l in lines:
        if l.startswith("سُورَةُ"):          # surah title line
            cur = []
            surahs.append(cur)
            continue
        cur.append(l)
    assert len(surahs) == 114, len(surahs)
    return surahs


def split_ayahs(lines):
    """Returns (bismillah_or_None, [(number, [tokens])...]).
    Waqf signs written right after an ayah number stay with that ayah."""
    text = " ".join(lines)
    bismillah = None
    parts = re.split("۝([" + DIGITS + "]+)", text)
    head = parts[0]
    if "۝" in head:                      # unnumbered ۝ ends the Bismillah line
        bismillah, head = head.split("۝", 1)
        bismillah = bismillah.strip()
    ayahs, seg = [], head
    for i in range(1, len(parts), 2):
        n = int("".join(str(DIGITS.index(c)) for c in parts[i]))
        ayahs.append([n, seg.split()])
        seg = parts[i + 1] if i + 1 < len(parts) else ""
    # tokens with no letters at the start of a segment are waqf signs after the previous number
    for k in range(1, len(ayahs)):
        toks = ayahs[k][1]
        while toks and not has_letter(toks[0]):
            ayahs[k - 1][1].append(toks.pop(0))
    tail = seg.split()
    if ayahs:
        ayahs[-1][1].extend(t for t in tail if not has_letter(t))
    return bismillah, ayahs


def group_words(toks):
    """Attach letter-less tokens (stand-alone pause signs) to the word before them."""
    words = []
    for t in toks:
        if has_letter(t) or not words:
            words.append(t)
        else:
            words[-1] += t
    return words


def align(dk_words, qc_words):
    """Map DigitalKhatt words onto Quran.com words (same count -> 1:1).
    When counts differ (e.g. Quran.com joins 'بَعْدَ مَا'), consume DK words until
    the letter count reaches the Quran.com word's letter count."""
    if len(dk_words) == len(qc_words):
        return dk_words
    out, i = [], 0
    for qi, q in enumerate(qc_words):
        need = letters(q["u"])
        take = [dk_words[i]]
        i += 1
        remaining_q = len(qc_words) - qi - 1
        while i < len(dk_words) and letters("".join(take)) < need and len(dk_words) - i > remaining_q:
            take.append(dk_words[i])
            i += 1
        out.append(" ".join(take))
    if i < len(dk_words):                     # leftovers join the last word
        out[-1] += " " + " ".join(dk_words[i:])
    assert len(out) == len(qc_words)
    return out


def main():
    src = open(download(TEXT_URL, "quran_text_indopak_15.ts"), encoding="utf-8").read()
    surahs = parse_surahs(src)
    os.makedirs(os.path.join(DATA, "indopak"), exist_ok=True)
    stats = {"ayahs": 0, "realigned": [], "fatiha_renumbered": True}
    sums = {}
    first_bismillah = None
    for si, lines in enumerate(surahs, 1):
        qc = json.load(open(os.path.join(DATA, "surah", f"{si:03d}.json"), encoding="utf-8"))["ayahs"]
        bism, ayahs = split_ayahs(lines)
        if si == 1:
            # This mushaf leaves Al-Fatihah's Bismillah unnumbered and marks a (non-Kufan) ayah end
            # inside its numbered ayah 7 with an alternate sign. Quran.com (Hafs/Kufan count) numbers
            # the Bismillah 1:1. Same words, different numbering: Bismillah -> 1:1, then the
            # numbered ayahs in sequence -> 1:2 … 1:7.
            first_bismillah = bism
            ayahs = [[1, bism.split()]] + [[i + 2, t] for i, (_, t) in enumerate(ayahs)]
        assert len(ayahs) == len(qc), (si, len(ayahs), len(qc))
        out = []
        for (n, toks), q in zip(ayahs, qc):
            assert n == q["n"], (si, n, q["n"])
            words = group_words(toks)
            aligned = align(words, q["w"])
            if aligned is not words:
                stats["realigned"].append(q["k"])
            out.append(aligned)
        stats["ayahs"] += len(out)
        sums[si] = [hashlib.sha256(" ".join(w).encode()).hexdigest()[:16] for w in out]
        with open(os.path.join(DATA, "indopak", f"{si:03d}.json"), "w", encoding="utf-8") as f:
            json.dump({"src": "dk-indopak-text", "bismillah": bism, "ayahs": out}, f, ensure_ascii=False, separators=(",", ":"))
    assert stats["ayahs"] == 6236
    with open(os.path.join(DATA, "indopak", "bismillah.json"), "w", encoding="utf-8") as f:
        json.dump({"text": first_bismillah, "src": "dk-indopak-text"}, f, ensure_ascii=False)
    with open(os.path.join(DATA, "checksums-indopak.json"), "w") as f:
        json.dump({str(k): v for k, v in sums.items()}, f, separators=(",", ":"))

    # font + licence (SIL OFL 1.1 permits bundling with the licence included)
    os.makedirs(os.path.join(ROOT, "fonts"), exist_ok=True)
    for url, name in ((FONT_URL, "DigitalKhatt-IndoPak.woff2"), (LICENCE_URL, "DigitalKhatt-IndoPak-OFL.txt")):
        with open(download(url, name), "rb") as s, open(os.path.join(ROOT, "fonts", name), "wb") as d:
            d.write(s.read())

    # register sources
    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    import datetime
    today = datetime.date.today().isoformat()
    s["dk-indopak-text"] = {
        "title": "IndoPak (South Asian) Quran text",
        "publisher": "DigitalKhatt (digitalkhatt.org), MIT licence",
        "url": "https://github.com/DigitalKhatt/digitalkhatt.org",
        "via": TEXT_URL,
        "note": ("Typeset after the IndoPak 'Quraan Al Majeed' mushaf. Displayed unmodified; we only split it into ayahs "
                 "and words. This mushaf leaves Al-Fatihah's Bismillah unnumbered (and marks an alternate ayah end inside 1:7), "
                 "so we number its ayahs 1:1–1:7 to match the Hafs (Kufan) count. "
                 f"Word boundaries re-aligned to Quran.com's word list in {len(stats['realigned'])} ayahs "
                 f"({', '.join(stats['realigned'])}), where Quran.com joins two written words into one."),
        "fetched": today,
    }
    s["dk-indopak-font"] = {
        "title": "DigitalKhatt IndoPak font",
        "publisher": "DigitalKhatt, SIL Open Font License 1.1 (sponsored by Tarteel)",
        "url": "https://github.com/DigitalKhatt/indopakfont",
        "via": FONT_URL, "note": "Licence text bundled at fonts/DigitalKhatt-IndoPak-OFL.txt.",
        "fetched": today,
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    print(f"IndoPak: {stats['ayahs']} ayahs written; realigned {stats['realigned']}")


if __name__ == "__main__":
    main()
