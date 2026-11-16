#!/usr/bin/env python3
"""
Speed check on a slowed-down "budget phone" (U4; docs/UX_RESEARCH.md §1, §3.4).

Loads key pages in headless Chromium at 375px with the CPU slowed 4x and the network shaped like
Lighthouse's mobile profile ("slow 4G": 1.6 Mbps down, 750 kbps up, 150 ms latency), then measures:
  - LCP  (largest contentful paint)   budget 2,500 ms   (Google's "good" threshold)
  - CLS  (cumulative layout shift)    budget 0.1
  - tap  (one tap's input delay + processing + next paint, like INP) budget 200 ms
  - page elements and bytes downloaded (reported, with a ceiling on elements)
Fails (exit 1) when a budget is broken. Fonts from Google are blocked here so the result doesn't
depend on a third-party server; the page must still show text with fallback fonts.

Run:  python3 scripts/perf_test.py          (needs: pip install -r requirements-dev.txt)
"""
import functools, gzip, http.server, io, json, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUDGET = {"lcp": 2500, "cls": 0.1, "tap": 200, "nodes": 6000}
# Known limits, each with its reason (printed with the result):
#  - The surah reader shows the IndoPak Quran text only in its own font (CLAUDE.md rule 8: never a substitute
#    font). On a FIRST visit over slow 4G it waits for that font (338 KB), so the text appears later: about
#    2.7-3.8 s here. It WARNS above 4.0 s (the edge of Google's "needs improvement" range) and FAILS above 4.5 s,
#    so CI machines a few percent slower don't block deploys but a real slowdown does.
#    REPEAT visits (font and data cached) must meet the normal 2.5 s.
FIRST_VISIT_FONT = ({"lcp": 4500}, "first visit waits for the IndoPak Quran font, never a substitute (rule 8)")
WARN_LCP = 4000
EXCEPTIONS = {
    "surah.html?n=2": FIRST_VISIT_FONT,
    "surah.html?n=1": FIRST_VISIT_FONT,
    "surah.html?n=2#2:255": FIRST_VISIT_FONT,
}
# (page, CSS selector to tap for the interaction check, also measure a repeat visit?)
PAGES = [
    ("index.html", ".tabbar .tab:last-child", False),
    ("surah.html?n=2", ".ayah .more-btn", True),
    ("surah.html?n=1", ".ayah .more-btn", True),
    ("surah.html?n=2#2:255", '[id="2:255"] .more-btn', True),
    ("stories.html", ".tabbar .tab:last-child", False),
    ("learn.html", ".tabbar .tab:last-child", False),
]
RUNS = 3          # shared CI machines vary; a page passes if any of up to 3 runs is within budget
OBSERVE = """
window.__perf = { lcp: 0, cls: 0, tap: 0 };
new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.lcp = e.startTime;
  window.__perf.lcpEl = e.element ? (e.element.nodeName + '.' + (e.element.className || '')).slice(0, 40) : ''; } })
  .observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; })
  .observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.interactionId) window.__perf.tap = Math.max(window.__perf.tap, e.duration); })
  .observe({ type: 'event', buffered: true, durationThreshold: 16 });
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    """Serves files gzip-compressed, as GitHub Pages does, so sizes and timings are realistic."""
    def log_message(self, *a):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path) and "gzip" in self.headers.get("Accept-Encoding", "") and \
                path.endswith((".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt")):
            body = gzip.compress(open(path, "rb").read(), 6)
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Cache-Control", "max-age=600")         # as GitHub Pages sends
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def end_headers(self):
        if "Cache-Control" not in "".join(map(str, getattr(self, "_headers_buffer", []))):
            self.send_header("Cache-Control", "max-age=600")
        super().end_headers()


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/"
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        def measure(path, tap_sel, repeat=False):
            ctx = browser.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
            ctx.add_init_script(OBSERVE)
            page = ctx.new_page()
            cdp = ctx.new_cdp_session(page)
            cdp.send("Network.enable")
            cdp.send("Network.setCacheDisabled", {"cacheDisabled": False})
            # block Google Fonts with Chrome's own blocking (Playwright's request routing would turn the cache off)
            cdp.send("Network.setBlockedURLs", {"urls": ["*fonts.googleapis.com*", "*fonts.gstatic.com*"]})
            cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150,
                     "downloadThroughput": 1.6 * 1024 * 1024 / 8, "uploadThroughput": 750 * 1024 / 8})
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            if repeat:                                   # first visit fills the cache; measure the second
                page.goto(base + path, wait_until="load", timeout=120000)
                page.wait_for_timeout(3000)
                page.goto(base + "learn.html", wait_until="load", timeout=120000)
                page.evaluate("window.__perf = { lcp: 0, cls: 0, tap: 0 }")
            page.goto(base + path, wait_until="load", timeout=120000)
            page.wait_for_selector(tap_sel, timeout=60000)
            page.wait_for_timeout(1500)
            page.tap(tap_sel)
            page.wait_for_timeout(1200)
            m = page.evaluate("""() => ({ ...window.__perf,
                nodes: document.getElementsByTagName('*').length,
                kb: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024)
                    + Math.round((performance.getEntriesByType('navigation')[0]?.transferSize || 0) / 1024) })""")
            ctx.close()
            return m

        def check(label, path, tap_sel, budget, note_if_ok, repeat=False):
            for run in range(1, RUNS + 1):
                m = measure(path, tap_sel, repeat)
                bad = [k for k in ("lcp", "cls", "tap", "nodes") if m[k] > budget[k]]
                if not bad:
                    break
            warn = not bad and m["lcp"] > WARN_LCP
            print(f"{'✗' if bad else '⚠' if warn else '✓'} {label:30} LCP {m['lcp']:6.0f} ms   CLS {m['cls']:.3f}   tap {m['tap']:4.0f} ms   "
                  f"{m['nodes']:6} elements   {m['kb']:5} KB" + (f"   over budget after {RUNS} runs: {', '.join(bad)} "
                  f"(LCP element {m.get('lcpEl')})" if bad else note_if_ok))
            if bad:
                failures.append(label)

        for path, tap_sel, repeat in PAGES:
            override, why = EXCEPTIONS.get(path, ({}, ""))
            note = f"   (allowed {', '.join(f'{k} {v}' for k, v in override.items())}: {why})" if override else ""
            check(path, path, tap_sel, {**BUDGET, **override}, note)
            if repeat:
                check(f"{path} (repeat visit)", path, tap_sel, BUDGET, "", repeat=True)
        browser.close()
    srv.shutdown()
    print(f"\nbudgets: LCP ≤ {BUDGET['lcp']} ms, CLS ≤ {BUDGET['cls']}, tap ≤ {BUDGET['tap']} ms, ≤ {BUDGET['nodes']} elements "
          "(375px, 4× slower CPU, slow 4G)")
    if failures:
        print(f"✗ {len(failures)} page(s) over budget")
        sys.exit(1)
    print("✓ all pages within budget")


if __name__ == "__main__":
    main()
