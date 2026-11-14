// Tadabbur interface text lookup. No DOM.
//   t("common.ayahs", { n: 3 })  -> "3 ayahs"
// A missing key renders as ⟦key⟧ so tests catch it (scripts/smoke_test.py).

import en from "./en.js";

const dictionaries = { en };
let lang = "en";

export const languages = () => Object.keys(dictionaries);
export const language = () => lang;
export const direction = () => (lang === "ur" ? "rtl" : "ltr");

export function setLanguage(l) {
  if (dictionaries[l]) lang = l;
}

/** Register another language, e.g. registerLanguage("ur", ur). */
export function registerLanguage(l, dict) {
  dictionaries[l] = dict;
}

export function t(key, vars = {}) {
  let s = dictionaries[lang]?.[key] ?? en[key];
  if (s == null) return `⟦${key}⟧`;
  if (typeof s === "object") s = Number(vars.n) === 1 ? s.one : s.other;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}
