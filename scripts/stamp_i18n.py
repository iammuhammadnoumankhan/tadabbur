#!/usr/bin/env python3
"""
Copy the English interface text from js/i18n/en.js into the static HTML pages (U4).

Why: each page's static text (headings, labels, placeholders) is marked with data-i18n attributes and
filled by js/common.js. If the HTML starts empty, the page jumps when the text arrives (layout shift)
and shows nothing before the scripts load. Stamping the English text into the HTML fixes both, while
js/i18n/en.js stays the one place where interface text is written. The runtime still applies the
chosen language over it, so the Urdu interface (ROADMAP 20) works the same way.

  python3 scripts/stamp_i18n.py           rewrite the pages
  python3 scripts/stamp_i18n.py --check   exit 1 if any page is out of date (used by the smoke test)
"""
import glob, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_en():
    src = open(os.path.join(ROOT, "js", "i18n", "en.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'^\s*"([^"]+)":\s*("(?:[^"\\]|\\.)*")\s*,?\s*$', src, re.M):
        out[m.group(1)] = json.loads(m.group(2))              # JS double-quoted strings are valid JSON here
    return out


ELEM = re.compile(r'(<(\w+)\b([^>]*?)\sdata-i18n(-html)?="([^"]+)"([^>]*)>)(.*?)(</\2>)', re.S)
ATTR = re.compile(r'\sdata-i18n-(placeholder|title|aria-label)="([^"]+)"')


def stamp(page, en):
    def elem(m):
        key, is_html = m.group(5), bool(m.group(4))
        if key not in en:
            raise SystemExit(f"{os.path.basename(page)}: unknown key {key}")
        text = en[key] if is_html else html.escape(en[key], quote=False)
        return m.group(1) + text + m.group(8)

    def tag_attrs(tag):
        for kind, key in ATTR.findall(tag):
            if key not in en:
                raise SystemExit(f"{os.path.basename(page)}: unknown key {key}")
            value = html.escape(en[key], quote=True)
            if re.search(rf'\s{kind}="[^"]*"', tag):
                tag = re.sub(rf'(\s){kind}="[^"]*"', lambda mm: f'{mm.group(1)}{kind}="{value}"', tag, count=1)
            else:
                tag = tag[:-1] + f' {kind}="{value}">' if not tag.endswith("/>") else tag[:-2] + f' {kind}="{value}"/>'
        return tag

    s = open(page, encoding="utf-8").read()
    s = ELEM.sub(elem, s)
    s = re.sub(r"<[a-zA-Z][^<>]*\sdata-i18n-(?:placeholder|title|aria-label)=\"[^\"]+\"[^<>]*>", lambda m: tag_attrs(m.group(0)), s)
    return s


def main():
    en = load_en()
    check = "--check" in sys.argv
    stale = []
    for page in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        new = stamp(page, en)
        old = open(page, encoding="utf-8").read()
        if new != old:
            stale.append(os.path.basename(page))
            if not check:
                open(page, "w", encoding="utf-8").write(new)
    if check:
        if stale:
            print("pages need: python3 scripts/stamp_i18n.py  →  " + ", ".join(stale))
            sys.exit(1)
        print("✓ static page text matches js/i18n/en.js")
    else:
        print(f"stamped {len(stale)} page(s): {', '.join(stale) or 'none changed'}")


if __name__ == "__main__":
    main()
