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
- [x] **9. Mushaf page view [#9]** *(done 2026-11-15: Madani 604 + IndoPak 15-line)*
  - 604 pages in Madani layout, plus IndoPak 13- and 15-line layouts.
  - Source: QUL mushaf layouts; licence to be checked. The biggest item in this phase.

## Phase 3: Daily habit and sharing

- [x] **10. Reading progress [#11]** *(done 2026-11-15)*
  - Last read, bookmarks, personal notes, khatm tracker and daily goal.
  - Saved on the device first, with a format that can sync to an account later (sync needs a server, so it waits for budget).
- [x] **11. Share an ayah as an image [#12]** *(done 2026-11-15)*
  - Arabic plus Urdu or English, with the source shown on the card. Made in the browser, no server.

## Phase 4: More context (sources researched 2026-11-15)

- [ ] **12. Similar ayahs [#5]**
  - **12a. Similar wording (done 2026-11-15).** Ayahs that share an identical phrase of 5 or more words, computed directly from the Quran text. No outside source, nothing to license, fully checkable. Useful for memorisers (mutashabihat lafziyya).
  - **12b. Related meaning (needs permission).**
    - Best source: QurSim (Sharaf & Atwell, University of Leeds, LREC 2012). It has 7,679 related-verse pairs taken from Ibn Kathir's tafsir, rated strong or weak.
    - Its download link is dead and its licence unstated, so it needs the authors' permission.
    - Tarteel QUL "Similar Ayah" has no creator or licence stated, so it's not used.
- [x] **13. Sahih Muslim links [#7]** *(done 2026-11-15)*
  - A hadith links to an ayah only when its **Arabic text quotes at least 6 consecutive words** of that ayah (or, as before, its translation cites the ayah number). Common phrases are ignored; an ambiguous quote links the ayah with the longest quoted run, or none on a tie.
  - **Result:** 246 Sahih Muslim hadith and 559 Bukhari hadith (386 cite, 340 quote) are linked.
  - Each hadith shows how it is linked ("quotes" or "cites"); Muslim links to sunnah.com by book and hadith number.
- [ ] **14. Asbab al-nuzul [#6]** *(skipped: no open source)*
  - **Rule (the owner's):** add it only if an open, authentic, non-copyrighted source exists.
  - **Findings:**
    - Quran.com doesn't publish it, and neither does quran-tafseer.com.
    - The English translation (Guezzou) is copyrighted.
    - The only public-domain copy is an image scan (1316 AH Cairo print on Wikisource) that would need error-prone OCR.
  - Sahih reasons for revelation are already covered where Bukhari and Muslim hadith quote or cite the ayah (items 13 and the existing links).
- [x] **15. Map of places in the Quran [#14]** *(done 2026-11-15)*
  - `places.html`: 17 places from the Corpus ontology (cities, lands, mountains, mosques), each with the ayahs that name it. Bakkah and Yathrib are merged into Makkah and Medinah, as the ontology states.
  - **Positions:** Wikidata (CC0). The Wikidata item chosen for each place is shown with a link. Egypt and Sheba are drawn as areas.
  - **Left off the map:** Iram, al-Ahqaf, Mount Sinai and al-Judi, because our sources don't settle where they are.
  - **Background:** Natural Earth coastlines and rivers (public domain), drawn offline, with no modern borders.
- [x] **16. Prophets family tree [#15]** *(done 2026-11-15)*
  - Drawn only from the ontology's stated son-of / daughter-of / adopted-son-of relations.
- [x] **16b. Fuller family tree with evidence** *(done 2026-11-15: A1 and C1–C8 of docs/FAMILY_CANDIDATES.md approved and added)*
  - Add parent, child and sibling links **only where an ayah or a Sahih hadith states them**, each link showing its evidence. Example: the Prophet's ﷺ son Ibrahim, named in Bukhari 1060, 1063, 1303, 3255 and 6194.
  - Candidate links are listed for the owner's (and ideally a scholar's) approval before they're added.
- [x] **16c. Person cards** *(done 2026-11-15)*
  - Tap anyone in the tree to see:
    - name (Arabic and English);
    - prophet or messenger, per the ontology;
    - how many ayahs mention them, with links;
    - family links with their evidence.
  - No biography written by us.

## Phase 5: Design and usability (UI/UX) *(added 2026-11-16)*

Based on a measured audit and research, written up in [docs/UX_RESEARCH.md](docs/UX_RESEARCH.md) (§ numbers below point there). Phones come first: most readers use budget Android phones on paid data, often with one hand.

- [ ] **U0. First test with 5 real readers** *(free; §3.6)*
  - 5 Urdu-speaking readers, each on their own phone, doing a few set tasks, e.g. "find what 2:255 means in Urdu", "find a hadith on this ayah", "continue where you left off".
  - Watch without helping and note where they get stuck. This tells us which of U1–U8 matters most, and gives a "before" to compare with.
- [x] **U1. Bottom tab bar on phones** *(done 2026-11-16; §2, §3.2)*
  - Today 6 of 9 header links are off-screen on a phone.
  - Phones get a bottom bar with 4–5 labelled tabs (Read, Search, Learn, My reading, More), within thumb reach. Desktop keeps the top menu.
- [x] **U2. Reading comes first on the surah page** *(done 2026-11-16; §2, §3.3)*
  - Today the first ayah starts two screens down.
  - Use a compact header (name, Makki/Madani, ayah count), with "About this surah" to expand the introduction, timeline, prophets and sources. Nothing is removed; it's one tap away.
- [x] **U3. Simpler ayah actions** *(done 2026-11-16; §2, §3.1, §3.3)*
  - Today there are 8 controls per ayah, at 28×33px.
  - Keep play, tafsir and the hadith/similar badges visible; put copy, share, bookmark, note and report in one labelled "More" menu.
  - Every tap target becomes at least 44px.
- [x] **U4. Fast on budget phones** *(done 2026-11-16; §2, §3.4)*
  - **Test:** `scripts/perf_test.py`, a CI job that blocks deploys. It runs at 375px with the CPU 4× slower and slow 4G (1.6 Mbps, 150 ms), and checks LCP ≤ 2.5s, CLS ≤ 0.1, tap ≤ 200 ms and ≤ 6,000 elements.
  - **Before → after (slow 4G):**

    | Page | Before | After |
    |---|---|---|
    | Home | LCP 3.0s, CLS 0.84 | LCP 1.5s, CLS 0.04 |
    | Al-Fatihah | LCP 3.2s, CLS 0.33 | LCP 1.4s, CLS 0.02 |
    | Al-Baqarah | 25,481 elements | 1,831 elements, LCP 2.8s |
    | Al-Baqarah at 2:255 | LCP 12.3s | LCP 2.9s, 3,051 elements |
    | Prophets | CLS 0.20 | CLS 0.00 |

  - **How:**
    - long surahs are drawn 12 ayahs at a time as you scroll, either way from a linked ayah;
    - every request starts at once, and the shared scripts are preloaded;
    - the word grammar and share-card code load only when needed;
    - the header's space is reserved, and the English page text is in the HTML (`scripts/stamp_i18n.py`), so nothing jumps.
  - **Fonts:** Google Fonts already sends each font only when its letters appear on screen, so Nastaliq downloads only when Urdu is shown. The bundled IndoPak font (338 KB) is left untouched: trimming it risks how the Quran text is drawn, and the OFL would require renaming it.
- [ ] **U4b. Smaller first download for long surahs**
  - Al-Baqarah's first visit on slow 4G is 2.8s, because its word-by-word file is 222 KB compressed. The speed test allows 3.0s for it until this is done.
  - **Idea:** split `surah/NNN.json` so the first screen needs less (e.g. move word audio paths and transliteration to their own file). This changes the data format, so it needs a schema bump (docs/DATA.md).
- [ ] **U5. Easier reading** *(§3.5)*
  - No text under 13px (translator names are 11px today); body text at 16px or more.
  - More line height for Nastaliq; comfortable line length on desktop.
  - A simple text-size control in the reader for older eyes.
- [ ] **U6. Accessibility pass to WCAG 2.2 AA** *(§3.1, §3.7)*
  - Contrast in both themes, visible keyboard focus, screen-reader labels, correct `lang` on Arabic and Urdu, respect for "reduce motion".
  - The revelation-order bars stop being 2px links on touch screens.
  - An automated accessibility check is added to CI.
- [ ] **U7. First-time setup** *(§3.3)*
  - On first visit, three quick choices: meaning language (Urdu/English), script (IndoPak/Uthmani) and translations. Then a one-time tip explaining the gold hadith and green "similar" badges.
  - Everything stays changeable in settings.
- [ ] **U8. Better on desktop and tablet** *(§3.2)*
  - A side navigation rail, Arabic and translation side by side on wide screens, and keyboard shortcuts (next/previous ayah, play, tafsir).
- [ ] **U9. Design system notes**
  - `docs/DESIGN.md`: colours, type sizes, spacing, and the shared components (chips, cards, drawers, tabs). New features then look and behave the same, and the mobile and desktop apps reuse them.
- [ ] **U10. Second test with 5 readers**
  - Repeat U0's tasks after U1–U7 and compare. Repeat after any large change.

## Phase 6: Trust and reach

- [ ] **17. Scholar review page [#17]**
  - Which sources a qualified 'alim has reviewed, when, and their notes. Needs a reviewer.
  - Good first items to review: `docs/FAMILY_CANDIDATES.md` and the hadith-to-ayah linking rules.
- [ ] **12b. Related-meaning ayahs (QurSim)**: waits on permission.
  - We can draft the request; the owner sends it to the authors (Leeds).
- [ ] **19. Own web address and link previews [#20]**
  - Domain about $10–15 a year; do it when budget allows.
  - Social preview images for every surah and prophet page.

## Phase 7: More languages

- [ ] **18. Translations in more languages [#19]** *(checked 2026-11-16, docs/UX_RESEARCH.md §4)*
  - Quran.com offers 126 translations in 69 languages.
  - First, languages close to our readers: Pashto (1), Sindhi (1), Persian (2), Hindi (1), Bengali (4). Then Indonesian (3), Turkish (5), Malay (1) and others.
  - Punjabi, Balochi and Kashmiri have none there: mark them "needs source".
  - **Check each translation's licence before bundling** (CLAUDE.md rule 6); link out where bundling isn't allowed.
- [ ] **18b. Choosing a translation by language**
  - The translation picker grouped by language, with a search box, so dozens of translations stay easy to choose from.
- [ ] **18c. Word-by-word meaning in more languages**
  - Only where Quran.com publishes word-by-word for that language; check each one first.
- [ ] **20. Urdu interface [#1]** *(last of the original list, as decided)*
  - The whole interface in Urdu: right to left, Nastaliq font, with an English switch.
  - Item 2 already gathers all the text in one place, so this is mostly translating that file.
- [ ] **18d. More interface languages** *(after the Urdu interface)*
  - Translate `js/i18n/en.js` into other languages. Right-to-left ones (Arabic, Persian, Pashto, Sindhi) reuse the Urdu right-to-left work.
  - Each needs a native-speaker check, because we don't machine-translate the interface without review.

---

### Not chosen for now
- Browse by topic [#4]: kept out at your request. It can come back later using the Corpus topic index or QUL topics.

### Later, when budget allows
- Accounts and sync across devices (needs a small backend).
- App store accounts: Google Play ($25 once), Apple App Store ($99 a year).
- Code signing for the desktop apps.
