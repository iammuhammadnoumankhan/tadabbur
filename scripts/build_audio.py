#!/usr/bin/env python3
"""
Build recitation timings for Tadabbur (word-by-word highlighting while listening).

Source: Quran.com's audio service (api.qurancdn.com, "qdc" recitations). For each reciter and
surah: the full-surah audio file URL, each ayah's start/end time, and each word's start/end time.
Audio itself is streamed from Quran.com's audio host (download.quranicaudio.com), not bundled.

Word numbers are Quran.com's word positions, the same as data/surah/NNN.json -> w. Entries with
a missing time (or ending before they start) are dropped; repeated words (a reciter going back) are kept, as recited.

Output: data/audio/reciters.json and data/audio/<reciter id>/NNN.json (see docs/DATA.md).
"""
import datetime, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, ".cache", "audio")
API = "https://api.qurancdn.com/api/qdc/audio/reciters/{rid}/audio_files?chapter={n}&segments=true"

# Quran.com recitation ids. Default first.
RECITERS = [
    (7, "Mishary Rashid al-Afasy", "Murattal"),
    (6, "Mahmoud Khalil Al-Husary", "Murattal"),
    (12, "Mahmoud Khalil Al-Husary", "Muallim, for learners"),
    (2, "AbdulBaset AbdulSamad", "Murattal"),
    (9, "Mohamed Siddiq al-Minshawi", "Murattal"),
    (3, "Abdur-Rahman as-Sudais", "Murattal"),
]


def fetch(rid, n):
    p = os.path.join(CACHE, str(rid), f"{n:03d}.json")
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        for i in range(4):
            try:
                req = urllib.request.Request(API.format(rid=rid, n=n), headers={"User-Agent": "tadabbur-data-builder/1.0"})
                with urllib.request.urlopen(req, timeout=60) as r, open(p, "wb") as f:
                    f.write(r.read())
                break
            except Exception as e:  # noqa: BLE001
                print(f"  retry {rid}/{n}: {e}", file=sys.stderr)
                time.sleep(2 ** i)
    return json.load(open(p, encoding="utf-8"))["audio_files"][0]


def main():
    chapters = json.load(open(os.path.join(DATA, "chapters.json"), encoding="utf-8"))
    words = {}
    for c in chapters:
        for a in json.load(open(os.path.join(DATA, "surah", f"{c['n']:03d}.json"), encoding="utf-8"))["ayahs"]:
            words[a["k"]] = len(a["w"])

    meta, stats = [], {}
    for rid, name, style in RECITERS:
        jobs = [c["n"] for c in chapters]
        with ThreadPoolExecutor(6) as ex:
            files = dict(zip(jobs, ex.map(lambda n: fetch(rid, n), jobs)))
        dropped = timed = 0
        for c in chapters:
            n, f = c["n"], files[c["n"]]
            vt = f["verse_timings"]
            assert len(vt) == c["ayahs"], (rid, n, len(vt))
            ayahs = []
            for i, v in enumerate(vt):
                assert v["verse_key"] == f"{n}:{i + 1}", (rid, v["verse_key"])
                segs = []
                for s in v.get("segments") or []:
                    if len(s) < 3 or s[1] is None or s[2] is None or s[2] < s[1] \
                            or not 1 <= int(s[0]) <= words[v["verse_key"]]:
                        dropped += 1
                        continue
                    segs.append([int(s[0]), int(round(s[1])), int(round(s[2]))])
                timed += len(segs)
                ayahs.append([int(v["timestamp_from"]), int(v["timestamp_to"]), segs])
            os.makedirs(os.path.join(DATA, "audio", str(rid)), exist_ok=True)
            with open(os.path.join(DATA, "audio", str(rid), f"{n:03d}.json"), "w", encoding="utf-8") as out:
                json.dump({"src": f"qc-audio-{rid}", "url": f["audio_url"], "ms": int(f.get("duration") or 0), "ayahs": ayahs},
                          out, separators=(",", ":"))
        meta.append({"id": rid, "name": name, "style": style, "src": f"qc-audio-{rid}"})
        stats[rid] = (timed, dropped)
        print(f"  {rid} {name} ({style}): {timed:,} word timings, {dropped} incomplete entries skipped")

    with open(os.path.join(DATA, "audio", "reciters.json"), "w", encoding="utf-8") as f:
        json.dump({"default": RECITERS[0][0], "list": meta}, f, ensure_ascii=False, separators=(",", ":"))

    sp = os.path.join(DATA, "sources.json")
    s = json.load(open(sp, encoding="utf-8"))
    for m in meta:
        timed, dropped = stats[m["id"]]
        s[m["src"]] = {
            "title": f"Recitation — {m['name']} ({m['style']}), with word timings",
            "publisher": "Quran.com (audio from download.quranicaudio.com)",
            "url": "https://quran.com",
            "via": API.format(rid=m["id"], n="{surah}"),
            "note": (f"Full-surah recitation streamed live; ayah and word start/end times bundled for highlighting "
                     f"({timed:,} word timings; {dropped} incomplete entries skipped). Repeated words are kept as recited."),
            "fetched": datetime.date.today().isoformat(),
        }
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
