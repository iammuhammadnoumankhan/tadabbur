#!/usr/bin/env python3
"""
Smoke-test every page of Tadabbur in a real (headless) browser.

For each page, at desktop and phone (375px) width, fails if:
  - the page throws a JavaScript error or logs a console error;
  - any of our own files fail to load (404 etc.);
  - the expected content doesn't appear (e.g. all 7 ayahs of Al-Fatihah);
  - the page scrolls sideways on a phone.

Third-party requests (fonts, audio, Quran.com API) are not required to succeed,
so the test doesn't depend on outside services.

Usage:
  pip install playwright && python -m playwright install --with-deps chromium
  python3 scripts/smoke_test.py
"""
import functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (path, CSS selector that must exist, minimum count)
PAGES = [
    ("index.html", ".s-card", 114),
    ("index.html", ".journey-bars a", 114),
    ("surah.html?n=1", ".ayah", 7),
    ("surah.html?n=2", ".ayah", 286),
    ("surah.html?n=114", ".ayah", 6),
    ("timeline.html", ".ev", 24),
    ("stories.html", ".p-card", 24),
    ("stories.html?p=musa", ".p-group", 34),
    ("search.html?q=%D8%B5%D8%A8%D8%B1", ".result", 10),
    ("search.html?q=2%3A255", ".jump", 1),
    ("sources.html", ".src-item", 20),
]
VIEWPORTS = {"desktop": {"width": 1280, "height": 900}, "phone": {"width": 375, "height": 812}}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # the browser closing a page mid-download isn't a test failure
        if not isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)):
            super().handle_error(request, client_address)


def main():
    httpd = Server(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/"
    failures = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vname, vp in VIEWPORTS.items():
            ctx = browser.new_context(viewport=vp)
            for path, selector, minimum in PAGES:
                page = ctx.new_page()
                problems = []
                page.on("pageerror", lambda e, pr=problems: pr.append(f"JS error: {e}"))
                page.on("console", lambda m, pr=problems: m.type == "error" and not _third_party_msg(m.text)
                        and pr.append(f"console error: {m.text}"))
                page.on("response", lambda r, pr=problems: r.url.startswith(base) and r.status >= 400
                        and pr.append(f"{r.status} for {r.url[len(base):]}"))
                try:
                    page.goto(base + path, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_function(
                        "([s, n]) => document.querySelectorAll(s).length >= n", arg=[selector, minimum], timeout=60000)
                except Exception as e:  # noqa: BLE001
                    found = page.evaluate("s => document.querySelectorAll(s).length", selector)
                    problems.append(f"expected at least {minimum} × '{selector}', found {found} ({type(e).__name__})")
                if vname == "phone":
                    sw, iw = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
                    if sw > iw + 1:
                        problems.append(f"scrolls sideways on a phone ({sw}px wide in a {iw}px screen)")
                status = "✓" if not problems else "✗"
                print(f"{status} [{vname}] {path}")
                for pr in problems:
                    print(f"    {pr}")
                    failures.append(f"[{vname}] {path}: {pr}")
                page.close()
            ctx.close()
        browser.close()
    httpd.shutdown()

    if failures:
        print(f"\n{len(failures)} problem(s)")
        sys.exit(1)
    print("\n✓ all pages load cleanly on desktop and phone")


def _third_party_msg(text):
    # Errors about outside services (fonts, audio, API) shouldn't fail our build.
    return any(h in text for h in ("fonts.g", "quran.com", "qurancdn", "islamic.network", "ERR_NAME_NOT_RESOLVED",
                                   "net::ERR_", "Failed to load resource"))


if __name__ == "__main__":
    main()
