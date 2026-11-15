#!/usr/bin/env python3
"""
Build mushaf page layouts for Tadabbur's page view: which words sit on which line of which page.

- madani : 604-page, 15-line Madani mushaf layout, from Quran.com's per-word page_number/line_number.
- indopak: 15-line IndoPak mushaf layout (610 pages), from the DigitalKhatt IndoPak text, which is
           stored page by page and line by line (the same text as data/indopak/).

Only positions are stored (references to our existing words); no text is copied or changed.
Output: data/layout/<mushaf>/PPP.json  -> { page, lines: [Line, …] }
          Line = { t: "w", w: ["s:a:w" | "s:a:e", …] }   words ("e" = ayah-end marker)
               | { t: "s", s: <surah> }                   surah name line
               | { t: "b" }                               Bismillah line
        data/layout/<mushaf>/index.json -> { pages, src, surah: {n: first page}, ayah: {n: [page per ayah]} }
"""
import datetime, json, os, re, sys, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache")
QC = "https://api.quran.com/api/v4"
DIGITS = "٠١٢٣٤٥٦٧٨٩"


def load(rel):
    return json.load(open(os.path.join(DATA, rel), encoding="utf-8"))


def write_layout(mushaf, pages, src, chapters):
    out = os.path.join(DATA, "layout", mushaf)
    os.makedirs(out, exist_ok=True)
    first, ayah_page = {}, {c["n"]: [None] * c["ayahs"] for c in chapters}
    for p, lines in enumerate(pages, 1):
        for ln in lines:
            if ln["t"] == "s":
                first.setdefault(ln["s"], p)
            for ref in ln.get("w", []):
                s, a, _w = ref.split(":")
                s, a = int(s), int(a)
                first.setdefault(s, p)
                if ayah_page[s][a - 1] is None:
                    ayah_page[s][a - 1] = p
        with open(os.path.join(out, f"{p:03d}.json"), "w", encoding="utf-8") as f:
            json.dump({"page": p, "lines": lines}, f, separators=(",", ":"))
    missing = [f"{s}:{i + 1}" for s, v in ayah_page.items() for i, p in enumerate(v) if p is None]
    if missing:
        sys.exit(f"{mushaf}: ayahs not placed on any page, e.g. {missing[:5]}")
    with open(os.path.join(out, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"pages": len(pages), "src": src, "surah": first, "ayah": ayah_page}, f, separators=(",", ":"))
    print(f"{mushaf}: {len(pages)} pages")


# ---------------------------------------------------------------- Madani (Quran.com)
def qc_chapter(n):
    verses, page = [], 1
    while True:
        p = os.path.join(CACHE, "layout", f"{n:03d}_{page}.json")
        if not os.path.exists(p):
            os.makedirs(os.path.dirname(p), exist_ok=True)
            url = f"{QC}/verses/by_chapter/{n}?words=true&per_page=50&page={page}&fields=verse_key&word_fields=page_number,line_number"
            for i in range(4):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "tadabbur-data-builder/1.0"})
                    with urllib.request.urlopen(req, timeout=60) as r, open(p, "wb") as f:
                        f.write(r.read())
                    break
                except Exception as e:  # noqa: BLE001
                    print(f"  retry {n}/{page}: {e}", file=sys.stderr)
                    time.sleep(2 ** i)
        d = json.load(open(p, encoding="utf-8"))
        verses += d["verses"]
        if not d["pagination"]["next_page"]:
            return verses
        page += 1


def build_madani(chapters):
    with ThreadPoolExecutor(4) as ex:
        allv = dict(zip([c["n"] for c in chapters], ex.map(lambda c: qc_chapter(c["n"]), chapters)))
    grid = {}                                            # (page, line) -> [refs]
    for c in chapters:
        ours = load(f"surah/{c['n']:03d}.json")["ayahs"]
        for v, a in zip(allv[c["n"]], ours):
            assert v["verse_key"] == a["k"]
            words = [w for w in v["words"] if w["char_type_name"] == "word"]
            assert len(words) == len(a["w"]), a["k"]
            for w in v["words"]:
                ref = f"{a['k']}:{w['position']}" if w["char_type_name"] == "word" else f"{a['k']}:e"
                grid.setdefault((w["page_number"], w["line_number"]), []).append(ref)
    npages = max(p for p, _ in grid)
    starts = {c["n"]: c for c in chapters}
    pages = []
    pending = []                                          # empty lines at the end of a page (before a surah on the next page)
    for p in range(1, npages + 1):
        lines = []
        for ln in range(1, 16):
            refs = grid.get((p, ln))
            lines.append({"t": "w", "w": refs} if refs else None)
        # fill empty lines: surah name (+ Bismillah) before a surah's first ayah
        i = 0
        while i < 15:
            if lines[i] is not None:
                i += 1
                continue
            j = i
            while j < 15 and lines[j] is None:
                j += 1
            gap = j - i
            nxt = lines[j]["w"][0] if j < 15 else None
            s = None
            if nxt and nxt.endswith(":1:1"):
                s = int(nxt.split(":")[0])
            elif j == 15:
                # blank lines at the bottom: they hold the next surah's heading only when the next
                # page starts straight away with that surah's first word on line 1
                first_next = grid.get((p + 1, 1), [None])[0]
                if first_next and first_next.endswith(":1:1"):
                    s = int(first_next.split(":")[0])
            if s is None:
                lines[i:j] = [{"t": "x"}] * gap           # blank line (e.g. short first pages)
                i = j
                continue
            fill = [{"t": "s", "s": s}]
            if gap >= 2 and s and starts[s]["bismillah"]:
                fill.append({"t": "b"})
            fill = (fill + [{"t": "x"}] * gap)[:gap]      # "x" = decorative blank (rare)
            lines[i:j] = fill
            i = j
        pages.append(lines)
    # heading at the bottom of one page, Bismillah at the top of the next: the next page has a single
    # blank line before ayah 1 (which we filled with the heading) and the page before ends with a blank.
    for k in range(1, len(pages)):
        top, prev = pages[k], pages[k - 1]
        if (top[0]["t"] == "s" and top[1]["t"] == "w" and top[1]["w"][0].endswith(":1:1")
                and starts[top[0]["s"]]["bismillah"] and prev[-1]["t"] == "x"):
            prev[-1] = top[0]
            top[0] = {"t": "b"}
    write_layout("madani", pages, "qc-layout-madani", chapters)


# ---------------------------------------------------------------- IndoPak 15-line (DigitalKhatt)
def letters(t):
    return any(unicodedata.category(c) == "Lo" for c in t)


def dk_pages():
    src = open(os.path.join(CACHE, "dk", "quran_text_indopak_15.ts"), encoding="utf-8").read()
    body = src[src.index("["):]
    pages, depth, i, cur = [], 0, 0, None
    STR = re.compile(r"'((?:[^'\\]|\\.)*)'")
    while i < len(body):
        c = body[i]
        if c == "'":
            m = STR.match(body, i)
            if depth == 2:
                cur.append(m.group(1))
            i = m.end()
            continue
        if c == "[":
            depth += 1
            if depth == 2:
                cur = []
                pages.append(cur)
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    return pages


def build_indopak(chapters):
    # our IndoPak words in reading order, each with how many space-separated letter tokens it spans
    seq = []
    for c in chapters:
        ip = load(f"indopak/{c['n']:03d}.json")["ayahs"]
        for a, words in enumerate(ip, 1):
            for w, text in enumerate(words, 1):
                seq.append((c["n"], a, w, sum(1 for tk in text.split() if letters(tk)), len(words)))
    pos, surah = 0, 0
    pages = []
    for lines in dk_pages():
        out = []
        for line in lines:
            if line.startswith("سُورَةُ"):
                surah += 1
                out.append({"t": "s", "s": surah})
                continue
            if "۝" in line and not re.search("۝[" + DIGITS + "]", line) and surah != 1:
                out.append({"t": "b"})                    # Bismillah line (unnumbered ۝)
                continue
            refs, need = [], 0
            for tk in line.split():
                if tk.startswith("۝"):
                    s, a, *_ = seq[pos - 1]
                    refs.append(f"{s}:{a}:e")
                    continue
                if not letters(tk):
                    continue                              # pause signs belong to the previous word
                if need == 0:
                    s, a, w, k, _n = seq[pos]
                    refs.append(f"{s}:{a}:{w}")
                    need = k
                    pos += 1
                need -= 1
            out.append({"t": "w", "w": refs})
        pages.append(out)
    if pos != len(seq):
        sys.exit(f"indopak: placed {pos} of {len(seq)} words")
    write_layout("indopak", pages, "dk-indopak-text", chapters)


def main():
    chapters = load("chapters.json")
    build_madani(chapters)
    build_indopak(chapters)
    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qc-layout-madani"] = {
        "title": "Madani mushaf page layout (604 pages, 15 lines)",
        "publisher": "Quran.com (per-word page and line numbers)", "url": "https://quran.com",
        "via": f"{QC}/verses/by_chapter/{{n}}?words=true&word_fields=page_number,line_number",
        "note": ("Which words sit on which line of which page. Only positions are stored; the text shown is our "
                 "Uthmani or tajweed text. Lines without words are the surah name and Bismillah, as in the printed mushaf."),
        "fetched": datetime.date.today().isoformat(),
    }
    s["dk-indopak-text"]["note"] = s["dk-indopak-text"]["note"].rstrip() + (
        " The same file is stored page by page and line by line (15-line IndoPak, 610 pages); "
        "the IndoPak page view follows those lines.")
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
