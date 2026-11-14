// Tadabbur — shared helpers: data loading, settings, header, theme.

const cache = new Map();
export async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    }));
  }
  return cache.get(path);
}
export const pad3 = n => String(n).padStart(3, "0");
export const chapters = () => getJSON("data/chapters.json");
export const translations = () => getJSON("data/translations.json");
export const sources = () => getJSON("data/sources.json");
export const surah = n => getJSON(`data/surah/${pad3(n)}.json`);
export const info = n => getJSON(`data/info/${pad3(n)}.json`);
export const indopak = n => getJSON(`data/indopak/${pad3(n)}.json`);

// Arabic text of one ayah / word in the reader's chosen script.
// IndoPak words come from DigitalKhatt, aligned 1:1 to Quran.com's word list.
export async function scriptText(n) {
  if (settings.script !== "indopak") return null;
  return indopak(n);
}
export const tr = (id, n) => getJSON(`data/tr/${id}/${pad3(n)}.json`);
export const hadithIndex = () => getJSON("data/hadith-index.json");
export const tafsirs = () => getJSON("data/tafsirs.json");
// Tafsir is fetched live from Quran.com's public API (CORS-enabled), one ayah at a time.
export async function tafsirFor(id, key) {
  const t = await tafsirs();
  return getJSON(t.api.replace("{id}", id).replace("{key}", key));
}
export const hadith = n => getJSON(`data/hadith/${pad3(n)}.json`).catch(() => []);

export const WORD_AUDIO = "https://audio.qurancdn.com/";
export const AYAH_AUDIO = id => `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${id}.mp3`;

// ---------- settings (per-viewer convenience; safe if storage is blocked)
const DEFAULTS = {
  theme: "auto",          // auto | light | dark
  script: "indopak",      // indopak (DigitalKhatt text + font) | uthmani (Quran.com text)
  wbw: true,
  wbwLang: "ur",          // ur | en | both
  translations: null,     // null => defaults from translations.json
  arSize: 34,
  showTranslit: false,
  uiMeaning: "ur",        // which language to show surah meanings in
  tafsir: null,           // chosen tafsir id (null => default for uiMeaning)
};
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem("tadabbur.settings") || "{}")); } catch {}
const listeners = new Set();
export const get = () => settings;
export function set(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem("tadabbur.settings", JSON.stringify(settings)); } catch {}
  applyTheme();
  listeners.forEach(fn => fn(settings, patch));
}
export const onChange = fn => listeners.add(fn);

export function applyTheme() {
  const t = settings.theme === "auto"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : settings.theme;
  document.documentElement.dataset.theme = t;
  document.documentElement.style.setProperty("--ar-size", settings.arSize + "px");
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

export async function selectedTranslations() {
  const t = await translations();
  const ids = (settings.translations && settings.translations.length) ? settings.translations : t.default;
  return ids.map(id => t.list.find(x => x.id === id)).filter(Boolean);
}

// ---------- tiny DOM helpers
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const isUrdu = lang => lang === "ur";

export const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="7" cy="18" r="2" fill="var(--surface)"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
};

// ---------- header
export function header(active = "") {
  const theme = document.documentElement.dataset.theme;
  const el = h("header", { class: "top" },
    h("div", { class: "wrap" },
      h("a", { class: "brand", href: "index.html" },
        h("span", { class: "mark" }, "ت"),
        h("span", { class: "t" }, "Tadabbur"),
        h("span", { class: "ar" }, "تدبّر")),
      h("nav", { class: "nav" },
        h("a", { href: "index.html#surahs", class: active === "surahs" ? "on" : null }, "Surahs"),
        h("a", { href: "timeline.html" }, h("span", { class: "label" }, "Seerah "), "Timeline"),
        h("a", { href: "sources.html" }, "Sources"),
        h("button", {
          class: "icon-btn", title: "Toggle theme", "aria-label": "Toggle theme",
          html: theme === "dark" ? ICON.sun : ICON.moon,
          onclick: e => {
            const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            set({ theme: next });
            e.currentTarget.innerHTML = next === "dark" ? ICON.sun : ICON.moon;
          },
        }))));
  document.body.prepend(el);
}

export function footer() {
  document.body.append(h("footer", { class: "foot" }, h("div", { class: "wrap" },
    "Tadabbur shows only content from cited, established sources. Nothing religious here is written by us. ",
    h("a", { href: "sources.html" }, "See every source and its licence."))));
}

// ---------- tooltip
let tipEl;
export function tip(e, html) {
  if (!tipEl) { tipEl = h("div", { class: "tip" }); document.body.append(tipEl); }
  if (!html) { tipEl.style.display = "none"; return; }
  tipEl.innerHTML = html;
  tipEl.style.display = "block";
  const x = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8);
  const y = Math.max(8, e.clientY - tipEl.offsetHeight - 12);
  tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
}

// ---------- revelation journey bars (shared by home + surah page)
export function journeyBars(chs, { current = null, onHover = true } = {}) {
  const byOrder = [...chs].sort((a, b) => a.order - b.order);
  const max = Math.sqrt(Math.max(...chs.map(c => c.ayahs)));
  const wrap = h("div", { class: "journey-bars", role: "list" });
  for (const c of byOrder) {
    const a = h("a", {
      href: `surah.html?n=${c.n}`, role: "listitem",
      class: `${c.place}${c.n === current ? " cur" : ""}`,
      "aria-label": `${c.name}, revealed number ${c.order}, ${c.ayahs} ayahs, ${c.place}`,
    });
    a.style.height = Math.max(6, (Math.sqrt(c.ayahs) / max) * 100) + "%";
    if (onHover) {
      a.addEventListener("mousemove", e => tip(e,
        `<b>${c.n}. ${c.name}</b> <span style="font-family:var(--font-uthmani)">${c.ar}</span><br>` +
        `Revealed #${c.order} of 114 · ${c.place === "makkah" ? "Makki" : "Madani"}<br>${c.ayahs} ayahs`));
      a.addEventListener("mouseleave", () => tip(null));
    }
    wrap.append(a);
  }
  return wrap;
}
