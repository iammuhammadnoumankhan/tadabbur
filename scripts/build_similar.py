#!/usr/bin/env python3
"""
Build "similar wording" links for Tadabbur: ayahs that share an identical phrase of at least
MIN_WORDS consecutive words (mutashabihat lafziyya, useful for memorisers).

Computed only from the Quran text already in data/surah/*.json (Quran.com Uthmani words). No outside
source and no judgement: two ayahs are linked when the same words, in the same order, appear in both.
For matching only, harakat and Quranic marks are removed (and alif wasla read as alif); the text shown
on the site is never changed. Word positions refer to our word lists, so the shared words can be
highlighted exactly.

Output: data/similar/NNN.json -> { "s:a": [["other s:a", [[start, length, other start], …]], …] }
(only ayahs that share a phrase). Run after scripts/build_data.py.
"""
import datetime, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
MIN_WORDS = 5
MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def norm(word):
    return MARKS.sub("", word).replace("ٱ", "ا")


def common_runs(a, b):
    """Maximal common runs of >= MIN_WORDS words between word lists a and b: [(i, length, j)]."""
    L = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) - 1, -1, -1):
        for j in range(len(b) - 1, -1, -1):
            if a[i] == b[j]:
                L[i][j] = L[i + 1][j + 1] + 1
    out = []
    for i in range(len(a)):
        for j in range(len(b)):
            n = L[i][j]
            if n >= MIN_WORDS and not (i and j and a[i - 1] == b[j - 1]):   # start of a maximal run
                out.append((i, n, j))
    return out


def main():
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    chapters = chapters if isinstance(chapters, list) else chapters["chapters"]
    words, order = {}, []
    for c in chapters:
        for a in json.load(open(os.path.join(DATA, "surah", f"{c['n']:03d}.json"), encoding="utf-8"))["ayahs"]:
            words[a["k"]] = [norm(w["u"]) for w in a["w"]]
            order.append(a["k"])
    assert len(order) == 6236

    grams = {}
    for k in order:
        w = words[k]
        for i in range(len(w) - MIN_WORDS + 1):
            grams.setdefault(tuple(w[i:i + MIN_WORDS]), set()).add(k)
    pairs = set()
    for ks in grams.values():
        if len(ks) > 1:
            ks = sorted(ks, key=order.index)
            pairs |= {(x, y) for n, x in enumerate(ks) for y in ks[n + 1:]}

    links = {}
    for x, y in pairs:
        r = common_runs(words[x], words[y])
        assert r, (x, y)
        for i, n, j in r:
            assert words[x][i:i + n] == words[y][j:j + n]
        links.setdefault(x, []).append([y, [[i, n, j] for i, n, j in r]])
        links.setdefault(y, []).append([x, [[j, n, i] for i, n, j in r]])

    pos = {k: n for n, k in enumerate(order)}
    out_dir = os.path.join(DATA, "similar")
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    by_surah = {}
    for k, lst in links.items():
        lst.sort(key=lambda e: (-max(r[1] for r in e[1]), pos[e[0]]))   # longest shared phrase first
        by_surah.setdefault(int(k.split(":")[0]), {})[k] = lst
    for s, d in by_surah.items():
        d = dict(sorted(d.items(), key=lambda kv: pos[kv[0]]))
        with open(os.path.join(out_dir, f"{s:03d}.json"), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:    # surah -> ayahs with a match
        json.dump({str(s): len(d) for s, d in sorted(by_surah.items())}, f, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["tadabbur-similar"] = {
        "title": "Similar wording between ayahs",
        "publisher": "Computed by Tadabbur from the Quran text (Quran.com Uthmani words), with no outside source",
        "url": "https://github.com/iammuhammadnoumankhan/tadabbur/blob/main/scripts/build_similar.py",
        "note": (f"Two ayahs are linked when they share the same {MIN_WORDS} or more consecutive words, in the same order. "
                 "For matching only, harakat and Quranic marks are ignored and alif wasla is read as alif; the text is shown "
                 f"unchanged. {len(pairs)} pairs of ayahs, {len(links)} ayahs. Shorter refrains (under {MIN_WORDS} words) are not included."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    longest = max((max(r[1] for r in e[1]), k, e[0]) for k, lst in links.items() for e in lst)
    print(f"{len(pairs)} pairs, {len(links)} ayahs, {len(by_surah)} surah files; longest shared run {longest}")


if __name__ == "__main__":
    main()
