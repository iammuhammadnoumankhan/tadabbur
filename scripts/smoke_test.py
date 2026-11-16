#!/usr/bin/env python3
"""
Smoke-test every page of Tadabbur in a real (headless) browser.

For each page, at desktop and phone (375px) width, fails if:
  - the page throws a JavaScript error or logs a console error;
  - any of our own files fail to load (404 etc.);
  - the expected content doesn't appear (e.g. all 7 ayahs of Al-Fatihah);
  - the page scrolls sideways on a phone;
  - phones don't get the 5-tab bottom bar (or desktop doesn't get the top menu);
  - any interface text key is missing (shown as ⟦key⟧).
Also runs scripts/core_worker_test.js in a Web Worker to prove js/core works without a DOM.

Third-party requests (fonts, audio, Quran.com API) are not required to succeed,
so the test doesn't depend on outside services.

Usage:
  pip install playwright && python -m playwright install --with-deps chromium
  python3 scripts/smoke_test.py
"""
import functools, glob, http.server, os, re, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (path, CSS selector that must exist, minimum count)
PAGES = [
    ("index.html", ".s-card", 114),
    ("index.html", ".journey-bars a", 114),
    ("surah.html?n=1", ".ayah", 7),
    ("surah.html?n=2", ".ayah", 286),
    ("surah.html?n=114", ".ayah", 6),
    ("surah.html?n=2", ".sim-chip", 100),
    ("timeline.html", ".ev", 24),
    ("stories.html", ".p-card", 24),
    ("stories.html?p=musa", ".p-group", 34),
    ("stories.html", "button.ft-node", 23),
    ("search.html?q=%D8%B5%D8%A8%D8%B1", ".result", 10),
    ("search.html?q=2%3A255", ".jump", 1),
    ("sources.html", ".src-item", 20),
    ("root.html", ".r-card", 1000),
    ("root.html?r=0", ".result", 1),
    ("learn.html", ".v-row:not(.v-head)", 50),
    ("page.html?m=madani&p=3", ".m-line", 15),
    ("page.html?m=indopak&p=3", ".m-line", 15),
    ("progress.html", ".pr-card", 5),
    ("places.html", ".p-card", 17),
    ("places.html", ".pl-pin", 7),
    ("places.html?p=masjid-al-haram", ".p-ayah", 15),
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
                body = page.evaluate("document.body.innerText")
                if "⟦" in body:
                    problems.append("missing interface text: " + ", ".join(sorted(set(re.findall(r"⟦([^⟧]+)⟧", body)))))
                if vname == "phone":
                    sw, iw = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
                    if sw > iw + 1:
                        problems.append(f"scrolls sideways on a phone ({sw}px wide in a {iw}px screen)")
                # U3: each ayah shows at most 5 controls, icon buttons at least 44px; settings bar on one row on phones
                if path.startswith("surah.html"):
                    u3 = page.evaluate("""() => {
                      const head = document.querySelector('.ayah .ayah-head');
                      const ctrls = head ? [...head.querySelectorAll('button, a')] : [];
                      const icons = ctrls.filter(b => b.classList.contains('icon-btn')).map(b => b.getBoundingClientRect());
                      const tb = document.getElementById('toolbar');
                      return { ctrls: ctrls.length, smallIcons: icons.filter(r => r.width < 44 || r.height < 44).length,
                               more: !!head?.querySelector('.more-btn'), toolbarH: tb ? Math.round(tb.getBoundingClientRect().height) : 0 };
                    }""")
                    if u3["ctrls"] > 5 or u3["smallIcons"] or not u3["more"] or (vname == "phone" and u3["toolbarH"] > 80):
                        problems.append(f"ayah controls wrong: {u3}")
                # U2: on a phone the surah page starts reading on the first screen
                if vname == "phone" and path.startswith("surah.html"):
                    top, ih = page.evaluate("[document.querySelector('.ayah')?.getBoundingClientRect().top ?? 1e9, innerHeight]")
                    if top > ih - 120:
                        problems.append(f"first ayah starts at {round(top)}px, below the first screen ({ih}px)")
                # U1: phones get a 5-tab bar at the bottom (44px+ targets) instead of the top menu; desktop doesn't
                nav = page.evaluate("""() => {
                  const bar = document.querySelector('.tabbar');
                  const shown = el => el && getComputedStyle(el).display !== 'none';
                  const tabs = bar ? [...bar.querySelectorAll('.tab')].map(e => e.getBoundingClientRect()) : [];
                  return { bar: shown(bar), tabs: tabs.length, small: tabs.filter(r => r.width < 44 || r.height < 44).length,
                           atBottom: bar ? Math.abs(bar.getBoundingClientRect().bottom - innerHeight) < 2 : false,
                           topLinks: [...document.querySelectorAll('header .nav-link')].filter(shown).length };
                }""")
                if vname == "phone" and not (nav["bar"] and nav["tabs"] == 5 and not nav["small"] and nav["atBottom"] and nav["topLinks"] == 0):
                    problems.append(f"phone tab bar wrong: {nav}")
                if vname == "desktop" and (nav["bar"] or nav["topLinks"] < 9):
                    problems.append(f"desktop menu wrong: {nav}")
                status = "✓" if not problems else "✗"
                print(f"{status} [{vname}] {path}")
                for pr in problems:
                    print(f"    {pr}")
                    failures.append(f"[{vname}] {path}: {pr}")
                page.close()
            ctx.close()
        for name, ok, detail in static_checks():
            print(f"{'✓' if ok else '✗'} [files] {name}" + ("" if ok else f"  ({detail})"))
            if not ok:
                failures.append(f"[files] {name}: {detail}")

        # "Report" buttons open the pre-filled GitHub form
        page = browser.new_page()
        page.goto(base + "surah.html?n=1", wait_until="domcontentloaded")
        page.wait_for_selector(".ayah .more-btn")
        page.click(".ayah .more-btn")                      # Report is in the ayah's "More" menu (U3)
        page.wait_for_selector(".sheet.show a.sheet-item")
        href = page.get_attribute(".sheet.show a.sheet-item", "href")
        ok = all(s in href for s in ("/issues/new?", "template=content_report.yml", "reference=1%3A1", "kind=Translation"))
        print(f"{'✓' if ok else '✗'} [report] ayah Report button pre-fills the GitHub form" + ("" if ok else f"  ({href})"))
        if not ok:
            failures.append(f"[report] ayah link: {href}")
        page.close()

        # share card: the ayah is drawn into a 1080px-wide image, nothing blank, no errors
        page = browser.new_page()
        sc_errors = []
        page.on("pageerror", lambda e: sc_errors.append(str(e)))
        page.goto(base + "surah.html?n=112", wait_until="domcontentloaded")
        try:
            page.wait_for_selector('[id="112:1"] .more-btn')
            page.click('[id="112:1"] .more-btn')               # Share is in the ayah's "More" menu (U3)
            page.click('.sheet.show .sheet-item:has-text("Share this ayah as an image")')
            page.wait_for_selector(".share-preview")
            page.wait_for_timeout(1500)
            w, inked = page.evaluate("""() => {
                const c = document.querySelector('.share-preview');
                const d = c.getContext('2d').getImageData(0, c.height * 0.3, c.width, c.height * 0.4).data;
                let dark = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i+1] + d[i+2] < 300) dark++;
                return [c.width, dark];
            }""")
            ok, detail = w == 1080 and inked > 200 and not sc_errors, f"width {w}, inked pixels {inked}, errors {sc_errors[:2]}"
        except Exception as e:  # noqa: BLE001
            ok, detail = False, type(e).__name__
        print(f"{'✓' if ok else '✗'} [share] ayah card is drawn with text" + ("" if ok else f"  ({detail})"))
        if not ok:
            failures.append(f"[share] {detail}")
        page.close()

        # tajweed mode: coloured words + colour key, no missing text
        ctx = browser.new_context()
        ctx.add_init_script("localStorage.setItem('tadabbur.settings', JSON.stringify({script: 'tajweed'}))")
        page = ctx.new_page()
        tj_errors = []
        page.on("pageerror", lambda e: tj_errors.append(str(e)))
        page.goto(base + "surah.html?n=2", wait_until="domcontentloaded")
        try:
            page.wait_for_function("document.querySelectorAll('.ayah').length >= 286 && document.querySelectorAll('.w .tj').length > 1000", timeout=60000)
            keys = page.evaluate("document.querySelectorAll('#tajweed-key .tj-key-item').length")
            body = page.evaluate("document.body.innerText")
            ok = keys >= 18 and "⟦" not in body and not tj_errors
            detail = f"key items {keys}, errors {tj_errors[:2]}"
        except Exception as e:  # noqa: BLE001
            ok, detail = False, f"{type(e).__name__}"
        print(f"{'✓' if ok else '✗'} [tajweed] Al-Baqarah in tajweed colours with the colour key" + ("" if ok else f"  ({detail})"))
        if not ok:
            failures.append(f"[tajweed] {detail}")
        ctx.close()

        # installable app + offline reading (service worker)
        for name, ok, detail in offline_checks(browser, base):
            print(f"{'✓' if ok else '✗'} [offline] {name}" + ("" if ok else f"  ({detail})"))
            if not ok:
                failures.append(f"[offline] {name}: {detail}")

        # core runs with no DOM (as a mobile/desktop app would use it)
        page = browser.new_page()
        page.goto(base + "index.html", wait_until="domcontentloaded")
        results = page.evaluate("""() => new Promise((resolve, reject) => {
            const w = new Worker("scripts/core_worker_test.js", { type: "module" });
            w.onmessage = e => resolve(e.data);
            w.onerror = e => reject(e.message || "worker failed");
            setTimeout(() => reject("worker timed out"), 60000);
        })""")
        for r in results:
            print(f"{'✓' if r['ok'] else '✗'} [core, no DOM] {r['name']}" + ("" if r["ok"] else f"  ({r['detail']})"))
            if not r["ok"]:
                failures.append(f"[core] {r['name']}: {r['detail']}")
        browser.close()
    httpd.shutdown()

    if failures:
        print(f"\n{len(failures)} problem(s)")
        sys.exit(1)
    print("\n✓ all pages load cleanly on desktop and phone")


def static_checks():
    """Checks on the source files themselves (no browser)."""
    out = []
    sw = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
    listed = set(re.findall(r'"([^"]+\.(?:html|js|css|woff2|png|webmanifest))"', sw.split("const DATA_FILES")[0]))
    app_files = {os.path.relpath(p, ROOT) for pat in ("*.html", "js/**/*.js", "css/*.css")
                 for p in glob.glob(os.path.join(ROOT, pat), recursive=True)}
    missing = sorted(app_files - listed)
    out.append(("every page, script and stylesheet is in sw.js SHELL_FILES (works offline)", not missing, missing))
    gone = sorted(f for f in listed if not os.path.exists(os.path.join(ROOT, f)))
    out.append(("every file in sw.js SHELL_FILES exists", not gone, gone))

    tpl = open(os.path.join(ROOT, ".github", "ISSUE_TEMPLATE", "content_report.yml"), encoding="utf-8").read()
    options = re.findall(r"^\s+- (.+)$", tpl.split("id: kind")[1].split("validations")[0], re.M)
    report_js = open(os.path.join(ROOT, "js", "core", "report.js"), encoding="utf-8").read()
    kinds_block = report_js.split("export const KINDS")[1].split("});")[0]
    kinds = re.findall(r'^\s+\w+: "([^"]+)",$', kinds_block, re.M)
    out.append(("report kinds match the GitHub issue form options", options == kinds, f"form={options} code={kinds}"))
    return out


def offline_checks(browser, base):
    """Install the service worker, read some pages, go offline, and check they still work."""
    out = []
    ctx = browser.new_context(viewport=VIEWPORTS["desktop"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    def count(sel):
        return page.evaluate("s => document.querySelectorAll(s).length", sel)

    try:
        page.goto(base + "index.html?sw=1", wait_until="domcontentloaded")
        page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=60000)
        out.append(("service worker installed and controls the page", True, ""))

        man = page.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
        need = all(man.get(k) for k in ("name", "short_name", "start_url", "display", "icons"))
        sizes = {i["sizes"] for i in man.get("icons", [])}
        out.append(("web app manifest is complete", need and {"192x192", "512x512"} <= sizes, man.get("icons")))
        icons_ok = page.evaluate("""m => Promise.all(m.icons.map(i => fetch(i.src).then(r => r.ok))).then(a => a.every(Boolean))""", man)
        out.append(("all manifest icons load", icons_ok, ""))

        # read two pages online, so they get saved
        page.goto(base + "surah.html?n=2", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelectorAll('.ayah').length >= 286", timeout=60000)
        page.goto(base + "timeline.html", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelectorAll('.ev').length >= 24", timeout=60000)

        ctx.set_offline(True)
        page.goto(base + "surah.html?n=2", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelectorAll('.ayah').length >= 286", timeout=30000)
        out.append(("offline: a surah you've read opens (Al-Baqarah, 286 ayahs)", count(".ayah") >= 286, count(".ayah")))
        page.goto(base + "timeline.html", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelectorAll('.ev').length >= 24", timeout=30000)
        out.append(("offline: Seerah timeline opens", True, ""))
        out.append(("no JavaScript errors while reading", not errors, errors[:3]))
        # a surah that was never opened can't load offline: the page must say so, not hang on "Loading…"
        page.goto(base + "surah.html?n=50", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelector('.toast.show') && document.querySelector('.offline-msg')", timeout=30000)
        msg = page.inner_text(".offline-msg")
        out.append(("offline: an unsaved surah explains it isn't saved yet", "offline" in msg.lower(), msg))
        ctx.set_offline(False)
    except Exception as e:  # noqa: BLE001
        out.append(("offline flow completed", False, f"{type(e).__name__}: {e}"[:300]))
    finally:
        ctx.close()
    return out


def _third_party_msg(text):
    # Errors about outside services (fonts, audio, API) shouldn't fail our build.
    return any(h in text for h in ("fonts.g", "quran.com", "qurancdn", "islamic.network", "ERR_NAME_NOT_RESOLVED",
                                   "net::ERR_", "Failed to load resource"))


if __name__ == "__main__":
    main()
