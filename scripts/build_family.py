#!/usr/bin/env python3
"""
Build the prophets' family links for Tadabbur, using ONLY relations the Quranic Arabic Corpus
ontology states in its knowledge base: (son-of X Y), (daughter-of X Y), (adopted-son-of X Y).

Starting from every prophet in data/stories.json, it follows those relations to relatives
(e.g. Azar, Maryam, Imran) and records names (English + Arabic) as the ontology gives them.
Nothing is inferred (no siblings or grandparents are added): the page draws what is stated.

Output: data/family.json -> { src, people: {id: {en, ar, prophet}}, links: [[rel, child, parent], …] }
Run after build_stories.py.
"""
import datetime, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_stories import get, text  # noqa: E402  (same cached, polite fetching)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FAMILY = ("son-of", "daughter-of", "adopted-son-of")
REL = re.compile(r"\(([a-z-]+) ([a-z-]+) ([a-z-]+) \)")


def concept(cid):
    raw = get(f"/concept.jsp?id={cid}", f"concept_{cid}.html")
    t = text(raw)
    m = re.search(r"<title>\s*(.*?)\s+-\s+Ontology", raw)
    en = html.unescape(m.group(1)).strip() if m else cid
    ar = re.search(rf"{re.escape(en)} \(\s*([^)]+?)\s*\)", t)
    rels = [r for r in REL.findall(t) if r[0] in FAMILY]
    return en, (ar.group(1) if ar else ""), rels


def main():
    st = json.load(open(os.path.join(DATA, "stories.json"), encoding="utf-8"))
    prophets = {p["id"]: p for p in st["prophets"]}
    people, links = {}, set()
    todo, seen = list(prophets), set()
    while todo:
        cid = todo.pop()
        if cid in seen:
            continue
        seen.add(cid)
        en, ar, rels = concept(cid)
        p = prophets.get(cid)
        people[cid] = {"en": p["en"] if p else en, "ar": p["ar"] if p else ar, "prophet": bool(p)}
        for rel, a, b in rels:
            if cid not in (a, b):
                continue                                  # only relations about this person
            links.add((rel, a, b))
            for other in (a, b):
                if other not in seen:
                    todo.append(other)
    out = {"src": "qac-ontology", "people": dict(sorted(people.items())),
           "links": sorted(list(l) for l in links)}
    with open(os.path.join(DATA, "family.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    s["qac-ontology"]["note"] = s["qac-ontology"]["note"].split(" Family links:")[0] + (
        f" Family links: only the ontology's stated son-of / daughter-of / adopted-son-of relations "
        f"({len(out['links'])} links, {len(people)} people); nothing is inferred.")
    s["qac-ontology"]["fetched"] = datetime.date.today().isoformat()
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
    for l in out["links"]:
        print(f"  {people[l[1]]['en']} — {l[0]} — {people[l[2]]['en']}")
    print(f"{len(out['links'])} links among {len(people)} people")


if __name__ == "__main__":
    main()
