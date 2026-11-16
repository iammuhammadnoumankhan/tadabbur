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
#  - Al-Baqarah, the longest surah, measures about 2.3-2.4 s locally after U4b (118 KB first file); CI machines
#    run a few percent slower, so it gets 2.8 s of headroom. It still fails if it gets slower than that.
#  - A first visit straight to a linked ayah gets the IndoPak Quran font (338 KB) after the text is drawn, and the
#    words rewrap once (layout shift 0.21-0.28). Waiting for the font instead would show the text ~1.5 s later
#    (tested: LCP 3.9 s), so text-first is kept, as Google recommends (font-display: swap). The font is cached
#    after the first visit (and by the offline service worker). Allowed CLS 0.3 until ROADMAP U4c (a fallback
#    font sized to match, tested on a real Android phone) brings it under 0.1.
EXCEPTIONS = {
    "surah.html?n=2": ({"lcp": 2800}, "longest surah; headroom for CI"),
    "surah.html?n=2#2:255": ({"lcp": 2800, "cls": 0.3}, "longest surah; first-visit IndoPak font swap, ROADMAP U4c"),
}
# (page, CSS selector to tap for the interaction check)
PAGES = [
    ("index.html", ".tabbar .tab:last-child"),
    ("surah.html?n=2", ".ayah .more-btn"),
    ("surah.html?n=1", ".ayah .more-btn"),
    ("surah.html?n=2#2:255", '[id="2:255"] .more-btn'),
    ("stories.html", ".tabbar .tab:last-child"),
    ("learn.html", ".tabbar .tab:last-child"),
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
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/"
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        def measure(path, tap_sel):
            ctx = browser.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
            ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
            ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
            ctx.add_init_script(OBSERVE)
            page = ctx.new_page()
            cdp = ctx.new_cdp_session(page)
            cdp.send("Network.enable")
            cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150,
                     "downloadThroughput": 1.6 * 1024 * 1024 / 8, "uploadThroughput": 750 * 1024 / 8})
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
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

        for path, tap_sel in PAGES:
            override, why = EXCEPTIONS.get(path, ({}, ""))
            budget = {**BUDGET, **override}
            for run in range(1, RUNS + 1):
                m = measure(path, tap_sel)
                bad = [k for k in ("lcp", "cls", "tap", "nodes") if m[k] > budget[k]]
                if not bad:
                    break
            note = f"   (allowed {', '.join(f'{k} {v}' for k, v in override.items())}: {why})" if override else ""
            print(f"{'✓' if not bad else '✗'} {path:24} LCP {m['lcp']:6.0f} ms   CLS {m['cls']:.3f}   tap {m['tap']:4.0f} ms   "
                  f"{m['nodes']:6} elements   {m['kb']:5} KB" + (f"   over budget after {RUNS} runs: {', '.join(bad)} "
                  f"(LCP element {m.get('lcpEl')})" if bad else note))
            if bad:
                failures.append(path)
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
