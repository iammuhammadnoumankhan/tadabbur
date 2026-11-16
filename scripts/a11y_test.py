#!/usr/bin/env python3
"""
Accessibility check (U6; docs/UX_RESEARCH.md §3.7): WCAG 2.2 level A and AA, using axe-core.

Every page is checked at phone (375px) and desktop width, in the light and the dark theme, plus the panels
people open (the ayah "More" menu, Settings, a hadith panel, the phone "More" sheet). Fails (exit 1) on any
violation. axe-core (Deque, MPL-2.0) is vendored in scripts/vendor/ at a pinned version, so this test doesn't
depend on a third-party server; it is used only here and never published with the site.

Run:  python3 scripts/a11y_test.py          (needs: pip install -r requirements-dev.txt)
      python3 scripts/a11y_test.py --all    also list "best practice" findings (not failures)
"""
import functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXE = os.path.join(ROOT, "scripts", "vendor", "axe-4.14.1.min.js")
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
PAGES = ["index.html", "surah.html?n=1", "surah.html?n=2#2:255", "page.html?m=madani&p=3", "page.html?m=indopak&p=3",
         "progress.html", "timeline.html", "stories.html", "stories.html?p=musa", "places.html", "places.html?p=makkah",
         "search.html?q=%D8%B5%D8%A8%D8%B1", "root.html", "root.html?r=0", "learn.html", "sources.html"]
# (page, label, JavaScript that opens a panel) — checked with the panel open
PANELS = [
    ("surah.html?n=1", "ayah More menu", "document.querySelector('.ayah .more-btn').click()"),
    ("surah.html?n=1", "Settings", "document.getElementById('open-settings').click()"),
    ("surah.html?n=2", "hadith panel", "document.querySelector('.ayah .hadith-chip')?.click()"),
    ("index.html", "phone More sheet", "document.querySelector('.tabbar .tab:last-child').click()"),
    ("index.html", "first-visit setup", "void 0"),          # opens by itself on a first visit (U7)
]
# WCAG 2.5.8 (target size) has its own exceptions; these two are applied, with the reason:
#  - .journey-bars a, #tl-surahs .sbar: the 2px revelation-order bars (home, surah page, timeline) are a visual summary. Every surah they link to is also a
#    full-size link in the surah list ("Equivalent" exception).
#  - .m-w: words on the mushaf page are words inside lines of Quran text ("Inline" exception); tapping one only
#    shows its meaning, which the reader page also offers with large targets.
TARGET_SIZE_EXCEPTIONS = [".journey-bars a", "#tl-surahs .sbar", ".m-w"]
VIEWPORTS = {"phone": {"width": 375, "height": 812}, "desktop": {"width": 1280, "height": 900}}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    best = "--all" in sys.argv
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/"
    axe_src = open(AXE, encoding="utf-8").read()
    failures, seen = [], {}

    def audit(page, label):
        page.add_script_tag(content=axe_src)
        res = page.evaluate("""async ([tags, skip]) => {
            const fmt = v => ({ id: v.id, impact: v.impact, help: v.help,
              nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + (n.any[0]?.message ? ' :: ' + n.any[0].message : '')) });
            const all = await axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'target-size': { enabled: false } },
                                                  resultTypes: ['violations'] });
            const size = await axe.run({ include: [document], exclude: skip.map(s => [s]) },
                                       { runOnly: { type: 'rule', values: ['target-size'] }, resultTypes: ['violations'] });
            return [...all.violations, ...size.violations].map(fmt);
        }""", [TAGS, TARGET_SIZE_EXCEPTIONS])
        for v in res:
            key = (v["id"], label.split(" [")[0])
            if key in seen:
                continue
            seen[key] = True
            failures.append(f"{label}: {v['id']} ({v['impact']}) {v['help']}")
            print(f"✗ {label}: {v['id']} ({v['impact']}) — {v['help']}")
            for n in v["nodes"]:
                print(f"      {n[:180]}")
        return res

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vname, vp in VIEWPORTS.items():
            for theme in ("light", "dark"):
                ctx = browser.new_context(viewport=vp, color_scheme=theme)
                ctx.add_init_script(f'localStorage.setItem("tadabbur.settings", JSON.stringify({{theme: "{theme}"}}))')
                for path in PAGES:
                    page = ctx.new_page()
                    page.goto(base + path, wait_until="load")
                    page.wait_for_timeout(2500)
                    res = audit(page, f"{path} [{vname}, {theme}]")
                    if not res:
                        print(f"✓ {path} [{vname}, {theme}]")
                    page.close()
                for path, label, js in PANELS:
                    if label == "phone More sheet" and vname != "phone":
                        continue
                    page = ctx.new_page()
                    page.goto(base + path, wait_until="load")
                    page.wait_for_timeout(2500)
                    page.evaluate(js)
                    page.wait_for_timeout(900)
                    res = audit(page, f"{path} with {label} open [{vname}, {theme}]")
                    if not res:
                        print(f"✓ {path} with {label} open [{vname}, {theme}]")
                    page.close()
                ctx.close()
        if best:
            page = browser.new_page()
            page.goto(base + "surah.html?n=1", wait_until="load")
            page.wait_for_timeout(2000)
            page.add_script_tag(content=axe_src)
            for v in page.evaluate("async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['best-practice'] } })).violations.map(v => v.id + ': ' + v.help)"):
                print(f"  (best practice) {v}")
        browser.close()
    srv.shutdown()
    print()
    if failures:
        print(f"✗ {len(failures)} WCAG 2.2 AA problem(s) (each listed once)")
        sys.exit(1)
    print("✓ no WCAG 2.2 A/AA violations found by axe-core on any page, theme or width")


if __name__ == "__main__":
    main()
