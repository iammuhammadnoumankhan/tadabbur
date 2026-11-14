// Tadabbur web UI layer: browser-only helpers on top of the DOM-free core.
// Logic and data live in js/core/; interface text lives in js/i18n/.

import * as core from "./core/index.js";
import { t, setLanguage, language, direction } from "./i18n/index.js";

// ---------- re-exports so pages import one module
export * from "./core/index.js";
export { t };
export const { get, set, onChange } = core.settings;
export const WORD_AUDIO = "https://audio.qurancdn.com/";      // kept for older call sites
export const AYAH_AUDIO = core.audioUrl.ayah;

// ---------- language + theme (applied to <html>)
function applyLanguage() {
  setLanguage(get().uiLang);
  document.documentElement.lang = language();
  document.documentElement.dir = direction();
}
export function applyTheme() {
  const s = get();
  const theme = s.theme === "auto"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : s.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--ar-size", s.arSize + "px");
}
applyLanguage();
applyTheme();
onChange((_, patch) => {
  if ("uiLang" in patch) applyLanguage();
  applyTheme();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

/** Fill static HTML: data-i18n (text), data-i18n-html, data-i18n-placeholder, data-i18n-title, data-i18n-aria-label. */
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  for (const attr of ["placeholder", "title", "aria-label"]) {
    const k = "i18n" + attr.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => el.setAttribute(attr, t(el.dataset[k])));
  }
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
export const placeName = place => t(place === "makkah" ? "common.makki" : "common.madani");

// ---------- sanitise third-party HTML (surah intros, tafsir)
const ALLOWED = new Set(["H1", "H2", "H3", "H4", "P", "DIV", "SPAN", "BR", "B", "I", "STRONG", "EM", "UL", "OL", "LI", "SUP", "SUB", "BLOCKQUOTE"]);
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = node => {
    for (const el of [...node.children]) {
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) if (a.name !== "class") el.removeAttribute(a.name);
      walk(el);
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return root.innerHTML;
}

export const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="7" cy="18" r="2" fill="var(--surface)"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
};

// ---------- page frame
export function header(active = "") {
  applyI18n();
  const theme = document.documentElement.dataset.theme;
  const el = h("header", { class: "top" },
    h("div", { class: "wrap" },
      h("a", { class: "brand", href: "index.html" },
        h("span", { class: "mark" }, "ت"),
        h("span", { class: "t" }, t("app.name")),
        h("span", { class: "ar" }, t("app.nameAr"))),
      h("nav", { class: "nav" },
        h("a", { href: "index.html#surahs", class: active === "surahs" ? "on" : null }, t("nav.surahs")),
        h("a", { href: "search.html", class: "nav-search", title: t("nav.search"), "aria-label": t("nav.search"), html: ICON.search }),
        h("a", { href: "stories.html" }, t("nav.prophets")),
        h("a", { href: "timeline.html" }, h("span", { class: "label" }, t("nav.seerahPrefix")), t("nav.timeline")),
        h("a", { href: "sources.html" }, t("nav.sources")),
        h("button", {
          class: "icon-btn", title: t("nav.theme"), "aria-label": t("nav.theme"),
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
    t("footer.text"), h("a", { href: "sources.html" }, t("footer.link")))));
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
export const surahTip = c =>
  `<b>${c.n}. ${c.name}</b> <span style="font-family:var(--font-uthmani)">${c.ar}</span><br>` +
  `${t("common.revealedOf", { n: c.order })} · ${placeName(c.place)}<br>${t("common.ayahs", { n: c.ayahs })}`;

// ---------- revelation journey bars (home + surah page)
export function journeyBars(chs, { current = null, onHover = true } = {}) {
  const byOrder = [...chs].sort((a, b) => a.order - b.order);
  const max = Math.sqrt(Math.max(...chs.map(c => c.ayahs)));
  const wrap = h("div", { class: "journey-bars", role: "list" });
  for (const c of byOrder) {
    const a = h("a", {
      href: `surah.html?n=${c.n}`, role: "listitem",
      class: `${c.place}${c.n === current ? " cur" : ""}`,
      "aria-label": t("aria.surahBar", { name: c.name, order: c.order, ayahs: c.ayahs, place: placeName(c.place) }),
    });
    a.style.height = Math.max(6, (Math.sqrt(c.ayahs) / max) * 100) + "%";
    if (onHover) {
      a.addEventListener("mousemove", e => tip(e, surahTip(c)));
      a.addEventListener("mouseleave", () => tip(null));
    }
    wrap.append(a);
  }
  return wrap;
}
