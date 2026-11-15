# Tadabbur Roadmap

The order below is chosen so that:
- what we build now carries over to the **mobile and desktop apps** later, at no extra cost;
- safety checks (CI/CD) protect the Quran text **before** many more features are added;
- features that depend on another come after it (e.g. frequent words after word roots);
- features that still need an authentic source come after ones whose source we already have.

Numbers in brackets, e.g. **[#2]**, are the item numbers from the original idea list.
Status: `[ ]` to do · `[~]` in progress · `[x]` done.

---

## Phase 1: Foundations (ready for web, mobile and desktop)

- [x] **1. Automatic checks and deployment (CI/CD) [#18]** *(done 2026-11-15)*
  - GitHub Actions on every push and pull request:
    - every ayah's Arabic text still matches `data/checksums.json` and `checksums-indopak.json`;
    - 114 surahs and 6,236 ayahs, with nothing missing, in every data file;
    - every record's `src` id exists in `data/sources.json`;
    - all pages load with no JavaScript errors (headless browser);
    - external source links still respond (weekly, not on every push).
  - Deploy to GitHub Pages from Actions, and only when the checks pass.
  - *Why first:* every later feature adds data. This makes sure nothing corrupts the Quran text or drops a citation.
- [x] **2. Data contract and shared core** *(done 2026-11-15)*
  *(not on the idea list, but needed for the apps)*
  - Document every `data/*.json` format in `docs/DATA.md`, with a version number.
  - Move data loading, search and settings into a DOM-free `js/core/` module, so a mobile or desktop app can reuse the same logic.
  - Keep all interface text in one place (`js/i18n/en.js`), so the Urdu interface (item 20) is a translation job, not a rewrite.
- [x] **3. Installable app, works offline (PWA) [#13]** *(done 2026-11-15)*
  - Web app manifest, icons, and a service worker that caches the pages and the surahs you have read.
  - *Path to the apps later:*
    - **Mobile:** wrap the same site with Capacitor or a Trusted Web Activity for the Play Store and App Store.
    - **Desktop:** wrap it with Tauri.
    - No rewrite either way.
- [x] **4. "Report an issue" button [#16]** *(done 2026-11-15)*
  - On every ayah, translation, tafsir and hadith.
  - Opens a pre-filled GitHub issue with the exact reference and source id. Free, no server.

## Phase 2: Learning the Arabic

- [x] **5. Word roots [#2]** *(done 2026-11-15)*
  - Tap a word to see its root, lemma and form, and every other ayah where that root appears.
  - Source: Quranic Arabic Corpus morphology (GPL), aligned to our word list as we did for IndoPak.
- [x] **6. Most frequent words [#3]** *(done 2026-11-15)*
  - Words ranked by how often they appear, with flashcards.
  - A "how much of the Quran you now recognise" meter, computed from the text.
- [x] **7. Audio that highlights each word as it's recited [#8]** *(done 2026-11-15)*
  - Source: Quran.com word-timing segments for a recitation.
- [x] **8. Tajweed colours [#10]** *(done 2026-11-15)*
  - Source: Quran.com's tajweed text, plus a colour key.
- [ ] **9. Mushaf page view [#9]**
  - 604 pages in Madani layout, plus IndoPak 13- and 15-line layouts.
  - Source: QUL mushaf layouts; licence to be checked. The biggest item in this phase.

## Phase 3: Daily habit and sharing

- [ ] **10. Reading progress [#11]**
  - Last read, bookmarks, personal notes, khatm tracker and daily goal.
  - Saved on the device first, with a format that can sync to an account later (sync needs a server, so it waits for budget).
- [ ] **11. Share an ayah as an image [#12]**
  - Arabic plus Urdu or English, with the source shown on the card. Made in the browser, no server.

## Phase 4: More context (each needs a confirmed source first)

- [ ] **12. Similar ayahs [#5]**
  - Source: QUL similar-ayahs and mutashabihat data. Check the licence first.
- [ ] **13. Sahih Muslim links [#7]**
  - Find an authentic mapping from Muslim's hadith to ayahs. Muslim's English edition doesn't cite ayah numbers in the text.
- [ ] **14. Asbab al-nuzul [#6]**
  - **Decision needed.** Al-Wahidi's Arabic original is classical and free to use; the English translation (Guezzou) is copyrighted, so it needs permission; there is no Urdu yet.
  - Alternative: limit it to Sahih hadith that state a reason for revelation.
- [ ] **15. Map of places in the Quran [#14]**
  - Places from the Corpus ontology; map coordinates from a cited geographic source.
- [ ] **16. Prophets family tree [#15]**
  - Drawn only from the ontology's `son-of` relations, which we already have.

## Phase 5: Trust and reach

- [ ] **17. Scholar review page [#17]**
  - Which sources a qualified 'alim has reviewed, when, and their notes. Needs a reviewer.
- [ ] **18. More languages [#19]**
  - Translations in Bengali, Hindi, Pashto, Sindhi, Indonesian and Turkish, from the same Quran.com source.
- [ ] **19. Own web address and link previews [#20]**
  - Domain about $10–15 a year; do it when budget allows.
  - Social preview images for every surah and prophet page.
- [ ] **20. Urdu interface [#1]** *(last, as decided)*
  - The whole interface in Urdu: right to left, Nastaliq font, with an English switch.
  - Item 2 already gathers all the text in one place, so this is mostly translating that file.

---

### Not chosen for now
- Browse by topic [#4]: kept out at your request. It can come back later using the Corpus topic index or QUL topics.

### Later, when budget allows
- Accounts and sync across devices (needs a small backend).
- App store accounts: Google Play ($25 once), Apple App Store ($99 a year).
- Code signing for the desktop apps.
