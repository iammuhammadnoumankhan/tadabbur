// Tadabbur core: loading data (see docs/DATA.md). No DOM.
// Works in a browser page, a Web Worker, or an app webview.

import { pad3 } from "./quran.js";
import * as settings from "./settings.js";

/** Data schema this code understands; must match data/manifest.json. */
export const SCHEMA = 1;

let BASE = "";                       // "" = relative to the page; apps may set an absolute URL
let fetchImpl = (...a) => globalThis.fetch(...a);
const cache = new Map();

/** For apps: where the data lives and how to fetch it. */
export function configure({ base, fetch } = {}) {
  if (base !== undefined) BASE = base.endsWith("/") || base === "" ? base : base + "/";
  if (fetch) fetchImpl = fetch;
  cache.clear();
}

export function getJSON(path) {
  const url = /^https?:\/\//.test(path) ? path : BASE + path;
  if (!cache.has(url)) {
    cache.set(url, fetchImpl(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    }).catch(e => { cache.delete(url); throw e; }));
  }
  return cache.get(url);
}

// ---------------------------------------------------------------- manifest
export const manifest = () => getJSON("data/manifest.json");
export async function checkSchema() {
  const m = await manifest();
  if (m.schema !== SCHEMA) throw new Error(`Data schema ${m.schema} is not supported (expected ${SCHEMA})`);
  return m;
}

// ---------------------------------------------------------------- Quran
export const chapters = () => getJSON("data/chapters.json");
export const sources = () => getJSON("data/sources.json");
export const surah = n => getJSON(`data/surah/${pad3(n)}.json`);
export const indopak = n => getJSON(`data/indopak/${pad3(n)}.json`);
export const info = n => getJSON(`data/info/${pad3(n)}.json`);
/** Tajweed-coloured words (Quran.com): ayahs[i][w] = sanitised HTML with <span class="tj tj-RULE">. */
export const tajweed = n => getJSON(`data/tajweed/${pad3(n)}.json`);

/** IndoPak words for surah n when that script is chosen, else null (use Uthmani from surah()). */
export const scriptText = n => settings.get().script === "indopak" ? indopak(n) : Promise.resolve(null);

// ---------------------------------------------------------------- translations
export const translations = () => getJSON("data/translations.json");
export const tr = (id, n) => getJSON(`data/tr/${id}/${pad3(n)}.json`);

/** The reader's chosen translations (metadata), in the order chosen. */
export async function selectedTranslations() {
  const t = await translations();
  const chosen = settings.get().translations;
  const ids = chosen && chosen.length ? chosen : t.default;
  return ids.map(id => t.list.find(x => x.id === id)).filter(Boolean);
}

// ---------------------------------------------------------------- tafsir (fetched live)
export const tafsirs = () => getJSON("data/tafsirs.json");
export async function tafsirFor(id, key) {
  const t = await tafsirs();
  return getJSON(t.api.replace("{id}", id).replace("{key}", key));
}

// ---------------------------------------------------------------- hadith, Seerah, prophets
export const hadithIndex = () => getJSON("data/hadith-index.json");
export const hadith = n => getJSON(`data/hadith/${pad3(n)}.json`).catch(() => []);
export const seerah = () => getJSON("data/seerah.json");
export const seerahEvent = id => getJSON(`data/seerah/${id}.json`);
export const seerahBySurah = () => getJSON("data/seerah-by-surah.json").catch(() => ({}));
export const stories = () => getJSON("data/stories.json");
/** { src, people: {id: {en, ar, prophet}}, links: [["son-of"|"daughter-of"|"adopted-son-of", child, parent], …] } */
export const family = () => getJSON("data/family.json");
/** { src, places: [{ id, en, ar, type, names, mentions, ayahs, url, at: {qid, label, lat, lon, x, y, region} | null }], map } */
export const places = () => getJSON("data/places.json");
/** Ayahs sharing 5+ identical consecutive words: { "s:a": [["other s:a", [[start, length, otherStart], …]], …] }. */
export const similarIndex = () => getJSON("data/similar/index.json").catch(() => ({}));
export const similar = n => getJSON(`data/similar/${pad3(n)}.json`).catch(() => ({}));
export const storiesBySurah = () => getJSON("data/stories-by-surah.json").catch(() => ({}));

// ---------------------------------------------------------------- word roots (Quranic Arabic Corpus)
/** Per-ayah word morphology for surah n: ayahs[i][w] = [root, lemma, pos, features] or null. */
export const morph = n => getJSON(`data/morph/${pad3(n)}.json`);
export const rootsIndex = () => getJSON("data/roots/index.json");
export const rootOccurrences = id => getJSON(`data/roots/${id}.json`);
let rootIdCache = null;
/** Root (Arabic letters) -> index entry { id, r, b, n, l }. */
export async function rootByLetters(r) {
  if (!rootIdCache) rootIdCache = rootsIndex().then(ix => new Map(ix.roots.map(x => [x.r, x])));
  return (await rootIdCache).get(r) || null;
}
/** Corpus dictionary page for a root, e.g. https://corpus.quran.com/qurandictionary.jsp?q=Sbr */
export const corpusRootUrl = bw => `https://corpus.quran.com/qurandictionary.jsp?q=${encodeURIComponent(bw)}`;

// ---------------------------------------------------------------- mushaf page layouts
/** { pages, src, surah: {n: first page}, ayah: {n: [page per ayah]} } for "madani" or "indopak". */
export const layoutIndex = m => getJSON(`data/layout/${m}/index.json`);
/** { page, lines: [{t:"w", w:["s:a:w"|"s:a:e"]} | {t:"s", s} | {t:"b"} | {t:"x"}] } */
export const layoutPage = (m, p) => getJSON(`data/layout/${m}/${pad3(p)}.json`);

// ---------------------------------------------------------------- recitations with word timings
export const reciters = () => getJSON("data/audio/reciters.json");
/** { url, ms, ayahs: [[fromMs, toMs, [[word, startMs, endMs], …]], …] } for one reciter + surah. */
export const audioTimings = (rid, n) => getJSON(`data/audio/${rid}/${pad3(n)}.json`);
/** The reader's chosen reciter (metadata). */
export async function selectedReciter() {
  const r = await reciters();
  return r.list.find(x => x.id === settings.get().reciter) || r.list.find(x => x.id === r.default);
}

// ---------------------------------------------------------------- search index
export const searchText = field => getJSON(field === "ar" ? "data/search/ar.json" : `data/search/tr-${field}.json`);

// ---------------------------------------------------------------- audio (streamed live)
export const audioUrl = {
  ayah: id => `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${id}.mp3`,
  word: path => `https://audio.qurancdn.com/${path}`,
};
