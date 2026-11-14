# Quran Visualizer: Research & Plan

_Draft 1, 15 Nov 2026_

---

## 1. The problem we are solving

Many Muslims in Pakistan and other non-Arab countries can **recite** the Quran but can't **understand** it while reading. The gaps:

| Gap | What the reader experiences |
|---|---|
| **Meaning** | "I read the Arabic but don't know what each word or ayah means." |
| **Context** | "I don't know *when*, *where* or *why* this surah or ayah was revealed." |
| **Connection** | "I don't know what was happening in the Prophet's ﷺ life at that time, or which other ayahs talk about the same thing." |
| **Feeling** | Translations come as walls of text, and tafsir books are long. Nothing helps the reader *feel* the moment of revelation. |

**Our purpose, in one line:**
> *Help anyone who can read the Quran understand what they are reading, word by word, and see the moment, place and reason it was revealed, using only authentic, cited sources.*

We are **not** a new translation, a new tafsir or a fatwa platform. We **visualise and connect** existing, recognised scholarship.

---

## 2. What already exists

| Platform | What it does well | What's missing (for our problem) |
|---|---|---|
| **[Quran.com](https://quran.com)** (Quran Foundation, non-profit waqf) | Reading, 100+ translations, tafsir, word-by-word, audio, surah info | Context is plain text in separate tabs. No timeline, map or links to the Seerah. |
| **[QuranWBW](https://quranwbw.com)** ([open source, SvelteKit](https://github.com/marwan/quranwbw)) | Excellent word-by-word, Urdu WBW (credited to Dr. Farhat Hashmi), IndoPak/Nastaliq, morphology | Focused on words. No historical or revelation context. |
| **[Quranic Arabic Corpus](https://corpus.quran.com)** | Grammar, roots, syntax treebank, ontology of concepts (GPL) | Built for linguists. Too technical for ordinary readers. |
| **AnalyzeQuran, gtaf Quran, "Al Quran (Tafsir & by Word)"** | Word roots, WBW in Urdu and other languages | App-store style UI with no narrative or context. |
| **Learn Quran (Dr. Farhat Hashmi)** and other Urdu apps | Urdu translation plus explanation | Audio/lecture-heavy. Not visual or connected. |
| **Tarteel** | AI memorization and recitation feedback | Built for memorization, not understanding. |
| **[Siravisualizer](https://siravisualizer.vercel.app/), [IlmMaps Sirah](https://ilmmaps.pages.dev/books/seerah.html)** | Seerah timelines and maps | Not linked to ayahs. Sources unverified. |
| **[The Walking Quran](https://fussilat.com/walking_quran.html)** | Pairs each year of the Prophet's ﷺ mission with the surahs revealed in it (posters/slides) | Offline and static. Not interactive. |
| **[Chronological table (thelastdialogue)](https://www.thelastdialogue.org/quran-timeline-of-events/)** | Lists all 114 surahs in revelation order with asbab notes | A table only, no visuals. |
| **Ayatica** (D3) | Word clouds and statistical charts | Shows numbers, not understanding. |

### The gap (our opportunity)
Nobody brings these together:
**Ayah ↔ word meaning ↔ reason for revelation ↔ time in the Prophet's ﷺ life ↔ place on a map ↔ related ayahs and stories**,
in one calm, beautiful, **Urdu-first** (and English) reading experience, with a **source label on every non-Quran sentence**.

---

## 3. Content principles (non-negotiable)

1. **We invent nothing.** Every translation, summary, story, reason for revelation and date comes from a named, recognised source. No AI-written religious content.
2. **Every item carries a citation:** source, author/translator, edition/version, licence, and where we got it. This is stored in a `sources.json` registry and shown in the UI as a "Source" chip.
3. **The Quran text is never modified.** We use a verified text (Tanzil / KFGQPC / QUL IndoPak), check it with checksums, and render it with `translate="no"`.
4. **Where scholars differ, we show it.**
   - Revelation dates and order are **approximate**. Sources mostly follow narrations from Ibn Abbas, per [Tanzil's notes](https://tanzil.net/docs/revelation_order). We show "according to X" and give ranges, not exact years.
   - **Asbab al-Nuzul narrations vary in strength.** We show them as "narrated in al-Wahidi's *Asbab al-Nuzul*" and never as our own ruling. Where possible we label narration grading only from a cited source.
5. **Multiple translators.** We offer several recognised Urdu and English translations so we don't push one school of thought.
6. **Respect licences.** Some sources (e.g. QuranEnc) allow republishing only *without modification*, with credit and version number, and **no ads next to the translation**.
7. **Scholar review.** Before public launch, a qualified 'alim/mufti reviews which sources we picked and how the context is presented.

---

## 4. Authentic data sources

### Strategy: download, normalise, bundle as JSON
We don't call live APIs from the browser. A **build script** downloads each source once, converts it to our JSON schema, attaches the citation, and saves it to `/data`. Why:
- It's fast, works offline, and runs on free static hosting.
- Content is versioned and pinned, so we know exactly which edition we show.
- The [Quran Foundation API](https://api-docs.quran.foundation/docs/quickstart) needs **OAuth2 client credentials kept on a server**, so a pure static site can't call it directly.
- [QUL](https://qul.tarteel.ai/resources) says its resources are meant "to download and package with your own project; no API is available."

### Source table

| Data | Source | Access | Licence / terms | Status |
|---|---|---|---|---|
| **Arabic text (Uthmani)** | [Tanzil.net](https://tanzil.net) | Download | CC BY 3.0 (per file headers; verify) | ✅ Use |
| **Arabic text (IndoPak / Nastaliq-style, familiar to Pakistani readers)** | [QUL Quran script](https://qul.tarteel.ai/resources) | Download | Check per resource | ✅ Use (verify licence) |
| **Surah metadata**: ayah count, Makki/Madani, **revelation order**, ruku, juz, sajda | [Tanzil Quran Metadata](https://tanzil.net/docs/Quran_Metadata) | `quran-data.js` / XML | CC BY 3.0 | ✅ Use |
| **Urdu translations**: Fateh Muhammad Jalandhari, Muhammad Junagarhi, Maududi (Tafheem), Wahiduddin Khan, Mahmud al-Hasan (Tafsir-e-Usmani), Bayan-ul-Quran | [QUL translations](https://qul.tarteel.ai/resources) and [QuranEnc API](https://quranenc.com/en/home/api) | Download / no-auth API | QuranEnc: no modification, credit with version, no ads. Others: check per resource | ✅ Use (pick defaults) |
| **English translations**: Saheeh International, etc. | QuranEnc / QUL / [alquran.cloud](https://alquran.cloud) | Download | Per edition | ✅ Use |
| **Word-by-word Urdu + English** | [QUL WBW](https://qul.tarteel.ai/resources) (Urdu ID 93, English ID 92) | Download | Verify author and licence | ⚠️ Verify author |
| **Roots, lemmas, grammar** | [Quranic Arabic Corpus](https://corpus.quran.com) / QUL morphology | Download | GNU GPL + terms | ✅ Use (attribute) |
| **Surah introductions**: name, period of revelation, background, themes | [QUL Surah Info](https://qul.tarteel.ai/resources/surah-info) (Urdu + English). Quran.com's chapter info is reported to be based on **Maududi's *Tafhim al-Quran*** introductions | Download | Verify | ⚠️ Confirm original author |
| **Asbab al-Nuzul (reasons for revelation)** | **al-Wahidi (d. 468 AH)**. The Arabic original is classical (public domain). English by **Mokrane Guezzou**, [free on altafsir.com](https://www.altafsir.com/WahidiAsbabAlnuzul.asp) (Royal Aal al-Bayt Institute / Fons Vitae 2008) | Arabic: open texts. English: read-only online | **English is copyrighted.** Need permission from Aal al-Bayt to republish | ❗ Request permission. Until then, link only |
| **Tafsir** (Ibn Kathir, Urdu tafsirs) | QUL tafsirs (115) / Quran Foundation API | Download | Per resource | ✅ Phase 3 |
| **Topics & concepts** (prophets, places, themes) | [QUL topics](https://qul.tarteel.ai/resources) (from the Corpus ontology + Clear Quran themes) | Download | Verify | ✅ Use for stories |
| **Similar ayahs / mutashabihat** | QUL (4,001 similar ayahs / 5,278 mutashabihat) | Download | Verify | ✅ Phase 3 |
| **Audio + word-timing segments** (highlight each word as it's recited) | QUL recitations (58 segmented) / Quran.com audio CDN | Download / stream | Per reciter | ✅ Phase 1–2 |
| **Seerah timeline events** (Hijrah, Badr, Uhud, Taif, etc.) | **Needs a decision.** Options: *Ar-Raheeq Al-Makhtum* (Mubarakpuri, copyrighted), *Ibn Hisham* (classical, public-domain Arabic), or a scholar-curated list where every event cites its source | Manual curation | Depends | ❗ Decide source |
| Backup APIs | [alquran.cloud](https://alquran.cloud) (free, no key, soft rate limit), [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api) (jsDelivr CDN, 440+ editions) | Runtime/CDN | Per edition | Fallback only |

---

## 5. The experience: how people will "get it"

Learning research on context and reading points the same way: people understand and remember better when they get **context *before* reading** (an advance organiser), **meaning *during* reading** (no switching tabs), and **connections *after* reading** (spaced, linked review). We design for those three moments.

### A. Before you read: the **Surah Gateway**
A full-screen card when you open a surah:
- Name, its meaning (Urdu/English), Makki/Madani badge, number of ayahs
- **"Revealed #N of 114"** with a small 23-year timeline bar showing where it sits (as a range, cited)
- **Mini-map:** Makkah or Madinah
- **"What was happening then"**: 2–3 lines from the cited surah introduction
- Main themes as chips (from QUL themes)

### B. While you read: the **Reader**
- Arabic in **IndoPak** (default for Pakistan) or **Uthmani** script
- **Tap any word** to see its Urdu/English meaning, root, and "this root appears N times" with links
- Toggle modes: Arabic only · Arabic + WBW under each word · Arabic + full translation · translation only
- **Audio** with the current word highlighted
- An **ⓘ context dot** on ayahs that have a recorded reason for revelation; tapping it opens a side panel with the cited narration
- Urdu typeset in **Nastaliq** (e.g. Noto Nastaliq Urdu), right-to-left done properly

### C. After you read: **Connections**
- **Revelation Timeline (main visual):** 23 years laid out horizontally, Makkah period then Madinah period. Surahs placed by revelation order, Seerah events on a parallel track. Tap a surah to read it.
- **Mushaf order vs revelation order:** a grid of 114 tiles (sized by length, coloured Makki/Madani) that animates between the two orders. It shows instantly that the mushaf isn't chronological.
- **Map:** places mentioned in the Quran and places of revelation, linked to ayahs
- **Stories of the Prophets:** e.g. Musa (AS) appears across many surahs. Using the topics data, we collect his ayahs and show them as a journey, **in the Quran's own words** with translation, never retold by us.
- **Related ayahs:** similar ayahs and mutashabihat
- **Learn mode:** the most frequent Quranic words (counted from the corpus), so a reader can learn a small set of words that covers a large share of the text. We show the real computed percentage.

### Design feel
Calm, spacious and dignified. Paper-like light mode and a night mode. Subtle motion only, no gamified noise. Mobile-first, since most users will be on phones. No ads.

---

## 6. Technical architecture

**Stack (Phase 1):** plain **HTML + CSS + vanilla JS (ES modules)**. No framework, nothing to build, and it hosts free (GitHub Pages / Netlify / Cloudflare Pages). Visuals use **SVG + D3** (timeline, grid) and **Leaflet** (map). We can move to Svelte/React later if it grows.

```
quran-visualizer/
├── index.html                 # Home: surah grid + timeline entry
├── surah.html                 # Gateway + Reader
├── timeline.html              # Revelation timeline
├── stories.html               # Prophets & topics
├── css/  (tokens.css, reader.css, ...)
├── js/   (data.js, reader.js, timeline.js, word-popover.js, audio.js ...)
├── fonts/ (IndoPak, KFGQPC Uthmani, Noto Nastaliq Urdu)
├── data/
│   ├── sources.json           # citation registry (every source, licence, version, URL, date fetched)
│   ├── surahs.json            # 114 surahs: metadata + revelation order + intro refs
│   ├── surah/001.json … 114.json   # per-surah: ayahs, words, translations (lazy-loaded)
│   ├── asbab.json             # ayah → narration(s) with source refs
│   ├── topics.json, stories.json, seerah-events.json, places.json
└── scripts/                   # build scripts: fetch → normalise → validate → write /data
```

**Every record references a source ID:**
```json
{
  "key": "96:1",
  "arabic": { "text": "…", "src": "tanzil-uthmani-1.1" },
  "translations": [
    { "lang": "ur", "text": "…", "src": "jalandhari" },
    { "lang": "en", "text": "…", "src": "saheeh-intl" }
  ],
  "asbab": [{ "text": "…", "src": "wahidi-asbab", "ref": "p. 12" }]
}
```
```json
// sources.json
{ "jalandhari": { "title": "Urdu translation", "author": "Fateh Muhammad Jalandhari",
  "via": "QUL resource 218", "url": "…", "licence": "…", "version": "…", "fetched": "2026-11-15" } }
```

A **validation script** fails the build if any text has no `src`, if any Arabic checksum changes, or if any of the 6,236 ayahs is missing.

---

## 7. Roadmap

| Phase | Deliverable | Contents |
|---|---|---|
| **0: Foundations** | Data pipeline + rights | Build scripts, `sources.json`, validation. Send permission emails (Aal al-Bayt for the Wahidi English, QuranEnc confirmation, QUL dataset licences). Choose default translations. |
| **1: Understand while reading (MVP)** | Home + Surah Gateway + Reader | 114-surah grid, Makki/Madani + revelation order, surah intro (Urdu/English), IndoPak/Uthmani text, WBW tap popover, 2 Urdu + 1 English translation, audio per ayah, dark mode, mobile |
| **2: See the moment** | Timeline + Map + Order animation | Revelation timeline, mushaf-vs-revelation grid, Makkah/Madinah map, cited Seerah events track, word-highlighted audio |
| **3: Know the why** | Context layer | Asbab al-Nuzul panel (cited), short tafsir (Ibn Kathir / Urdu tafsir), related ayahs, topics |
| **4: Connect & learn** | Stories + Learn | Prophet stories from topic data, frequent-words learn mode, search (Urdu/English/Arabic root), bookmarks, offline PWA |
| **5: Grow** | More languages, scholar-reviewed notes, sharing cards | Later |

---

## 8. Risks & how we handle them

| Risk | Mitigation |
|---|---|
| Showing weak or contested narrations as fact | Attribute every narration to its book. Show disagreement. Scholar review before launch. |
| Dating surahs too precisely | Show order plus approximate ranges, cite the source of each order. |
| Translator choice seen as sectarian | Several recognised translators, user picks the default, neutral presentation |
| Licence violations | `sources.json` licence field, a build check, permission letters, links instead of copies where needed |
| Corrupted Arabic text | Verified sources only, checksums, no client-side text transforms |
| Urdu Nastaliq rendering on mobile | Test fonts early. Fall back to Naskh. |

---

## 9. Decisions needed from you

1. **Default Urdu translation:** Jalandhari, Junagarhi, Maududi (Tafheem), Taqi Usmani (if licensable), or let the user choose on first open?
2. **Default script:** IndoPak (familiar in Pakistan) or Uthmani?
3. **Seerah timeline source:** which book should be the reference for dates and events?
4. **Scholar reviewer:** do you have an 'alim/teacher who can review the source choices?
5. **Name / branding** for the platform.

---

## Sources consulted
- Quran Foundation API docs: <https://api-docs.quran.foundation/>, quickstart: <https://api-docs.quran.foundation/docs/quickstart>
- Quranic Universal Library (QUL): <https://qul.tarteel.ai/resources>, surah info: <https://qul.tarteel.ai/resources/surah-info>
- Tanzil metadata: <https://tanzil.net/docs/Quran_Metadata>, revelation order: <https://tanzil.net/docs/revelation_order>
- QuranEnc API & reuse terms: <https://quranenc.com/en/home/api>
- alquran.cloud terms: <https://alquran.cloud/terms-and-conditions>
- fawazahmed0 quran-api: <https://github.com/fawazahmed0/quran-api>
- Quranic Arabic Corpus: <https://corpus.quran.com>
- QuranWBW (open source): <https://github.com/marwan/quranwbw>
- al-Wahidi, *Asbab al-Nuzul*, tr. Guezzou: <https://www.altafsir.com/WahidiAsbabAlnuzul.asp>
- Maududi chapter introductions (mirror): <https://www.iium.edu.my/deed/quran/intro/i001.html>
- Seerah visual references: <https://siravisualizer.vercel.app/>, <https://ilmmaps.pages.dev/books/seerah.html>, <https://fussilat.com/walking_quran.html>, <https://www.thelastdialogue.org/quran-timeline-of-events/>
- Tarteel on Quran rendering: <https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/>
