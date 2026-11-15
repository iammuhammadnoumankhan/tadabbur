#!/usr/bin/env python3
"""
Validate Tadabbur's data before it is deployed (run locally and in CI).

Fails (exit 1) if:
  - any JSON file doesn't parse;
  - the Quran isn't complete: 114 surahs, 6,236 ayahs, everywhere it should be;
  - any ayah's Arabic text no longer matches its stored SHA-256 fingerprint
    (Uthmani in checksums.json, IndoPak in checksums-indopak.json);
  - IndoPak words don't line up 1:1 with the word-by-word list;
  - any record points at a source id that isn't in data/sources.json, or a
    source entry is missing its title, publisher, URL or retrieval date;
  - any hadith, Seerah or prophet link points to an ayah that doesn't exist;
  - the search index differs from the translations it was packed from.

Usage: python3 scripts/validate_data.py
"""
import glob, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SCHEMA = 1          # must match scripts/build_manifest.py, js/core/data.js and docs/DATA.md
errors, notes = [], []


def err(msg):
    errors.append(msg)


def load(rel):
    try:
        with open(os.path.join(DATA, rel), encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        err(f"{rel}: cannot read JSON ({e})")
        return None


def sha16(s):
    return hashlib.sha256(s.encode()).hexdigest()[:16]


def main():
    # 0. every JSON file parses
    for p in glob.glob(os.path.join(DATA, "**", "*.json"), recursive=True):
        load(os.path.relpath(p, DATA))
    if errors:
        return

    sources = load("sources.json")
    for sid, s in sources.items():
        for field in ("title", "publisher", "url", "fetched"):
            if not s.get(field):
                err(f"sources.json: '{sid}' has no {field}")

    def need_src(sid, where):
        if sid not in sources:
            err(f"{where}: source id '{sid}' is not in sources.json")

    # 1. chapters
    chs = load("chapters.json")
    if len(chs) != 114 or [c["n"] for c in chs] != list(range(1, 115)):
        err("chapters.json: must list surahs 1–114 in order")
    if sum(c["ayahs"] for c in chs) != 6236:
        err("chapters.json: ayah counts must add up to 6,236")
    if sorted(c["order"] for c in chs) != list(range(1, 115)):
        err("chapters.json: revelation order must be 1–114 with no repeats")
    for c in chs:
        need_src(c["src"], f"chapters.json surah {c['n']}")
    count = {c["n"]: c["ayahs"] for c in chs}

    def valid_key(k):
        try:
            s, a = map(int, k.split(":"))
            return s in count and 1 <= a <= count[s]
        except ValueError:
            return False

    # 2. Quran text, word-by-word, IndoPak, fingerprints
    sums = load("checksums.json")
    sums_ip = load("checksums-indopak.json")
    words_per_ayah = {}
    for c in chs:
        n, rel = c["n"], f"surah/{c['n']:03d}.json"
        d = load(rel)
        if d is None:
            continue
        for sid in d["src"].values():
            need_src(sid, rel)
        ayahs = d["ayahs"]
        if len(ayahs) != count[n]:
            err(f"{rel}: {len(ayahs)} ayahs, expected {count[n]}")
            continue
        for i, a in enumerate(ayahs):
            if a["k"] != f"{n}:{i + 1}":
                err(f"{rel}: ayah {i + 1} has key {a['k']}")
            if not a["w"]:
                err(f"{rel}: {a['k']} has no words")
            words_per_ayah[a["k"]] = len(a["w"])
        got = [sha16(a["u"]) for a in ayahs]
        if got != sums.get(str(n)):
            bad = [ayahs[i]["k"] for i, (x, y) in enumerate(zip(got, sums.get(str(n), []))) if x != y]
            err(f"{rel}: Arabic (Uthmani) text changed — fingerprint mismatch at {bad[:5] or 'ayah count'}")

        ip_rel = f"indopak/{n:03d}.json"
        ip = load(ip_rel)
        if ip is None:
            continue
        need_src(ip["src"], ip_rel)
        if len(ip["ayahs"]) != count[n]:
            err(f"{ip_rel}: {len(ip['ayahs'])} ayahs, expected {count[n]}")
            continue
        for i, w in enumerate(ip["ayahs"]):
            if len(w) != len(ayahs[i]["w"]):
                err(f"{ip_rel}: {n}:{i + 1} has {len(w)} words but word-by-word has {len(ayahs[i]['w'])}")
        if [sha16(" ".join(w)) for w in ip["ayahs"]] != sums_ip.get(str(n)):
            err(f"{ip_rel}: IndoPak text changed — fingerprint mismatch")

    # 3. translations
    trs = load("translations.json")
    for t in trs["list"]:
        need_src(t["src"], f"translations.json {t['id']}")
        empty = 0
        for c in chs:
            rel = f"tr/{t['id']}/{c['n']:03d}.json"
            d = load(rel)
            if d is None:
                continue
            if len(d) != count[c["n"]]:
                err(f"{rel}: {len(d)} ayahs, expected {count[c['n']]}")
            empty += sum(1 for x in d if not (x or "").strip())
        if empty:
            notes.append(f"translation {t['id']} ({t['name']}): {empty} ayah(s) empty in the source")
    for i in trs["default"]:
        if i not in {t["id"] for t in trs["list"]}:
            err(f"translations.json: default {i} isn't in the list")

    # 4. surah introductions, tafsir list
    for c in chs:
        rel = f"info/{c['n']:03d}.json"
        d = load(rel)
        if d:
            need_src(d["src"], rel)
            for lang in ("en", "ur"):
                if not (d.get(lang) or {}).get("html"):
                    err(f"{rel}: missing {lang} introduction")
    taf = load("tafsirs.json")
    for t in taf["list"]:
        need_src(t["src"], f"tafsirs.json {t['id']}")

    # 5. hadith links
    need_src("sahih-hadith-text", "hadith")
    idx = load("hadith-index.json")
    for s, by_ayah in idx.items():
        recs = load(f"hadith/{int(s):03d}.json") or []
        for k, n in by_ayah.items():
            if not valid_key(k):
                err(f"hadith-index.json: invalid ayah {k}")
            if n != sum(1 for r in recs if k in r["refs"]):
                err(f"hadith-index.json: count for {k} doesn't match hadith/{int(s):03d}.json")
        for r in recs:
            if r["c"] not in ("bukhari", "muslim"):
                err(f"hadith/{int(s):03d}.json: collection '{r['c']}' is not Sahih al-Bukhari or Sahih Muslim")
            for k in r["refs"]:
                if not valid_key(k):
                    err(f"hadith/{int(s):03d}.json: Bukhari {r['num']} cites invalid ayah {k}")

    # 6. Seerah
    se = load("seerah.json")
    need_src(se["src"], "seerah.json")
    need_src("seerah-timeline", "seerah.json")
    for e in se["events"]:
        recs = load(f"seerah/{e['id']}.json")
        if recs is not None and len(recs) != e["count"]:
            err(f"seerah/{e['id']}.json: {len(recs)} hadith, index says {e['count']}")
        for k in e["refs"]:
            if not valid_key(k):
                err(f"seerah.json: event {e['id']} cites invalid ayah {k}")
    for a in se["anchors"]:
        if not 0 <= a["year"] <= se["frame"]["years"]:
            err(f"seerah.json: anchor {a['id']} year {a['year']} outside the frame")

    # 7. prophets
    st = load("stories.json")
    need_src(st["src"], "stories.json")
    for p in st["prophets"]:
        for m in p["mentions"]:
            if not valid_key(m["k"]):
                err(f"stories.json: {p['id']} cites invalid ayah {m['k']}")
            elif not 1 <= m["w"] <= words_per_ayah.get(m["k"], 0):
                err(f"stories.json: {p['id']} {m['k']} word {m['w']} doesn't exist")
        if p["ayahs"] != len({m["k"] for m in p["mentions"]}):
            err(f"stories.json: {p['id']} ayah count is wrong")

    # 10. word roots (Quranic Arabic Corpus): aligned to our words; occurrences point at that root
    need_src("qac-morphology", "morph")
    morph = {}
    for c in chs:
        rel = f"morph/{c['n']:03d}.json"
        d = load(rel)
        if d is None:
            continue
        need_src(d["src"], rel)
        if len(d["ayahs"]) != count[c["n"]]:
            err(f"{rel}: {len(d['ayahs'])} ayahs, expected {count[c['n']]}")
            continue
        for i, row in enumerate(d["ayahs"]):
            k = f"{c['n']}:{i + 1}"
            if len(row) != words_per_ayah.get(k, -1):
                err(f"{rel}: {k} has {len(row)} words, word-by-word has {words_per_ayah.get(k)}")
            for e in row:
                if e is not None and (not isinstance(e, list) or len(e) != 4):
                    err(f"{rel}: {k} has a malformed entry {e!r}")
        morph[c["n"]] = d["ayahs"]
    rix = load("roots/index.json") or {"roots": []}
    total_with_root = sum(1 for rows in morph.values() for row in rows for e in row if e and e[0])
    if sum(r["n"] for r in rix["roots"]) != total_with_root:
        err("roots/index.json: occurrence counts don't add up to the words that have a root")
    for r in rix["roots"]:
        occ = load(f"roots/{r['id']}.json") or []
        if len(occ) != r["n"]:
            err(f"roots/{r['id']}.json: {len(occ)} occurrences, index says {r['n']}")
        for key in occ[:2000]:
            s, a, w = map(int, key.split(":"))
            rows = morph.get(s) or []
            e = rows[a - 1][w - 1] if a <= len(rows) and w <= len(rows[a - 1]) else None
            if not e or e[0] != r["r"]:
                err(f"roots/{r['id']}.json: {key} isn't a word with root {r['r']}")
                break

    # 9. manifest (docs/DATA.md): schema version and counts match the data
    man = load("manifest.json") or {}
    if man.get("schema") != SCHEMA:
        err(f"manifest.json: schema {man.get('schema')}, expected {SCHEMA} (see docs/DATA.md)")
    expect = {"surahs": 114, "ayahs": 6236, "words": sum(words_per_ayah.values()),
              "translations": len(trs["list"]), "tafsirs": len(taf["list"]),
              "seerah_events": len(se["events"]), "prophets": len(st["prophets"]), "roots": len(rix["roots"])}
    for k, v in expect.items():
        if (man.get("counts") or {}).get(k) != v:
            err(f"manifest.json: counts.{k} is {(man.get('counts') or {}).get(k)}, data has {v} — rerun scripts/build_manifest.py")
    for ds in man.get("datasets", []):
        for sid in ds["src"]:
            need_src(sid, f"manifest.json dataset {ds['id']}")

    # 8. search index = translations, re-packed
    ar = load("search/ar.json")
    if ar is not None and len(ar) != 6236:
        err(f"search/ar.json: {len(ar)} ayahs, expected 6,236")
    need_src("qc-imlaei-simple", "search/ar.json")
    for t in trs["list"]:
        packed = load(f"search/tr-{t['id']}.json")
        if packed is None:
            continue
        flat = [x for c in chs for x in (load(f"tr/{t['id']}/{c['n']:03d}.json") or [])]
        if packed != flat:
            err(f"search/tr-{t['id']}.json: differs from data/tr/{t['id']} — rerun scripts/build_search.py")


if __name__ == "__main__":
    main()
    for n in notes:
        print(f"note: {n}")
    if errors:
        print(f"\n{len(errors)} problem(s) found:")
        for e in errors[:200]:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("✓ data is valid: 114 surahs, 6,236 ayahs, Arabic fingerprints match, every source is listed")
