// Tadabbur core: learning the most frequent words. No DOM.
// Word list: data/vocab.json (dictionary forms counted over all 77,429 words).

import { getJSON } from "./data.js";
import * as settings from "./settings.js";

export const vocab = () => getJSON("data/vocab.json");

/** The reader's known words as a Set of "lemma|root" keys. */
export const knownSet = () => new Set(settings.get().known || []);

export function setKnown(key, known) {
  const s = knownSet();
  if (known) s.add(key); else s.delete(key);
  settings.set({ known: [...s] });
}

/** How much of the Quran the known words cover: { words, occurrences, total, pct }. */
export function coverage(v, known = knownSet()) {
  let occ = 0, words = 0;
  for (const it of v.items) if (known.has(it.k)) { occ += it.n; words++; }
  return { words, occurrences: occ, total: v.total, pct: (occ / v.total) * 100 };
}

/** Coverage if you learn the top N words, for each N in `points`: [{ n, pct }]. */
export function coverageCurve(v, points = [10, 25, 50, 100, 250, 500, 1000, 2000]) {
  const out = [];
  let cum = 0, i = 0;
  for (const p of points) {
    for (; i < p && i < v.items.length; i++) cum += v.items[i].n;
    out.push({ n: p, pct: (cum / v.total) * 100 });
  }
  return out;
}

/** The next `count` most frequent words not yet known (optionally only one part of speech group). */
export function nextToLearn(v, count = 20, { known = knownSet(), group = "all" } = {}) {
  return v.items.filter(it => !known.has(it.k) && inGroup(it.p, group)).slice(0, count);
}

const VERBS = new Set(["V"]);
const NOUNS = new Set(["N", "PN", "ADJ", "IMPN"]);
/** "all" | "nouns" | "verbs" | "particles" (everything else: particles, pronouns, …). */
export function inGroup(pos, group) {
  if (group === "all") return true;
  if (group === "verbs") return VERBS.has(pos);
  if (group === "nouns") return NOUNS.has(pos);
  return !VERBS.has(pos) && !NOUNS.has(pos);
}
