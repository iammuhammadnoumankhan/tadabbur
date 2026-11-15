// Tadabbur core: reader settings. No DOM.
// Storage is pluggable: the browser uses localStorage; a mobile/desktop app can
// pass its own adapter ({ getItem, setItem }) with configureStorage().

const KEY = "tadabbur.settings";

export const DEFAULTS = Object.freeze({
  theme: "auto",          // auto | light | dark
  script: "indopak",      // indopak (DigitalKhatt) | uthmani (Quran.com) | tajweed (Quran.com, coloured)
  wbw: true,              // show word-by-word meanings
  wbwLang: "ur",          // ur | en | both
  translations: null,     // [translation id…]; null = defaults from translations.json
  arSize: 34,             // Arabic font size (px)
  showTranslit: false,
  uiMeaning: "ur",        // language for surah meanings, intros, hadith and tafsir defaults
  uiLang: "en",           // interface language (Urdu interface comes later, see ROADMAP)
  tafsir: null,           // chosen tafsir id; null = default for uiMeaning
  known: [],              // vocabulary keys ("lemma|root") the reader has marked as known
  reciter: null,          // recitation id (data/audio/reciters.json); null = default
  followWords: true,      // highlight each word while it's recited
});

function browserStorage() {
  try {
    const s = globalThis.localStorage;
    s.getItem(KEY);                                // throws when storage is blocked
    return s;
  } catch {
    return null;
  }
}

let storage = browserStorage();
let settings = read();
const listeners = new Set();

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(storage?.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Use a different storage (e.g. an app's preferences store). */
export function configureStorage(adapter) {
  storage = adapter;
  settings = read();
  listeners.forEach(fn => fn(settings, { ...settings }));
}

export const get = () => settings;

export function set(patch) {
  settings = { ...settings, ...patch };
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* storage full or blocked */ }
  listeners.forEach(fn => fn(settings, patch));
}

/** Subscribe to changes; returns an unsubscribe function. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
