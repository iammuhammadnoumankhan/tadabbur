#!/usr/bin/env python3
"""
Check that the outside sources Tadabbur relies on still respond.
Run weekly in CI (not on every push, so outside outages don't block deploys).

Checks:
  - every source URL in data/sources.json;
  - the live services the site calls at runtime: one tafsir request,
    one ayah audio file, one word audio file, and one sunnah.com hadith page.
"""
import json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "tadabbur-link-check/1.0 (+https://github.com/iammuhammadnoumankhan/tadabbur)"}

RUNTIME = {
    "tafsir API (Ibn Kathir, 1:1)": "https://api.quran.com/api/v4/tafsirs/169/by_ayah/1:1",
    "ayah audio (Alafasy, 1:1)": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
    "word audio (1:1 word 1)": "https://audio.qurancdn.com/wbw/001_001_001.mp3",
    "sunnah.com (Bukhari 3902)": "https://sunnah.com/bukhari:3902",
}


def ok(url):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                if r.status < 400:
                    return True, r.status
        except urllib.error.HTTPError as e:
            if method == "GET":
                return False, e.code
        except Exception as e:  # noqa: BLE001
            if method == "GET":
                return False, type(e).__name__
    return False, "?"


def main():
    sources = json.load(open(os.path.join(ROOT, "data", "sources.json"), encoding="utf-8"))
    urls = {}
    for sid, s in sources.items():
        urls.setdefault(s["url"], []).append(sid)
    checks = [(f"source: {', '.join(ids[:3])}{'…' if len(ids) > 3 else ''}", u) for u, ids in urls.items()]
    checks += list(RUNTIME.items())

    failed = 0
    for label, url in checks:
        good, status = ok(url)
        print(f"{'✓' if good else '✗'} {status}  {label}  {url}")
        failed += not good
    if failed:
        print(f"\n{failed} link(s) not responding")
        sys.exit(1)
    print("\n✓ all sources and live services respond")


if __name__ == "__main__":
    main()
