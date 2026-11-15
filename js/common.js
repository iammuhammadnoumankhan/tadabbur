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
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
};

// ---------- word grammar (Quranic Arabic Corpus)
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** "Verb · form X · command" from a morph entry's pos + features. */
export function morphLabel(pos, features = "") {
  const parts = [t(`pos.${pos}`)].filter(x => !x.startsWith("⟦"));
  const f = features ? features.split("|") : [];
  const form = f.find(x => /^VF:\d+$/.test(x) || /^\([IVX]+\)$/.test(x));
  if (form) {
    const n = form.startsWith("VF:") ? ROMAN[+form.slice(3)] : form.slice(1, -1);
    if (n && n !== "I") parts.push(t("feat.form", { n }));
  }
  for (const k of ["PERF", "IMPF", "IMPV"]) if (f.includes(k)) parts.push(t(`feat.${k}`));
  if (f.includes("PCPL")) parts.push(t(f.includes("PASS") ? "feat.PASS|PCPL" : "feat.ACT|PCPL"));
  else if (f.includes("PASS")) parts.push(t("feat.PASS"));
  if (f.includes("VN")) parts.push(t("feat.VN"));
  return parts.join(" · ");
}
/** Root letters with spaces, e.g. "ص ب ر". */
export const spacedRoot = r => [...r].join(" ");

// ---------- "Report a problem" (opens a pre-filled GitHub issue form; see js/core/report.js)
export function reportLink(opts, { label = true, cls = "" } = {}) {
  const href = core.reportUrl({ page: location.href, ...opts });
  return h("a", {
    class: `report-link ${cls}`.trim(), href, target: "_blank", rel: "noopener",
    title: t("report.title"), "aria-label": t("report.title"),
  }, h("span", { html: ICON.flag }), label ? t("report.label") : null);
}

// ---------- page frame
function installBtn() {
  const b = h("button", { class: "btn install-btn hidden", title: t("pwa.installTitle"), onclick: () => promptInstall() }, t("pwa.install"));
  onInstallAvailable(on => b.classList.toggle("hidden", !on));
  return b;
}
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
        h("a", { href: "root.html" }, t("nav.roots")),
        h("a", { href: "learn.html" }, t("nav.learn")),
        h("a", { href: "timeline.html" }, h("span", { class: "label" }, t("nav.seerahPrefix")), t("nav.timeline")),
        h("a", { href: "sources.html" }, t("nav.sources")),
        installBtn(),
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
    t("footer.text"), h("a", { href: "sources.html" }, t("footer.link")), " ",
    h("span", { class: "foot-report" }, t("report.footerAsk"), reportLink({ kind: "other" })))));
}

// ---------- installable app + offline (service worker: sw.js)
// Not registered on localhost (so development always shows fresh files), unless ?sw=1.
const SW_ON = "serviceWorker" in navigator &&
  (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || new URLSearchParams(location.search).has("sw"));
export const offlineSupported = () => SW_ON;
let installPrompt = null;
const installListeners = new Set();
export const onInstallAvailable = fn => { installListeners.add(fn); if (installPrompt) fn(true); };
export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  installListeners.forEach(fn => fn(false));
  return outcome === "accepted";
}

if (SW_ON) {
  const wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (wasControlled) toast(t("pwa.updated"), { action: t("pwa.reload"), onAction: () => location.reload(), ms: 15000 });
  });
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; installListeners.forEach(fn => fn(true)); });
}
addEventListener("offline", () => toast(t("pwa.offline")));
addEventListener("online", () => toast(t("pwa.online")));
// A page whose data isn't saved fails to load while offline: say so instead of "Loading…" forever.
function offlineFailure() {
  if (navigator.onLine) return;
  toast(t("pwa.offlineMissing"), { ms: 8000 });
  document.querySelectorAll("main .skeleton").forEach(el => {
    el.classList.add("offline-msg");
    el.textContent = t("pwa.offlineMissing");
  });
}
addEventListener("unhandledrejection", offlineFailure);
addEventListener("error", offlineFailure);

/** URLs needed to read every surah offline with the reader's current choices. */
export async function offlineUrls() {
  const [chs, trs, hIndex, se] = await Promise.all([core.chapters(), core.selectedTranslations(), core.hadithIndex(), core.seerah()]);
  const urls = [];
  for (const c of chs) {
    const n = core.pad3(c.n);
    urls.push(`data/surah/${n}.json`, `data/indopak/${n}.json`, `data/info/${n}.json`, `data/morph/${n}.json`,
      ...trs.map(tr => `data/tr/${tr.id}/${n}.json`));
    if (hIndex[c.n]) urls.push(`data/hadith/${n}.json`);
    if (core.settings.get().script === "tajweed") urls.push(`data/tajweed/${n}.json`);
  }
  const mushaf = core.settings.get().script === "indopak" ? "indopak" : "madani";
  const ix = await core.layoutIndex(mushaf).catch(() => null);
  if (ix) for (let p = 1; p <= ix.pages; p++) urls.push(`data/layout/${mushaf}/${core.pad3(p)}.json`);
  urls.push(`data/layout/${mushaf}/index.json`, "data/search/ar.json", "data/roots/index.json", "data/vocab.json", ...trs.map(tr => `data/search/tr-${tr.id}.json`),
    ...se.events.map(e => `data/seerah/${e.id}.json`));
  return urls;
}
function askWorker(msg, onMessage) {
  return navigator.serviceWorker.ready.then(reg => new Promise(resolve => {
    const handler = e => { if (onMessage(e.data)) { navigator.serviceWorker.removeEventListener("message", handler); resolve(e.data); } };
    navigator.serviceWorker.addEventListener("message", handler);
    reg.active.postMessage(msg);
  }));
}
/** How many of the offline files are already saved: { saved, total }. */
export async function offlineStatus() {
  if (!SW_ON) return null;
  const urls = await offlineUrls();
  return askWorker({ type: "status", urls }, d => d.type === "status");
}
/** Save everything for offline reading; onProgress({ done, failed, total }). */
export async function saveOffline(onProgress) {
  const urls = await offlineUrls();
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  return askWorker({ type: "save", urls }, d => {
    if (d.type !== "save-progress") return false;
    onProgress?.(d);
    return d.done >= d.total;
  });
}

/** A small offline panel: status, "Save for offline" button, progress. Used on home + reader settings. */
export function offlinePanel() {
  const box = h("div", { class: "offline-panel" });
  if (!SW_ON) { box.append(h("div", { class: "tiny" }, t("pwa.notSupported"))); return box; }
  const status = h("div", { class: "tiny" }, t("pwa.checking"));
  const bar = h("div", { class: "progress" }, h("span"));
  const btn = h("button", { class: "btn" }, t("pwa.save"));
  btn.onclick = async () => {
    btn.disabled = true;
    bar.classList.add("show");
    const res = await saveOffline(p => {
      bar.firstChild.style.width = `${Math.round(p.done / p.total * 100)}%`;
      status.textContent = t("pwa.saving", { done: p.done, total: p.total });
    });
    btn.disabled = false;
    status.textContent = res.failed ? t("pwa.savedSome", { failed: res.failed }) : t("pwa.saved");
    refresh();
  };
  async function refresh() {
    const s = await offlineStatus().catch(() => null);
    if (!s) return;
    let size = "";
    try { const est = await navigator.storage.estimate(); size = t("pwa.size", { mb: Math.round(est.usage / 1048576) }); } catch { /* ignore */ }
    status.textContent = (s.saved >= s.total ? t("pwa.allSaved") : t("pwa.status", { saved: s.saved, total: s.total })) + size;
    btn.textContent = s.saved >= s.total ? t("pwa.update") : t("pwa.save");
  }
  refresh();
  box.append(h("p", { class: "muted", style: "margin:0 0 8px" }, t("pwa.explain")), h("div", { class: "offline-row" }, btn, status), bar);
  return box;
}

// ---------- clipboard + toast
/** Copy text; falls back to a hidden textarea when the Clipboard API is blocked. Returns true on success. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h("textarea", { readonly: true, style: "position:fixed;opacity:0;top:0;left:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
let toastEl, toastTimer;
export function toast(msg, { action, onAction, ms = 2200 } = {}) {
  if (!toastEl) { toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" }); document.body.append(toastEl); }
  toastEl.innerHTML = "";
  toastEl.append(msg);
  if (action) toastEl.append(h("button", { class: "toast-btn", onclick: () => { toastEl.classList.remove("show"); onAction?.(); } }, action));
  toastEl.classList.toggle("has-action", !!action);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
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
