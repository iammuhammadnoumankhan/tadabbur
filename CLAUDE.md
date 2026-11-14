# Tadabbur (تدبّر): project guide

Tadabbur helps people who can read the Quran but don't understand Arabic, starting with Urdu speakers in Pakistan. It lets them understand what they read: word-by-word meaning, translations, tafsir, Sahih hadith, the Seerah timeline, prophets and search.

- Live site: https://iammuhammadnoumankhan.github.io/tadabbur/ (GitHub Pages, served from `main`)
- Repo: https://github.com/iammuhammadnoumankhan/tadabbur (public)
- Plan and order of work: [ROADMAP.md](ROADMAP.md)
- Original research: [RESEARCH_AND_PLAN.md](RESEARCH_AND_PLAN.md)

## Non-negotiable content rules
1. **Never write religious content ourselves.** That covers translations, tafsir, summaries, stories, reasons for revelation, dates and event names beyond plain proper names. Everything comes from a named, recognised source and is fetched by a script, not typed in.
2. **Every data record carries a `src` id** that exists in `data/sources.json` (publisher, URL, licence, date fetched). Show the source in the UI.
3. **Never modify the Quran text.**
   - Arabic is shown exactly as fetched; `data/checksums*.json` holds SHA-256 fingerprints.
   - Only *re-shape* data: split, align or index it.
4. **Hadith come only from Sahih al-Bukhari and Sahih Muslim** (the user's decision). Link a hadith to an ayah only when the hadith's own text cites that ayah. Each hadith links to sunnah.com.
5. **Be honest about limits and disagreement.** Revelation order is approximate. Seerah events follow Bukhari's chapter order, and only moments a hadith dates have a year. Say so in the UI.
6. **Check licences before bundling.** Some sources say "no modification", "credit with version" or "no ads". Respect them; when in doubt, link instead of copying.
7. When a source is missing, **mark the gap** ("needs source"). Don't fill it from general knowledge.

## Git
- **No Claude attribution:** no `Co-Authored-By: Claude` trailers in commits, no "Generated with Claude Code" in PRs. Commit as the user only.
- Commit and push only when the user asks. A push to `main` deploys the live site, but only if CI passes.

## Architecture
- Static site in plain **HTML, CSS and vanilla JS (ES modules)**. No framework and no build step. Must work from any static host and inside future app wrappers.
- Pages: `index.html`, `surah.html`, `timeline.html`, `stories.html`, `search.html`, `sources.html`.
- JS:
  - `js/common.js`: data loading, settings, header, icons
  - one module per page: `home.js`, `surah.js`, `timeline.js`, `stories.js`, `search.js`
- CSS: `css/style.css`, with colour tokens on `:root` and dark mode via `[data-theme="dark"]`.
- Fonts:
  - bundled: `fonts/DigitalKhatt-IndoPak.woff2` (SIL OFL; licence file next to it)
  - from Google Fonts: Amiri Quran, Noto Naskh Arabic, Noto Nastaliq Urdu, Inter, Fraunces
- **Live (not bundled):** tafsir text and audio (Quran.com API and CDNs) are fetched at runtime. Everything else is in `data/`.

## Keep it ready for mobile and desktop apps
Web first, then mobile (Capacitor/TWA) and desktop (Tauri) wrapping the same code. So:
- use only **relative paths** (`data/...`, never `/data/...`), so it works under `/tadabbur/` and inside app wrappers;
- **no server dependency** for core features; data is static JSON;
- keep data access and logic separate from the DOM (moving into `js/core/` per roadmap item 2);
- keep all UI text in one place (moving to `js/i18n/` per roadmap item 2), ready for the Urdu interface;
- put `localStorage` access behind try/catch (`common.js` already does), and store settings and progress in a shape that can sync later;
- design mobile-first: test at 375px wide with no horizontal scroll.

## Data pipeline (run in this order; raw downloads are cached in `.cache/`, which git ignores)
```bash
python3 scripts/build_data.py      # chapters, Quran text, word-by-word, translations, surah intros, Bukhari links, tafsir list
python3 scripts/build_indopak.py   # IndoPak text (DigitalKhatt) aligned to Quran.com words + OFL font
python3 scripts/build_seerah.py    # Seerah timeline from Sahih al-Bukhari (asserts anchor hadith text)
python3 scripts/build_stories.py   # prophets from the Quranic Arabic Corpus ontology
python3 scripts/build_search.py    # search index
```
- Scripts must **merge into** `data/sources.json`, never overwrite it.
- Scripts **assert** their invariants (6,236 ayahs, alignment, anchor text) so the build fails loudly when something drifts.

## Checks and deployment (CI/CD)
- `.github/workflows/ci.yml` runs on every push and pull request:
  - **validate-data:** `scripts/validate_data.py`, covering Arabic fingerprints, 114 surahs and 6,236 ayahs everywhere, IndoPak word alignment, every `src` listed, valid ayah links, and the search index matching the translations;
  - **smoke-test:** `scripts/smoke_test.py`, which loads every page in headless Chromium at desktop and 375px, and fails on JS errors, missing files, missing content or sideways scroll.
- **Deploy:** only from `main`, only after both checks pass. GitHub Pages is set to "GitHub Actions" as its source, and only `*.html`, `css/`, `js/`, `fonts/` and `data/` are published.
- `.github/workflows/links.yml` runs weekly (Mondays) and on demand: `scripts/check_links.py` confirms every source URL and live service (tafsir API, audio, sunnah.com) still responds.
- **Run all checks locally before pushing:**
  ```bash
  python3 scripts/validate_data.py
  pip install -r requirements-dev.txt && python -m playwright install chromium
  python3 scripts/smoke_test.py
  python3 scripts/check_links.py
  ```
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
- Urdu text: `class="urdu"`, `dir="rtl"`, Nastaliq font.
- Quran text: `translate="no"`, `lang="ar"`.
- Sanitize any third-party HTML (tafsir, surah intros) to a small set of allowed tags.
- Keep pages small: lazy-load per-surah files; fetch big things live only when the user asks for them.
