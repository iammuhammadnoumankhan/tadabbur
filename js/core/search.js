// Tadabbur core: search. No DOM. Returns plain data that any UI can render.

import * as data from "./data.js";
import { ayahIndex } from "./quran.js";

// ---------------------------------------------------------------- normalisation
// Keeps a map from each normalised character back to the original text, so
// matches can be highlighted in the text exactly as published.
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ​-‏﻿]/;
const AR_MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ے": "ي", "ئ": "ي", "ک": "ك",
  "ة": "ه", "ۃ": "ه", "ہ": "ه", "ھ": "ه", "ؤ": "و", "ۓ": "ي" };

export const isArabicScript = s => /[؀-ۿ]/.test(s);

export function norm(s) {
  let n = "";
  const map = [];
  const src = s || "";
  for (let i = 0; i < src.length; i++) {
    let ch = src[i];
    if (AR_MARKS.test(ch)) continue;
    if (AR_MAP[ch] !== undefined) ch = AR_MAP[ch];
    else ch = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’‘`]/g, "'");
    for (const c of ch) { n += c; map.push(i); }
  }
  return { n, map };
}
export const normText = s => norm(s).n;

/** Character ranges [start, end) in the ORIGINAL text where any word matches. */
export function findRanges(normed, words) {
  const ranges = [];
  for (const w of words) {
    let from = 0, i;
    while ((i = normed.n.indexOf(w, from)) !== -1) {
      ranges.push([normed.map[i], normed.map[i + w.length - 1] + 1]);
      from = i + w.length;
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------- query parts
export function matchSurahs(q, chapters) {
  const t = q.trim();
  if (/^\d{1,3}$/.test(t)) return chapters.filter(c => c.n === +t);
  const nq = normText(t).replace(/[-'\s]/g, "");
  if (nq.length < 2) return [];
  return chapters.filter(c => [c.name, c.nameC, c.meaning.en, c.meaning.ur, c.ar]
    .some(x => normText(x).replace(/[-'\s]/g, "").includes(nq)));
}

export function matchProphets(q, prophets) {
  const nq = normText(q).trim();
  if (nq.length < 2) return [];
  return prophets.filter(p => p.names.some(n => normText(n.en).startsWith(nq) || normText(n.ar).includes(nq)));
}

/** "2:255", "2 255", "2.255" or "Baqarah 255" -> [surah, ayah] (validated), else null. */
export function parseRef(q, chapters) {
  let m = q.match(/^\s*(\d{1,3})\s*[:.\s]\s*(\d{1,3})\s*$/);
  let ref = null;
  if (m) ref = [+m[1], +m[2]];
  else if ((m = q.match(/^\s*(.+?)\s+(\d{1,3})\s*$/))) {
    const c = matchSurahs(m[1], chapters)[0];
    if (c) ref = [c.n, +m[2]];
  }
  if (!ref) return null;
  const c = chapters[ref[0] - 1];
  return c && ref[1] >= 1 && ref[1] <= c.ayahs ? ref : null;
}

// ---------------------------------------------------------------- full search
const prepared = new Map();          // field -> normalised texts (built once)
async function field(f) {
  if (!prepared.has(f)) prepared.set(f, data.searchText(f).then(arr => arr.map(norm)));
  return prepared.get(f);
}

/**
 * Search the Quran.
 * @param {string} query
 * @param {{scope?: "all"|"ar"|string, translations: Array<{id, lang}>}} opts
 * @returns {Promise<{ref, surahs, prophets, fields, words, hits: Array<{index, key, matches: {[field]: ranges}}>}>}
 *   Every word must appear (any order). Arabic/Urdu queries search the Arabic and Urdu
 *   translations; Latin queries search English and Roman Urdu. A chosen scope overrides that.
 */
export async function search(query, { scope = "all", translations = [] } = {}) {
  const q = (query || "").trim();
  const [chapters, st] = await Promise.all([data.chapters(), data.stories()]);
  const out = { ref: null, surahs: [], prophets: [], fields: [], words: [], hits: [] };
  if (!q) return out;

  out.ref = parseRef(q, chapters);
  out.surahs = matchSurahs(q, chapters);
  out.prophets = matchProphets(q, st.prophets);
  out.words = normText(q).split(/\s+/).filter(w => w.length >= 2 || isArabicScript(w));
  if (out.ref || !out.words.length) return out;

  const arabicQ = isArabicScript(q);
  if ((scope === "all" || scope === "ar") && arabicQ) out.fields.push("ar");
  for (const t of translations) {
    if (scope !== "all" && scope !== String(t.id)) continue;
    if ((t.lang === "ur") === arabicQ || scope === String(t.id)) out.fields.push(t.id);
  }
  const texts = await Promise.all(out.fields.map(field));
  const { keys } = ayahIndex(chapters);
  for (let i = 0; i < keys.length; i++) {
    const matches = {};
    out.fields.forEach((f, fi) => {
      const n = texts[fi][i];
      if (out.words.every(w => n.n.includes(w))) matches[f] = findRanges(n, out.words);
    });
    if (Object.keys(matches).length) out.hits.push({ index: i, key: keys[i], matches });
  }
  return out;
}
