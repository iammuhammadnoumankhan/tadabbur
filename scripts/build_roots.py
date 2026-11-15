#!/usr/bin/env python3
"""
Build word roots for Tadabbur from the Quranic Arabic Corpus morphology (v0.4).

Source: Quranic Arabic Corpus, University of Leeds (Kais Dukes), GNU GPL, corpus.quran.com.
The file is downloaded by the project owner from https://corpus.quran.com/download/ (the form
asks for a contact email) and saved as quranic-corpus-morphology-0.4.txt in the project root.
It is NOT committed. We don't edit it; we only read it and build an index, crediting and
linking the Corpus wherever it's shown (as its terms require).

Output (see docs/DATA.md):
  data/morph/NNN.json   per-ayah list of words: [root, lemma, pos, features], aligned 1:1 to surah/NNN.json words
  data/roots/index.json every root: { id, r, b (Buckwalter, for corpus.quran.com links), n (occurrences), l: [[lemma, count], …] }
  data/roots/<id>.json  every occurrence of one root: ["s:a:w", …]
"""
import collections, datetime, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CANDIDATES = [os.path.join(ROOT, "quranic-corpus-morphology-0.4.txt"),
              os.path.join(ROOT, ".cache", "corpus", "quranic-corpus-morphology-0.4.txt")]

# Extended Buckwalter transliteration used by the Quranic Arabic Corpus (corpus.quran.com/java/buckwalter.jsp)
BW = {
    "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا", "b": "ب", "p": "ة", "t": "ت",
    "v": "ث", "j": "ج", "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش",
    "S": "ص", "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "_": "ـ", "f": "ف", "q": "ق", "k": "ك",
    "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
    "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ", "~": "ّ",
    "o": "ْ", "^": "ٓ", "#": "ٔ", "`": "ٰ", "{": "ٱ",
    ":": "ۜ", "@": "۟", '"': "۠", "[": "ۢ", ";": "ۣ", ",": "ۥ", ".": "ۦ",
    "!": "ۨ", "-": "۪", "+": "۫", "%": "۬", "]": "ۭ",
}


def ar(bw):
    out = []
    for ch in bw:
        if ch not in BW:
            raise ValueError(f"unknown Buckwalter character {ch!r} in {bw!r}")
        out.append(BW[ch])
    return "".join(out)


# Reproduced as the Corpus terms require for derived works.
NOTICE = ("Quranic Arabic Corpus (morphology, version 0.4). Copyright (C) 2011 Kais Dukes. "
          "License: GNU General Public License. Source and updates: http://corpus.quran.com")

LINE = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)\t([^\t]*)\t([^\t]*)\t(.*)$")


def parse(path):
    """-> {(s, a, w): {"root", "lemma", "pos", "features"}} using each word's STEM segment."""
    words = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = LINE.match(line.rstrip("\n"))
            if not m:
                continue
            s, a, w, _seg = map(int, m.groups()[:4])
            tag, feats = m.group(6), m.group(7).split("|")
            entry = words.setdefault((s, a, w), {"root": None, "bw": None, "lemma": None, "pos": None, "features": []})
            if feats[0] != "STEM":
                continue
            entry["pos"] = tag
            for ft in feats[1:]:
                if ft.startswith("ROOT:"):
                    entry["root"], entry["bw"] = ar(ft[5:]), ft[5:]
                elif ft.startswith("LEM:"):
                    # the Corpus numbers homographs (e.g. EaAd2); same Arabic spelling, shown together
                    entry["lemma"] = ar(re.sub(r"\d+$", "", ft[4:]))
                elif ft.startswith("POS:"):
                    entry["pos"] = ft[4:]
                elif ft.startswith("VF:") or re.fullmatch(r"\((?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)", ft) \
                        or ft in ("PERF", "IMPF", "IMPV", "ACT", "PASS", "PCPL", "VN"):
                    entry["features"].append(ft)
    return words


def main():
    path = next((p for p in CANDIDATES if os.path.exists(p)), None)
    if not path:
        sys.exit("Corpus file not found. Download it from https://corpus.quran.com/download/ and save it as\n  "
                 + CANDIDATES[0])
    words = parse(path)
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))

    # align to our word lists (surah/NNN.json -> w) and write data/morph/NNN.json
    os.makedirs(os.path.join(DATA, "morph"), exist_ok=True)
    occ = collections.defaultdict(list)
    bw_of = {}
    lemmas = collections.defaultdict(collections.Counter)
    mismatched = []
    per_ayah = collections.Counter((s, a) for (s, a, _w) in words)
    for c in chapters:
        n = c["n"]
        ayahs = json.load(open(os.path.join(DATA, "surah", f"{n:03d}.json"), encoding="utf-8"))["ayahs"]
        out = []
        for a in ayahs:
            ours = len(a["w"])
            theirs = per_ayah[(n, a["n"])]
            if theirs != ours:
                mismatched.append(f"{a['k']} (corpus {theirs}, ours {ours})")
            row = []
            for wi in range(1, ours + 1):
                e = words.get((n, a["n"], wi))
                if not e:
                    row.append(None)
                    continue
                row.append([e["root"], e["lemma"], e["pos"], "|".join(e["features"])])
                if e["root"]:
                    occ[e["root"]].append(f"{n}:{a['n']}:{wi}")
                    bw_of[e["root"]] = e["bw"]
                    if e["lemma"]:
                        lemmas[e["root"]][e["lemma"]] += 1
            out.append(row)
        with open(os.path.join(DATA, "morph", f"{n:03d}.json"), "w", encoding="utf-8") as f:
            json.dump({"src": "qac-morphology", "ayahs": out}, f, ensure_ascii=False, separators=(",", ":"))
    if mismatched:
        sys.exit(f"Word counts differ from our word list in {len(mismatched)} ayahs, e.g. {mismatched[:10]}")

    # root index + one occurrence file per root (ids = position in Arabic alphabetical order)
    os.makedirs(os.path.join(DATA, "roots"), exist_ok=True)
    for old in glob.glob(os.path.join(DATA, "roots", "*.json")):
        os.remove(old)
    index = []
    for i, r in enumerate(sorted(occ)):
        index.append({"id": i, "r": r, "b": bw_of[r], "n": len(occ[r]), "l": lemmas[r].most_common()})
        with open(os.path.join(DATA, "roots", f"{i}.json"), "w", encoding="utf-8") as f:
            json.dump(occ[r], f, separators=(",", ":"))
    with open(os.path.join(DATA, "roots", "index.json"), "w", encoding="utf-8") as f:
        json.dump({"src": "qac-morphology", "notice": NOTICE, "roots": index}, f, ensure_ascii=False, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qac-morphology"] = {
        "title": "Word roots, lemmas and parts of speech",
        "publisher": "Quranic Arabic Corpus v0.4 (University of Leeds, Kais Dukes), GNU GPL",
        "url": "https://corpus.quran.com/",
        "via": "https://corpus.quran.com/download/ (morphology file, used unchanged)",
        "note": (f"Each word's root, lemma and part of speech, taken from the Corpus annotation and aligned 1:1 to our "
                 f"word list. {len(index)} roots, {sum(x['n'] for x in index):,} word occurrences with a root. "
                 "Arabic is converted from the Corpus's Buckwalter transliteration. Lemmas the Corpus tells apart only by a "
                 "number (homographs such as EaAd/EaAd2) share one Arabic spelling and are shown together. "
                 "Quranic Arabic Corpus (morphology, version 0.4), Copyright (C) 2011 Kais Dukes, GNU General Public License. "
                 "Browse any root on corpus.quran.com to compare."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    top = sorted(index, key=lambda x: -x["n"])[:8]
    print(f"{len(words):,} words parsed · {len(index)} roots · top: " + ", ".join(f"{x['r']} {x['n']}" for x in top))


if __name__ == "__main__":
    main()
