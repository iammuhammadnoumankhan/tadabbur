# Tadabbur data contract

Every client reads the same static JSON in `data/`: the website now, and the mobile and desktop apps later. This file is the contract.

- **Schema version: 1.** It's recorded in `data/manifest.json` as `schema`.
  - Adding a field doesn't change the version; clients must ignore fields they don't know.
  - Renaming or removing a field, or changing a field's meaning or type, **bumps the version**. Clients refuse data with a version they don't support (`js/core/data.js` → `SCHEMA`).
- `scripts/validate_data.py` enforces the rules below in CI.

## Conventions
- **Ayah key:** `"surah:ayah"`, e.g. `"2:255"`. Surahs are 1–114; ayah counts come from `chapters.json`.
- **Global ayah index:** 0–6235 in mushaf order, used by the search files. Index = sum of the earlier surahs' ayah counts + (ayah − 1).
- **`NNN`:** the surah number zero-padded to 3 digits (`001` … `114`).
- **Word index:** 1-based within an ayah, matching `surah/NNN.json` → `w`.
- **`src`:** an id that must exist in `sources.json`. Every dataset carries one, either per file or per record.
- **Text is never altered:** Arabic, translations, tafsir and hadith are shown as fetched. Only footnote markers and unsafe HTML are stripped.
- **All paths are relative** (`data/...`), so the same files work under any web path or inside an app.

## Files

### `manifest.json`
`{ schema, built, counts: { surahs, ayahs, words, translations, tafsirs, hadith_linked, seerah_events, prophets }, datasets: [{ id, files, src }] }`

### `sources.json`
`{ <src id>: { title, publisher, url, fetched, via?, note?, lang? } }`
- `title`, `publisher`, `url` and `fetched` (YYYY-MM-DD) are required.

### `chapters.json`
An array of 114 items:

| Field | Meaning |
|---|---|
| `n` | Surah number |
| `ar` | Arabic name |
| `name` | Name, simple spelling |
| `nameC` | Name, with diacritics |
| `meaning` | `{ en, ur }` |
| `place` | `"makkah"` or `"madinah"` |
| `order` | Position in revelation order (1–114) |
| `ayahs` | Number of ayahs |
| `bismillah` | Whether the surah opens with the Bismillah |
| `pages` | `[first, last]` mushaf page |
| `src` | Source id |

### `surah/NNN.json`
`{ n, src: { text, wbw }, ayahs: [Ayah] }`
- `Ayah`: `{ k, n, id, u, i, juz, page, sajdah, w: [Word] }`
  - `id` is the global ayah id (1–6236), used for audio.
  - `u` is the Uthmani text, unmodified (fingerprinted in `checksums.json`).
  - `i` is Quran.com's IndoPak text, kept for reference. The reader uses `indopak/` instead.
- `Word`: `{ u, i, tl, en, ur, a }`
  - `u`, `i`: Uthmani and IndoPak spelling
  - `tl`: transliteration
  - `en`, `ur`: English and Urdu meaning
  - `a`: relative audio path on `audio.qurancdn.com`

### `indopak/NNN.json`
`{ src, bismillah, ayahs: [[word, …], …] }`
- The DigitalKhatt IndoPak text, with **exactly one entry per `surah/NNN.json` word**.
- Fingerprinted in `checksums-indopak.json` (SHA-256 of the words joined with spaces, first 16 hex characters).

### `tajweed/NNN.json`, `checksums-tajweed.json`
`{ src, ayahs: [[word html, …], …] }`, with **one entry per `surah/NNN.json` word**.
- **Text:** Quran.com's tajweed Uthmani text, as published. It's a slightly different Uthmani encoding from `surah/NNN.json` → `u`, so it is never mixed with it.
- **Markup:** only `<span class="tj tj-RULE">…</span>` (may nest). The build fails on anything else.
- **Fingerprints:** `checksums-tajweed.json`, a SHA-256 of each ayah's words with markup removed, joined with spaces.

### `checksums.json`, `checksums-indopak.json`, `checksums-tajweed.json`
`{ "<surah>": ["<16 hex>", …] }`, one entry per ayah.

### `translations.json`, `tr/<id>/NNN.json`
- `translations.json`: `{ default: [id…], list: [{ id, lang, name, src }] }`
  - `lang` is `ur`, `ur-Latn` (Roman Urdu) or `en`.
- `tr/<id>/NNN.json`: an array of strings, one per ayah. A string may be empty where the source has no text.

### `info/NNN.json`
`{ src, en: Intro, ur: Intro }`
- `Intro`: `{ html, short, source, lang }`
- `html` is third-party HTML and **must be sanitised** before display.
- `source` names the original author, e.g. Tafhim al-Quran.

### `tafsirs.json`
`{ api, default: { ur, en }, list: [{ id, lang, name, author, src }] }`
- Tafsir text isn't bundled. Fetch it from `api`, after replacing `{id}` and `{key}`.
- The response's `tafsir.verses` lists every ayah the passage covers. Sanitise `tafsir.text` before display.

### `hadith-index.json`, `hadith/NNN.json`
- `hadith-index.json`: `{ "<surah>": { "<ayah key>": count } }`
- `hadith/NNN.json`: `[{ c, num, book, bookName, inBook, en, ur, ar, refs: [key…], url }]`
  - `c` is `"bukhari"` or `"muslim"`.
  - `refs` lists only the ayahs the hadith's own text cites.
- Source: `sahih-hadith-text`.

### `seerah.json`, `seerah/<event id>.json`, `seerah-by-surah.json`
- `seerah.json`: `{ src, frame, anchors, events, note }`
  - `frame`: `{ years, makkah, madinah, hadith, text, ur, url }`
  - `anchors`: `[{ id, year, hadith, how, url }]`. A year is given only where a hadith states the time.
  - `events`: `[{ id, order, name: { en, ur }, period, range: [first, last], count, first, refs, surahs, year|null }]`
    - `order` is Imam al-Bukhari's chapter order.
- `seerah/<id>.json`: `[{ num, en, ur, ar, refs, url }]`
- `seerah-by-surah.json`: `{ "<surah>": [event id…] }`

### `stories.json`, `stories-by-surah.json`
- `stories.json`: `{ src, prophets: [Prophet], names: { concept id: name }, filtered, unaligned }`
- `Prophet`: `{ id, en, ar, cats, names: [{ id, en, ar }], relations: [[rel, a, b]], mentions: [{ k, w, as }], ayahs, surahs, url }`
  - `w` is the word index the Quranic Arabic Corpus ontology tags.
  - `as` is the name variant used (e.g. `"messiah"`).
- `stories-by-surah.json`: `{ "<surah>": [prophet id…] }`

### `morph/NNN.json`, `roots/index.json`, `roots/<id>.json`
- `morph/NNN.json`: `{ src, ayahs: [[Word|null, …], …] }`, with **one entry per `surah/NNN.json` word**.
  - `Word` is `[root, lemma, pos, features]`.
  - `root`: Arabic root letters (e.g. `"صبر"`), or `null` for particles and names without a root.
  - `lemma`: dictionary form with harakat.
  - `pos`: Corpus part-of-speech tag (`N`, `V`, `P`, `PN`, …).
  - `features`: verb form, aspect and participle tags joined with `|`, e.g. `"IMPV|(X)"` or `"ACT|PCPL"`.
- `roots/index.json`: `{ src, roots: [{ id, r, b, n, l: [[lemma, count], …] }] }`
  - `id`: position in Arabic alphabetical order, also the occurrence file name.
  - `b`: the Buckwalter spelling, for `corpus.quran.com/qurandictionary.jsp?q=<b>`.
  - `n`: number of occurrences.
- `roots/<id>.json`: every occurrence of that root, as `["s:a:w", …]`.
- Source: `qac-morphology` (Quranic Arabic Corpus v0.4, used unchanged).

### `vocab.json` (most frequent words)
`{ src, total, items: [{ k, l, r, p, n, en, ur, ex }] }`, with items **sorted by `n`, most frequent first**.

| Field | Meaning |
|---|---|
| `total` | All words in the Quran (77,429) |
| `k` | `"lemma|root"`: the key for a reader's known words (settings `known`) |
| `l` | Dictionary form (lemma) |
| `r` | Root, or `null` |
| `p` | Most common part-of-speech tag |
| `n` | Occurrences |
| `en`, `ur` | `[[gloss, count], …]`: the top 3 Quran.com word-by-word meanings used for this form, as published |
| `ex` | `"s:a:w"`, the first occurrence |

Sources: `tadabbur-vocab` (counts) and `qac-morphology`.

### `layout/<mushaf>/index.json`, `layout/<mushaf>/PPP.json` (mushaf page view)
- `<mushaf>` is `madani` (604 pages, from Quran.com word page/line numbers) or `indopak` (15-line, 610 pages, from the DigitalKhatt text's own pages and lines).
- `PPP.json`: `{ page, lines: [Line, …] }`. Line is one of:
  - `{ t: "w", w: ["s:a:w" | "s:a:e", …] }`: words in reading order, where `e` is an ayah-end marker;
  - `{ t: "s", s }`: a surah name line;
  - `{ t: "b" }`: the Bismillah;
  - `{ t: "x" }`: a blank line.
- `index.json`: `{ pages, src, surah: { n: first page }, ayah: { n: [page of each ayah] } }`
- Only **positions** are stored. The words are our existing text (Uthmani, tajweed or IndoPak), never copied.
- `validate_data.py` checks that every word appears exactly once and in order, every ayah has its end marker, and every surah has one heading.

### `audio/reciters.json`, `audio/<reciter id>/NNN.json` (recitations with word timings)
- `audio/reciters.json`: `{ default, list: [{ id, name, style, src }] }`. `id` is the Quran.com recitation id.
- `audio/<id>/NNN.json`: `{ src, url, ms, ayahs: [[fromMs, toMs, [[word, startMs, endMs], …]], …] }`
  - `url` is the full-surah audio file, streamed live (not bundled).
  - Times are milliseconds into that file.
  - `word` is the 1-based word index (as in `surah/NNN.json`).
  - Words a reciter repeats appear again, as recited.
  - Incomplete or backwards entries from the source are dropped.

### `family.json` (prophets family tree)
`{ src, people: { id: { en, ar, prophet } }, links: [[rel, child, parent], …] }`
- `rel` is one of `son-of`, `daughter-of` or `adopted-son-of`, **only as the Quranic Arabic Corpus ontology states it**. Nothing is inferred (no siblings or grandparents).
- `people` holds all 24 prophets, plus the relatives the links reach (e.g. Azar, Imran, Maryam), with the ontology's English and Arabic names.

### `search/ar.json`, `search/tr-<id>.json`
Each is an array of 6,236 strings, in global ayah index order.
- `ar.json`: Quran.com plain Arabic (`imlaei_simple`), used **only for matching**.
- `tr-<id>.json`: the same text as `tr/<id>/*`, concatenated.

## Stored on the reader's device (not in `data/`)
Clients keep two small records through the same storage adapter: `localStorage` on the web, or an app's own store via `settings.configureStorage()`, followed by `progress.reload()`.

- **`tadabbur.settings`:** reader choices; see `DEFAULTS` in `js/core/settings.js`.
- **`tadabbur.progress`** (`js/core/progress.js`), version 1:

  | Field | Shape |
  |---|---|
  | `v` | `1` |
  | `last` | `{ key, at, where: "reader" | "mushaf", mushaf?, page? }` or `null` |
  | `bookmarks` | `[{ key, at }]` |
  | `notes` | `{ "s:a": { text, at } }` |
  | `khatm` | `{ start: "YYYY-MM-DD", days, read: <base64 bitset of the 6,236 ayahs by global index> }` or `null` |
  | `done` | `[{ start, end }]` |
  | `log` | `{ "YYYY-MM-DD": ayahs read that day }` |

  - The backup file is the same object plus `"app": "tadabbur"`.
  - It's designed to sync later: times are epoch milliseconds, keys are ayah keys, and reading is a fixed-size bitset.

## Live services (not bundled)

| What | URL |
|---|---|
| Surah recitation (with timings) | `audio/<id>/NNN.json` → `url` (download.quranicaudio.com) |
| Ayah audio (fallback only) | `https://cdn.islamic.network/quran/audio/128/ar.alafasy/<ayah id>.mp3` |
| Word audio | `https://audio.qurancdn.com/<Word.a>` |
| Tafsir | `tafsirs.json` → `api` |

`scripts/check_links.py` checks all three weekly.
