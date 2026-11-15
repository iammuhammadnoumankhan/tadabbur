#!/usr/bin/env python3
"""
Build "Places in the Quran" for Tadabbur.

- Which places: every concept the Quranic Arabic Corpus ontology (corpus.quran.com, GNU GPL) lists as a
  City, Historic Land, Mountain or Mosque (places mentioned by name in the Quran). We add or remove none.
- Which ayahs: the ontology's own word-level tags for each place. Name variants are merged only where the
  ontology states (name-of X Y), e.g. Bakkah -> Makkah, Yathrib -> Medinah.
- Where on the map: coordinates from Wikidata (CC0). Matching a Quranic place to a Wikidata item is a
  choice, so every choice is listed below (WIKIDATA) and shown in the UI with a link to the item.
  Places whose location our sources don't settle are left OFF the map (UNPLACED) and listed as such.
- Basemap: Natural Earth 1:50m land and rivers (public domain), clipped to the region and projected here,
  so the map works offline and needs no tile server.

Output: data/places.json. Run after scripts/build_data.py.
"""
import datetime, json, math, os, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_stories as corpus                       # cached Corpus fetching + mention parsing

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache")
UA = {"User-Agent": "tadabbur-data-builder/1.0 (static site data build)"}

CATEGORIES = {"city": "city", "historic-land": "land", "mountain": "mountain", "mosque": "mosque"}

# Quranic place (ontology id) -> Wikidata item whose coordinates we show.
WIKIDATA = {
    "makkah": "Q5806",            # Mecca
    "medinah": "Q35484",          # Medina
    "badr": "Q27256",             # Badr, Saudi Arabia
    "hunayn": "Q4502362",         # Hunayn, locality in Makkah Province
    "babylon": "Q5684",           # Babylon (archaeological site, Iraq)
    "egypt": "Q79",               # Egypt (region marker only)
    "sheba": "Q216068",           # Sheba (ancient South Arabian kingdom; region marker only)
    "al-safa": "Q900671",         # Safa and Marwa
    "al-marwah": "Q900671",
    "mount-arafat": "Q216894",    # Mount Arafat
    "kaaba": "Q29466",            # Kaaba
    "masjid-al-haram": "Q428858", # Masjid al-Haram
    "masjid-al-aqsa": "Q121610806",  # Al-Aqsa (the compound in Jerusalem)
}
REGIONS = {"egypt", "sheba"}      # a land, not a point: drawn as a soft region marker
UNPLACED = {"iram", "al-ahqaf", "al-judi", "mount-sinai"}   # location not settled by our sources: not drawn

BBOX = (24.0, 12.0, 50.0, 38.0)   # lon_min, lat_min, lon_max, lat_max
LAT0 = 25.0                       # equirectangular projection, scaled at this latitude
SCALE = 30.0                      # SVG units per degree of longitude (at LAT0)
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"


def fetch_json(url, name):
    p = os.path.join(CACHE, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if not os.path.exists(p):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(p, "wb") as f:
            f.write(r.read())
        time.sleep(1)
    return json.load(open(p, encoding="utf-8"))


def wikidata(qid):
    d = fetch_json(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", f"wikidata/{qid}.json")
    e = d["entities"][qid] if qid in d["entities"] else next(iter(d["entities"].values()))
    c = e["claims"]["P625"][0]["mainsnak"]["datavalue"]["value"]
    return {"label": e["labels"]["en"]["value"], "lat": round(c["latitude"], 4), "lon": round(c["longitude"], 4)}


# ---------------------------------------------------------------- basemap
def project(lon, lat):
    k = math.cos(math.radians(LAT0))
    return (lon - BBOX[0]) * SCALE, (BBOX[3] - lat) * SCALE / k


def clip_ring(ring):
    """Sutherland-Hodgman clip of one polygon ring to BBOX."""
    def clip(pts, inside, cut):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    x0, y0, x1, y1 = BBOX
    pts = [tuple(p[:2]) for p in ring]
    for inside, cut in ((lambda p: p[0] >= x0, at_x(x0)), (lambda p: p[0] <= x1, at_x(x1)),
                        (lambda p: p[1] >= y0, at_y(y0)), (lambda p: p[1] <= y1, at_y(y1))):
        if not pts:
            break
        pts = clip(pts, inside, cut)
    return pts


def path(points, closed):
    out, last = [], None
    for lon, lat in points:
        x, y = project(lon, lat)
        q = (round(x, 1), round(y, 1))
        if q != last:
            out.append(q)
            last = q
    if len(out) < (3 if closed else 2):
        return ""
    return "M" + "L".join(f"{x:g},{y:g}" for x, y in out) + ("Z" if closed else "")


def basemap():
    land = fetch_json(NE + "ne_50m_land.geojson", "naturalearth/ne_50m_land.geojson")
    rings = []
    for f in land["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            for ring in poly:
                d = path(clip_ring(ring), True)
                if d:
                    rings.append(d)
    rivers = fetch_json(NE + "ne_50m_rivers_lake_centerlines.geojson", "naturalearth/ne_50m_rivers.geojson")
    lines = []
    x0, y0, x1, y1 = BBOX
    for f in rivers["features"]:
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for part in parts:
            run = []
            for p in part + [None]:
                if p and x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
                    run.append(p)
                    continue
                d = path(run, False)
                if d:
                    lines.append(d)
                run = []
    w, h = project(BBOX[2], BBOX[1])
    return {"w": round(w), "h": round(h), "land": "".join(rings), "rivers": lines,
            "bbox": list(BBOX), "lat0": LAT0, "scale": SCALE}


# ---------------------------------------------------------------- places
def category(cid):
    """Concepts listed on an ontology category page (names may hold lowercase parts, e.g. 'Masjid al-Aqsa')."""
    t = corpus.text(corpus.get(f"/concept.jsp?id={cid}", f"concept_{cid}.html"))
    m = re.search(r"There are \d+ concepts in this category: (.*?) Visual Concept Map", t)
    found = re.findall(r"([A-Z][^()]*?) \( ([^)]+?) \)", m.group(1))
    n = int(re.search(r"There are (\d+) concepts in this category", t).group(1))
    assert len(found) == n, (cid, n, found)
    return found


def main():
    concepts = {}
    for cat, kind in CATEGORIES.items():
        for en, ar in category(cat):
            cid = en.lower().replace(" ", "-")
            concepts[cid] = {"en": en, "ar": ar, "type": kind}
    alias_of = {}
    for cid in concepts:
        for p, s, o in corpus.concept(cid):
            if p == "name-of" and s == cid and o in concepts:
                alias_of[cid] = o

    surahs = {}
    def word_ok(s, a, w):
        if s not in surahs:
            surahs[s] = json.load(open(os.path.join(DATA, "surah", f"{s:03d}.json"), encoding="utf-8"))["ayahs"]
        return 0 < w <= len(surahs[s][a - 1]["w"])

    places = {}
    for cid, info in concepts.items():
        main_id = alias_of.get(cid, cid)
        m = concepts[main_id]
        p = places.setdefault(main_id, {"id": main_id, "en": m["en"], "ar": m["ar"], "type": m["type"],
                                        "names": [], "mentions": []})
        p["names"].append({"id": cid, "en": info["en"], "ar": info["ar"]})
        for s, a, w in corpus.mentions(cid):
            assert word_ok(s, a, w), f"{cid}: {s}:{a}:{w} not in our word list"
            p["mentions"].append({"k": f"{s}:{a}", "w": w, "as": cid})

    assert set(WIKIDATA) | UNPLACED == set(places), \
        f"every place must be mapped or listed as unplaced: {set(places) ^ (set(WIKIDATA) | UNPLACED)}"
    out = []
    for p in places.values():
        p["mentions"].sort(key=lambda m: (tuple(map(int, m["k"].split(":"))), m["w"]))
        p["ayahs"] = len({m["k"] for m in p["mentions"]})
        p["url"] = f"https://corpus.quran.com/concept.jsp?id={p['id']}"
        if p["id"] in WIKIDATA:
            qid = WIKIDATA[p["id"]]
            wd = wikidata(qid)
            x0, y0, x1, y1 = BBOX
            assert x0 <= wd["lon"] <= x1 and y0 <= wd["lat"] <= y1, f"{p['id']} {wd} is outside the map"
            x, y = project(wd["lon"], wd["lat"])
            p["at"] = {"qid": qid, "label": wd["label"], "lat": wd["lat"], "lon": wd["lon"],
                       "x": round(x, 1), "y": round(y, 1), "region": p["id"] in REGIONS}
        else:
            p["at"] = None
        out.append(p)
    order = list(CATEGORIES.values())
    out.sort(key=lambda p: (order.index(p["type"]), -p["ayahs"], p["en"]))

    with open(os.path.join(DATA, "places.json"), "w", encoding="utf-8") as f:
        json.dump({"src": ["qac-ontology-places", "wikidata-places", "natural-earth"], "places": out, "map": basemap()},
                  f, ensure_ascii=False, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    today = datetime.date.today().isoformat()
    s["qac-ontology-places"] = {
        "title": "Places named in the Quran (which places, and which ayahs mention them)",
        "publisher": "Quranic Arabic Corpus: Ontology of Quranic Concepts (University of Leeds; maintained by Quran.com), GNU GPL",
        "url": "https://corpus.quran.com/concept.jsp?id=location",
        "note": (f"Every concept in the ontology's City, Historic Land, Mountain and Mosque categories ({len(out)} places). "
                 "Mentions are the ontology's word-level tags. Name variants merged only where the ontology states (name-of …): "
                 + ", ".join(f"{k} → {v}" for k, v in sorted(alias_of.items())) + "."),
        "fetched": today,
    }
    s["wikidata-places"] = {
        "title": "Map coordinates of places",
        "publisher": "Wikidata (Wikimedia Foundation), CC0 1.0",
        "url": "https://www.wikidata.org/",
        "note": ("Which Wikidata item stands for each Quranic place is our choice, listed on the map with a link to the item: "
                 + ", ".join(f"{k} → {v}" for k, v in sorted(WIKIDATA.items()))
                 + ". Egypt and Sheba are lands, shown as a region marker, not an exact point. "
                 "Not placed on the map, because our sources don't settle where they are: " + ", ".join(sorted(UNPLACED)) + "."),
        "fetched": today,
    }
    s["natural-earth"] = {
        "title": "Background map (land and rivers)",
        "publisher": "Natural Earth, 1:50m physical vectors, public domain",
        "url": "https://www.naturalearthdata.com/",
        "note": "Coastlines and rivers only, clipped to the region. No modern borders are drawn.",
        "fetched": today,
    }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))

    for p in out:
        at = p["at"]
        print(f"{p['type']:8} {p['en']:16} {p['ar']:18} {p['ayahs']:3} ayahs  names={[n['id'] for n in p['names']]}  "
              f"{(at['qid'], at['label'], at['lat'], at['lon']) if at else 'not placed'}")
    print("map", out and {k: v for k, v in json.load(open(os.path.join(DATA, 'places.json')))["map"].items() if k in ("w", "h")},
          f"{os.path.getsize(os.path.join(DATA, 'places.json')) // 1024} KB")


if __name__ == "__main__":
    main()
