# Tadabbur (تدبّر)

**Understand the Quran as you read it.** You get word-by-word meaning in Urdu and English, 16 translations to choose from, revelation order and place, surah introductions, and the Sahih al-Bukhari hadith that cite each ayah. Every line comes from a cited source. Nothing religious is written by us.

## Run locally
```bash
python3 scripts/serve.py 8765
```
Then open http://localhost:8765.

## Rebuild the data
```bash
python3 scripts/build_data.py
```
Then build the IndoPak script (DigitalKhatt text + OFL font, aligned word-for-word to Quran.com's word list):
```bash
python3 scripts/build_indopak.py
```
Then build the Seerah timeline (Sahih al-Bukhari only):
```bash
python3 scripts/build_seerah.py
```
Then build the prophets data (Quranic Arabic Corpus ontology):
```bash
python3 scripts/build_stories.py
```
Raw downloads are cached in `.cache/` (git-ignored). The output goes to `data/`:

| File | What |
|---|---|
| `chapters.json` | 114 surahs: names, meaning (ur/en), Makki/Madani, revelation order, ayah count |
| `surah/NNN.json` | Ayahs in Uthmani script, with word-by-word Urdu/English meaning and transliteration |
| `indopak/NNN.json` | The same ayahs in IndoPak script (DigitalKhatt), one entry per Quran.com word; rendered with `fonts/DigitalKhatt-IndoPak.woff2` (SIL OFL 1.1) |
| `tr/{id}/NNN.json` | One translation for one surah (8 Urdu + Roman Urdu, 8 English) |
| `info/NNN.json` | Surah introduction in Urdu and English (author named in its `source` field) |
| `hadith/NNN.json`, `hadith-index.json` | Sahih al-Bukhari hadith whose own text cites an ayah reference |
| `seerah.json`, `seerah/<id>.json`, `seerah-by-surah.json` | 24 Seerah events (each one a chapter of Sahih al-Bukhari, given by hadith-number range) and 5 dated moments, each dated only by a hadith that states the time |
| `stories.json`, `stories-by-surah.json` | The 24 prophets and messengers in the Quranic Arabic Corpus ontology, with every ayah it tags as referring to each (name variants grouped only where the ontology says so) |
| `tafsirs.json` | The 7 tafsirs offered (4 Urdu, 3 English). The commentary itself is too large to bundle (hundreds of MB), so the reader fetches each ayah's tafsir live from Quran.com's public API and shows it as published |
| `sources.json` | Citation registry: every source, its publisher, URL and retrieval date |
| `checksums.json` | SHA-256 fingerprint of every ayah's Arabic text |

## Content rules
- Content is only fetched from established sources and is never written or paraphrased by us.
- A hadith is linked to an ayah **only** when the hadith's published translation itself cites that ayah. Each one links to sunnah.com so it can be checked.
- Revelation order is shown as approximate, because scholars differ on it.

## Known gaps
- **Sahih Muslim:** its English edition doesn't write ayah references inside the hadith text, so none of its hadith are linked yet. We need a source that maps Muslim's hadith to ayahs.
- **Seerah order:** apart from the 5 dated moments, events follow Imam al-Bukhari's chapter order, which isn't strictly chronological (e.g. Tabuk comes after the Farewell Hajj). Surahs on the timeline are spaced by revelation order, not by date.
- **Prophets:** the Corpus tags mostly where a prophet is named, so ayahs that continue his story without naming him aren't listed. Each ayah links to its full passage. Dhul-Kifl is classed in the ontology as a "historic person", not a prophet, so he isn't included.
- Not built yet: map, asbab al-nuzul, search (see the roadmap).

See [RESEARCH_AND_PLAN.md](RESEARCH_AND_PLAN.md) for the research and roadmap.
