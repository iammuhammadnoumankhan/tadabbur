// Tadabbur core: Quran reference helpers. No DOM, no network.

export const pad3 = n => String(n).padStart(3, "0");
export const toArabicDigits = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
export const splitKey = k => k.split(":").map(Number);           // "2:255" -> [2, 255]

/** All 6,236 ayah keys in mushaf order, plus key -> global index. */
export function ayahIndex(chapters) {
  const keys = chapters.flatMap(c => Array.from({ length: c.ayahs }, (_, i) => `${c.n}:${i + 1}`));
  const index = Object.fromEntries(keys.map((k, i) => [k, i]));
  return { keys, index };
}

export function isValidKey(chapters, k) {
  const [s, a] = splitKey(k);
  const c = chapters[s - 1];
  return !!c && a >= 1 && a <= c.ayahs;
}
