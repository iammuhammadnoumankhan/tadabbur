# Tadabbur (تدبّر): project guide

Tadabbur helps people who can read the Quran but don't understand Arabic, starting with Urdu speakers in Pakistan. It lets them understand what they read: word-by-word meaning, translations, tafsir, Sahih hadith, the Seerah timeline, prophets and search.

- Live site: https://iammuhammadnoumankhan.github.io/tadabbur/ (GitHub Pages, served from `main`)
- Repo: https://github.com/iammuhammadnoumankhan/tadabbur (public)
- Plan and order of work: [ROADMAP.md](ROADMAP.md)
- Original research: [RESEARCH_AND_PLAN.md](RESEARCH_AND_PLAN.md)

## Non-negotiable content rules
1. **Never write religious content ourselves.** That covers translations, tafsir, summaries, stories, reasons for revelation, dates and event names beyond plain proper names. Everything comes from a named, recognised source and is fetched by a script, not typed in.
2. **Every data record carries a `src` id** that exists in `data/sources.json` (publisher, URL, licence, date fetched). Show the source in the UI.
3. **Never modify the Quran text.** Each script (Uthmani, IndoPak, tajweed) is shown exactly as its source publishes it and is fingerprinted separately; never merge or "fix" one script with another.
   - Arabic is shown exactly as fetched; `data/checksums*.json` holds SHA-256 fingerprints.
   - Only *re-shape* data: split, align or index it.
4. **Hadith come only from Sahih al-Bukhari and Sahih Muslim** (the user's decision). Link a hadith to an ayah only when the hadith itself points to it: its translation cites the ayah number, or its Arabic quotes 6+ consecutive words of it. Each hadith links to sunnah.com.
5. **Be honest about limits and disagreement.** Revelation order is approximate. Seerah events follow Bukhari's chapter order, and only moments a hadith dates have a year. Say so in the UI.
6. **Check licences before bundling.** Some sources say "no modification", "credit with version" or "no ads". Respect them; when in doubt, link instead of copying.
7. When a source is missing, **mark the gap** ("needs source"). Don't fill it from general knowledge.
8. **Zero tolerance for mistakes (the owner's rule).** Speed, design or code work must never change religious content: not one letter of the Quran text, a translation, a word meaning, a hadith or a tafsir.
   - Restructuring data (splitting, moving or indexing files) must be **proven lossless**: rejoined, it equals the original exactly, and fingerprints in `data/checksums*.json` guard it in CI.
   - Prove a new guard works by making a one-letter test change and confirming the validator fails, then restore the file.
   - Display changes (what is drawn when, e.g. drawing long surahs in sections) must show every ayah, once and in order. The smoke test checks this.
   - **Quran text is shown only in its own font:** DigitalKhatt IndoPak for IndoPak, Amiri Quran for Uthmani and tajweed.
     - It stays hidden until that font has loaded (`quranFont()` in `js/common.js`, CSS `.qf-wait-*`), and the surah reader waits for it before drawing.
     - Only if a font truly can't load (after 10 s) is the text shown in the device's Arabic font, with a notice saying so.
     - The smoke test checks that Quran text is never left hidden and ends up in its own font.

## Git
- **No Claude attribution:** no `Co-Authored-By: Claude` trailers in commits, no "Generated with Claude Code" in PRs. Commit as the user only.
- Commit and push only when the user asks. A push to `main` deploys the live site, but only if CI passes.

## Architecture
- Static site in plain **HTML, CSS and vanilla JS (ES modules)**. No framework and no build step. Must work from any static host and inside future app wrappers.
- Pages: `index.html`, `surah.html`, `page.html` (mushaf page view), `progress.html` (my reading), `timeline.html`, `stories.html`, `search.html`, `root.html`, `learn.html`, `places.html` (map of places), `sources.html`.
- JS has three layers:
  - **`js/core/`**: no DOM. Data loading (`data.js`), settings with pluggable storage (`settings.js`), search engine (`search.js`) and Quran reference helpers (`quran.js`). Mobile and desktop apps reuse it; an app calls `configure({ base, fetch })` and `settings.configureStorage(adapter)`.
  - **`js/i18n/`**: every interface string, in `en.js`, through `t(key, vars)`. Static HTML uses `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`, `data-i18n-title` or `data-i18n-aria-label`. A missing key shows as `⟦key⟧`, and the smoke test fails on it.
  - **`js/common.js`**: browser UI layer. Re-exports core and `t`, and holds the theme, `h()`, `sanitize()`, header (top menu on desktop; 5-tab bottom bar plus a "More" sheet on phones and tablets ≤1023px, each page passes its name to `header()`) and footer, tooltip and journey bars.
  - Then one module per page: `home.js`, `surah.js`, `timeline.js`, `stories.js`, `places.js`, `search.js`, `sources.js`.
- **Rules:**
  - Never hard-code UI text; add a key to `js/i18n/en.js`.
  - Never touch `document` or `window` in `js/core/`.
  - Data formats are defined in `docs/DATA.md` (schema 2). A breaking change bumps `SCHEMA` in `build_manifest.py`, `validate_data.py` and `js/core/data.js`.
- CSS: `css/style.css`, with colour tokens on `:root` and dark mode via `[data-theme="dark"]`.
- Fonts:
  - bundled: `fonts/DigitalKhatt-IndoPak.woff2` (SIL OFL; licence file next to it)
  - from Google Fonts: Amiri Quran, Noto Naskh Arabic, Noto Nastaliq Urdu, Inter, Fraunces
- **Live (not bundled):** tafsir text and audio (Quran.com API and CDNs) are fetched at runtime. Recitation **timings** are bundled (`data/audio/`), so word highlighting doesn't depend on Quran.com's undocumented audio API at runtime. Everything else is in `data/`.

## "Report a problem"
- **Where the buttons are:** every ayah (flag icon), word popover, tafsir panel, each hadith, surah introduction, Seerah event, prophet, tagged ayah, and the footer.
- **How they're built:** `C.reportLink({ kind, reference, source, page })`, with URLs from `js/core/report.js`.
- **Where they go:** a GitHub issue form, `.github/ISSUE_TEMPLATE/content_report.yml`, with its fields pre-filled. Reports get the `content-report` label. Readers need a free GitHub account.
- **Keep in sync:** `KINDS` in `report.js` must match the form's dropdown options exactly; the smoke test checks this.
- **Handling a report:** check it against the original source (see `data/sources.json`). Never "fix" religious content from general knowledge. If the source itself is wrong, say so and link the source's own correction channel.

## Installable app and offline (PWA)
- **Files:**
  - `manifest.webmanifest`;
  - icons in `icons/`, made by `scripts/make_icons.py`;
  - `sw.js`, the service worker.
- **How `sw.js` caches:**
  - The **app shell** (`SHELL_FILES`) is cached per deploy. CI replaces `__BUILD__` with the commit, so an update installs a complete new shell.
  - **Data** goes in `tadabbur-data-schema-2`, kept across deploys and refreshed in the background. Rename it when the data schema changes.
  - Fonts and tafsir you've read go in `tadabbur-runtime`.
- **When adding a page, JS module or core data file,** add it to `SHELL_FILES` / `DATA_FILES` in `sw.js`, or it won't work offline. The offline test catches most misses.
- **"Save for offline"** (`offlinePanel()` in `common.js`) asks the service worker to cache every surah file for the reader's chosen translations (about 658 files, about 30 MB).
- **The service worker is NOT registered on localhost,** so development always shows fresh files. Add `?sw=1` to test it, then unregister it in the browser afterwards.

## Keep it ready for mobile and desktop apps
Web first, then mobile (Capacitor/TWA) and desktop (Tauri) wrapping the same code. So:
- use only **relative paths** (`data/...`, never `/data/...`), so it works under `/tadabbur/` and inside app wrappers;
- **no server dependency** for core features; data is static JSON;
- keep logic in `js/core/` (no DOM), not in page modules;
- keep all UI text in `js/i18n/en.js`, ready for the Urdu interface;
- put `localStorage` access behind try/catch (`common.js` already does), and store settings and progress in a shape that can sync later;
- design mobile-first: test at 375px wide with no horizontal scroll.
- **Share cards** (`js/sharecard.js`) are drawn on a `<canvas>` in the browser:
  - The Arabic and translations are drawn exactly as given, with their sources printed on the card.
  - Fonts shrink to fit and the card grows taller, so text is never cut.
  - Tajweed mode shares plain Uthmani text.
- **Reading progress** (`js/core/progress.js`) is per-device and private:
  - Never send it anywhere.
  - An account and sync are later roadmap work.
  - Its shape is documented in `docs/DATA.md`; keep it backward compatible (bump `v` only with a migration).

## Data pipeline (run in this order; raw downloads are cached in `.cache/`, which git ignores)
```bash
python3 scripts/build_data.py      # chapters, Quran text, word-by-word (surah/ + extra words/), translations, surah intros, hadith links, tafsir list
python3 scripts/build_indopak.py   # IndoPak text (DigitalKhatt) aligned to Quran.com words + OFL font
python3 scripts/build_seerah.py    # Seerah timeline from Sahih al-Bukhari (asserts anchor hadith text)
python3 scripts/build_stories.py   # prophets from the Quranic Arabic Corpus ontology
python3 scripts/build_family.py    # prophets family links (ontology relations + owner-approved ayah/hadith-stated links)
python3 scripts/build_places.py    # places named in the Quran (ontology) + Wikidata positions + Natural Earth basemap
python3 scripts/build_roots.py     # word roots from the Quranic Arabic Corpus file (see below)
python3 scripts/build_vocab.py     # most frequent words (needs roots)
python3 scripts/build_audio.py     # recitation word timings (6 reciters) from Quran.com
python3 scripts/build_tajweed.py   # tajweed-coloured Uthmani text (Quran.com), word by word
python3 scripts/build_layout.py    # mushaf page layouts: Madani 604 (Quran.com) + IndoPak 15-line (DigitalKhatt)
python3 scripts/build_similar.py   # ayahs sharing 5+ identical consecutive words (from our own text)
python3 scripts/build_search.py    # search index
python3 scripts/build_manifest.py  # data/manifest.json (schema version + counts) — always last
```
- **Word roots** need `quranic-corpus-morphology-0.4.txt` in the project root.
  - The owner downloads it from https://corpus.quran.com/download/ (the form asks for their email; never fill it in for them).
  - It's git-ignored and must never be committed or edited.
  - Its terms: data used unchanged, the Corpus credited with a link to corpus.quran.com, and the copyright notice reproduced in derived works. It's kept in `data/roots/index.json` → `notice` and shown on the Roots page.
  - `build_roots.py` stops if word counts differ from our word list.
- Scripts must **merge into** `data/sources.json`, never overwrite it.
- Scripts **assert** their invariants (6,236 ayahs, alignment, anchor text) so the build fails loudly when something drifts.

## Checks and deployment (CI/CD)
- `.github/workflows/ci.yml` runs on every push and pull request:
  - **validate-data:** `scripts/validate_data.py`, covering Arabic fingerprints, 114 surahs and 6,236 ayahs everywhere, IndoPak word alignment, every `src` listed, valid ayah links, and the search index matching the translations;
  - **smoke-test:** `scripts/smoke_test.py`, which loads every page in headless Chromium at desktop and 375px, and fails on JS errors, missing files, missing content, missing text keys or sideways scroll. It also runs `scripts/core_worker_test.js` in a Web Worker (no DOM) to prove the core works as an app would use it, and an **offline test**: it installs the service worker, reads pages, goes offline, and checks that saved pages open and an unsaved surah shows a clear message.
- **Deploy:** only from `main`, only after both checks pass. GitHub Pages is set to "GitHub Actions" as its source, and only `*.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `fonts/`, `icons/` and `data/` are published.
- `.github/workflows/links.yml` runs weekly (Mondays) and on demand: `scripts/check_links.py` confirms every source URL and live service (tafsir API, audio, sunnah.com) still responds.
- **Run all checks locally before pushing:**
  ```bash
  python3 scripts/validate_data.py
  pip install -r requirements-dev.txt && python -m playwright install chromium
  python3 scripts/smoke_test.py
  python3 scripts/perf_test.py
  python3 scripts/a11y_test.py
  python3 scripts/check_links.py
  ```
- **Accessibility (U6):** `scripts/a11y_test.py` runs in CI (job `accessibility`, which deploys depend on). It checks WCAG 2.2 A/AA with axe-core (vendored at a pinned version in `scripts/vendor/`) on every page, at phone and desktop width, in both themes, with panels open. The only exceptions are WCAG's own: the 2px revelation bars ("equivalent") and mushaf-page words ("inline"), each documented in the script. Text colours use the theme tokens, which all pass 4.5:1; use `--on-accent` for text on accent fills.
- **Speed (U4):** `scripts/perf_test.py` runs in CI (job `speed-test`, which deploys depend on) on a slowed "budget phone" and fails over budget (LCP ≤ 2.5s, CLS ≤ 0.1, tap ≤ 200 ms, ≤ 6,000 elements).
- **Static page text:** the English interface text is stamped into the HTML by `python3 scripts/stamp_i18n.py`. Run it after changing a `data-i18n` key's text or adding one to a page; the smoke test fails if the pages are out of date.
- **Every page preloads the shared modules** (`<link rel="modulepreload">` for `js/common.js`, `js/i18n/*`, `js/core/*`). Add a new core module to every page; the smoke test checks this.
- **Long surahs are drawn in sections** (`renderUpTo` / `renderFrom` / `ensureAyah` in `js/surah.js`). Call `ensureAyah(i)` before looking up an ayah element that may not be drawn yet.
- **When adding a page or data file:**
  - add the page to `PAGES` in `smoke_test.py`;
  - add invariants for the new data to `validate_data.py`.

## Run and verify locally
```bash
python3 scripts/serve.py 8765      # no-cache dev server; also defined in .claude/launch.json as "tadabbur"
```
After a change, check in the browser at desktop and at 375px (mobile):
- no console errors;
- no horizontal scroll;
- Urdu (Nastaliq) and Arabic render without missing-glyph boxes.

## Conventions
- UI rules (from [docs/UX_RESEARCH.md](docs/UX_RESEARCH.md)): design for budget Android phones and one-handed use first; tap targets ≥ 44px (never < 24px); no text under 13px; show the main thing first and put the rest behind a clearly labelled control; aim for WCAG 2.2 AA.
- Urdu text: `class="urdu"`, `dir="rtl"`, Nastaliq font.
- Quran text: `translate="no"`, `lang="ar"`.
- Sanitize any third-party HTML (tafsir, surah intros) to a small set of allowed tags.
- Keep pages small: lazy-load per-surah files; fetch big things live only when the user asks for them.
