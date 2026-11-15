#!/usr/bin/env python3
"""
Build the "most frequent words" list for Tadabbur.

- A "word" here is a dictionary form (lemma) + root from the Quranic Arabic Corpus
  (data/morph/*.json, built by build_roots.py), counted over all 77,429 words.
- Meanings are the most common word-by-word glosses Quran.com gives for that lemma's
  occurrences (data/surah/*.json), shown as published, with how often each is used.
- Coverage numbers are simple counts: occurrences of a lemma / all words.

Output: data/vocab.json (see docs/DATA.md). Run after build_roots.py.
"""
import collections, datetime, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def main():
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    count = collections.Counter()
    pos = collections.defaultdict(collections.Counter)
    gloss = {"en": collections.defaultdict(collections.Counter), "ur": collections.defaultdict(collections.Counter)}
    first = {}
    total = 0
    for c in chapters:
        n = c["n"]
        morph = json.load(open(os.path.join(DATA, "morph", f"{n:03d}.json"), encoding="utf-8"))["ayahs"]
        words = json.load(open(os.path.join(DATA, "surah", f"{n:03d}.json"), encoding="utf-8"))["ayahs"]
        for ai, (mrow, a) in enumerate(zip(morph, words)):
            for wi, (e, w) in enumerate(zip(mrow, a["w"])):
                total += 1
                if not e or not e[1]:
                    continue
                key = f"{e[1]}|{e[0] or ''}"
                count[key] += 1
                pos[key][e[2]] += 1
                first.setdefault(key, f"{n}:{ai + 1}:{wi + 1}")
                for lang in ("en", "ur"):
                    g = (w.get(lang) or "").strip()
                    if g:
                        gloss[lang][key][g] += 1

    items = []
    for key, n in count.most_common():
        lemma, root = key.split("|")
        items.append({
            "k": key, "l": lemma, "r": root or None, "p": pos[key].most_common(1)[0][0], "n": n,
            "en": gloss["en"][key].most_common(3), "ur": gloss["ur"][key].most_common(3), "ex": first[key],
        })
    with open(os.path.join(DATA, "vocab.json"), "w", encoding="utf-8") as f:
        json.dump({"src": "qac-morphology", "total": total, "items": items}, f, ensure_ascii=False, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["tadabbur-vocab"] = {
        "title": "Most frequent words (word list and coverage)",
        "publisher": "Counted by Tadabbur from the Quranic Arabic Corpus (lemmas, roots) and Quran.com (word-by-word meanings)",
        "url": "https://corpus.quran.com/",
        "note": (f"Each dictionary form is counted over all {total:,} words of the Quran; {len(items):,} forms in total. "
                 "Meanings are the word-by-word glosses Quran.com gives for that form's occurrences, most used first, "
                 "shown as published. Coverage = occurrences / all words. Nothing here is written by us."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(items):,} dictionary forms over {total:,} words; top: " + ", ".join(f"{x['l']} {x['n']}" for x in items[:6]))


if __name__ == "__main__":
    main()
