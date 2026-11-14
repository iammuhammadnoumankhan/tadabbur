#!/usr/bin/env python3
"""
Render Tadabbur's app icons (PNG) from HTML with a headless browser, so the
Arabic letter is drawn by a real Quran font. Dev-only; output is committed.

  pip install -r requirements-dev.txt && python -m playwright install chromium
  python3 scripts/make_icons.py
"""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
GREEN, GOLD = "#0f6b5c", "#d9a84e"

HTML = """<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Amiri+Quran&display=block" rel="stylesheet">
<style>
  html,body{{margin:0;width:{s}px;height:{s}px;background:transparent}}
  .bg{{width:{s}px;height:{s}px;border-radius:{r}px;background:{green};position:relative;overflow:hidden;
       display:grid;place-items:center}}
  .bg::after{{content:"";position:absolute;inset:0;border-radius:{r}px;
       background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.14),transparent 60%)}}
  .g{{font-family:"Amiri Quran";color:#fff;font-size:{fs}px;line-height:1;transform:translateY({dy}px)}}
  .dot{{position:absolute;width:{d}px;height:{d}px;border-radius:50%;background:{gold};left:{dx}px;top:{dt}px}}
</style></head><body><div class="bg"><span class="g">ت</span><span class="dot"></span></div></body></html>"""


def render(page, size, maskable, name):
    # maskable icons: full-bleed square, artwork kept inside the central 80% "safe zone"
    radius = 0 if maskable else round(size * 0.22)
    scale = 0.72 if maskable else 0.9
    html = HTML.format(s=size, r=radius, green=GREEN, gold=GOLD, fs=round(size * 0.62 * scale),
                       dy=round(-size * 0.15 * scale), d=round(size * 0.08 * scale),
                       dx=round(size * (0.5 + 0.2 * scale)), dt=round(size * (0.5 - 0.34 * scale)))
    page.set_viewport_size({"width": size, "height": size})
    page.set_content(html, wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.screenshot(path=os.path.join(OUT, name), omit_background=True)
    print("wrote icons/" + name)


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        for size in (192, 512):
            render(page, size, False, f"icon-{size}.png")
            render(page, size, True, f"icon-maskable-{size}.png")
        render(page, 180, True, "apple-touch-icon.png")    # iOS rounds corners itself
        render(page, 32, False, "favicon-32.png")
        b.close()


if __name__ == "__main__":
    main()
