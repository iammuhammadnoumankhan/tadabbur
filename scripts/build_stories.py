#!/usr/bin/env python3
"""
Build "Prophets in the Quran" data for Tadabbur from the Quranic Arabic Corpus
ontology (corpus.quran.com, University of Leeds, maintained by Quran.com; GNU GPL).

- Who is included: every concept the ontology places in its "Prophet" or
  "Messenger" category. We don't add or remove anyone.
- Name variants are grouped only where the ontology's knowledge base says
  (name-of X Y), e.g. Messiah -> Jesus, Ahmad -> Muhammad, Israel -> Yaqub.
- Mentions are the ontology's own word-level tags (surah:ayah:word). They mark
  references to the person, usually the name itself (sometimes a reference like 80:1).
- One filter of ours, stated in the data: for the name "Israel" we keep only
  mentions not written as "Bani Isra'il" (Children of Israel), which names the
  people rather than Yaqub himself.

Output: data/stories.json. Run after scripts/build_data.py.
"""
import html, json, os, re, time, urllib.request, unicodedata, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "corpus")
BASE = "https://corpus.quran.com"


def get(path, name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "tadabbur-data-builder/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(p, "wb") as f:
            f.write(r.read())
        time.sleep(0.5)                      # be polite to the corpus server
    return open(p, encoding="utf-8", errors="ignore").read()


def text(h):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h)))


def category(cid):
    t = text(get(f"/concept.jsp?id={cid}", f"concept_{cid}.html"))
    m = re.search(r"There are \d+ concepts in this category: (.*?) Visual Concept Map", t)
    return re.findall(r"([A-Z][\w'-]*(?: [A-Z][\w'-]*)?) \( ([^)]+?) \)", m.group(1))


def concept(cid):
    raw = get(f"/concept.jsp?id={cid}", f"concept_{cid}.html")
    t = text(raw)
    rels = re.findall(r"\(([a-z-]+) ([a-z-]+) ([a-z-]+) \)", t)
    return rels


def mentions(cid):
    out, page = [], 1
    while True:
        raw = get(f"/search.jsp?q=con%3A{cid}&s=1&page={page}", f"search_{cid}_{page}.html")
        t = text(raw)
        m = re.search(r"Results (\d+) to (\d+) of (\d+)", t)
        if not m:
            return out
        out += [tuple(map(int, x)) for x in re.findall(r"\((\d+):(\d+):(\d+)\)", raw)]
        if int(m.group(2)) >= int(m.group(3)):
            return sorted(set(out))
        page += 1


def letters(s):
    return "".join(c for c in s if unicodedata.category(c) == "Lo")


def main():
    people = {}
    for cat in ("prophet", "messenger"):
        for en, ar in category(cat):
            cid = en.lower().replace(" ", "-")
            people.setdefault(cid, {"en": en, "ar": ar, "cats": []})["cats"].append(cat)

    rels = {cid: concept(cid) for cid in people}
    alias_of = {}                                        # messiah -> jesus …
    for cid, rs in rels.items():
        for p, s, o in rs:
            if p == "name-of" and s == cid and o in people:
                alias_of[cid] = o

    surah_cache = {}
    def word(s, a, w):
        if s not in surah_cache:
            surah_cache[s] = json.load(open(os.path.join(DATA, "surah", f"{s:03d}.json"), encoding="utf-8"))["ayahs"]
        ws = surah_cache[s][a - 1]["w"]
        return ws[w - 1]["u"] if 0 < w <= len(ws) else None, (ws[w - 2]["u"] if w >= 2 and w - 1 <= len(ws) else "")

    prophets = {}
    dropped_bani = 0
    unaligned = []
    for cid, info in people.items():
        main_id = alias_of.get(cid, cid)
        p = prophets.setdefault(main_id, {"id": main_id, "en": people[main_id]["en"], "ar": people[main_id]["ar"],
                                          "cats": sorted(set(people[main_id]["cats"])), "names": [], "relations": [],
                                          "mentions": []})
        p["names"].append({"id": cid, "en": info["en"], "ar": info["ar"]})
        for s, a, w in mentions(cid):
            wtext, prev = word(s, a, w)
            if wtext is None:
                unaligned.append(f"{s}:{a}:{w}")
                continue
            if cid == "israel" and re.search("بن[يىو]", letters(prev)):
                dropped_bani += 1                         # "Bani Isra'il" = the people, not Yaqub
                continue
            p["mentions"].append({"k": f"{s}:{a}", "w": w, "as": cid})
        for r in rels[cid]:
            if r[0] in ("son-of", "father-of", "brother-of", "wife-of", "mother-of", "daughter-of") and list(r) not in p["relations"]:
                p["relations"].append(list(r))

    names = {cid: v["en"] for cid, v in people.items()}
    out = []
    for p in prophets.values():
        p["mentions"].sort(key=lambda m: (tuple(map(int, m["k"].split(":"))), m["w"]))
        p["ayahs"] = len({m["k"] for m in p["mentions"]})
        p["surahs"] = sorted({int(m["k"].split(":")[0]) for m in p["mentions"]})
        p["url"] = f"{BASE}/concept.jsp?id={p['id']}"
        out.append(p)
    out.sort(key=lambda p: -p["ayahs"])
    # names for every concept that appears in a relation (e.g. maryam, azar)
    rel_ids = {x for p in out for r in p["relations"] for x in r[1:]}
    rel_names = {}
    for rid in rel_ids:
        if rid in names:
            rel_names[rid] = names[rid]
        else:
            raw = get(f"/concept.jsp?id={rid}", f"concept_{rid}.html")
            m = re.search(r"<title>\s*(.*?)\s+-\s+Ontology", raw)
            rel_names[rid] = html.unescape(m.group(1)).strip() if m else rid

    with open(os.path.join(DATA, "stories.json"), "w", encoding="utf-8") as f:
        json.dump({"src": "qac-ontology", "prophets": out, "names": rel_names,
                   "filtered": {"bani_israil": dropped_bani}, "unaligned": unaligned},
                  f, ensure_ascii=False, separators=(",", ":"))

    by_surah = {}
    for p in out:
        for s in p["surahs"]:
            by_surah.setdefault(s, []).append(p["id"])
    with open(os.path.join(DATA, "stories-by-surah.json"), "w") as f:
        json.dump(by_surah, f, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qac-ontology"] = {
        "title": "Prophets in the Quran (who, and which ayahs mention them)",
        "publisher": "Quranic Arabic Corpus: Ontology of Quranic Concepts (University of Leeds; maintained by Quran.com), GNU GPL",
        "url": f"{BASE}/concept.jsp?id=prophet",
        "note": (f"Includes every concept in the ontology's Prophet or Messenger categories ({len(out)}). Name variants grouped only "
                 f"where the ontology states (name-of …): {', '.join(f'{k} → {v}' for k, v in sorted(alias_of.items()))}. "
                 f"Mentions are the ontology's word-level tags of references to each person (usually the name). For 'Israel', {dropped_bani} mentions written as 'Bani Isra'il' "
                 "(the Children of Israel, i.e. the people) are left out of Yaqub's list."),
        "fetched": datetime.date.today().isoformat(),
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    for p in out:
        print(f"{p['en']:12} {p['ar']:10} {p['ayahs']:4} ayahs {len(p['surahs']):3} surahs  names={[n['id'] for n in p['names']]} rel={p['relations']}")
    print("aliases", alias_of, "| bani israil dropped", dropped_bani, "| unaligned", unaligned)


if __name__ == "__main__":
    main()
