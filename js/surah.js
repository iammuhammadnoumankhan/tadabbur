import * as C from "./common.js";
const { h, $, $$, ICON, t, sanitize, toArabicDigits } = C;

C.header("surah");
C.footer();

const params = new URLSearchParams(location.search);
const N = Math.min(114, Math.max(1, parseInt(params.get("n") || "1", 10) || 1));

// U4: ask for everything the first screen needs at once (requests are cached, so later calls reuse them)
{
  const sc = C.get().script;
  C.info(N).catch(() => null);
  C.selectedTranslations().then(list => list.forEach(tr => C.tr(tr.id, N).catch(() => null))).catch(() => null);
  if (sc === "indopak") { C.indopak(N).catch(() => null); C.indopak(1).catch(() => null); }
  if (sc === "tajweed") { C.tajweed(N).catch(() => null); C.tajweed(1).catch(() => null); }
  if (N !== 1) C.surah(1).catch(() => null);
}
const [chs, data, hIndex, src, trMeta, seerah, seerahBySurah, stories, storiesBySurah, SIM, RECITERS] = await Promise.all([
  C.chapters(), C.surah(N), C.hadithIndex(), C.sources(), C.translations(),
  C.seerah().catch(() => null), C.seerahBySurah(), C.stories().catch(() => null), C.storiesBySurah(),
  C.similarIndex().then(ix => ix[N] ? C.similar(N) : {}), C.reciters().catch(() => null),
]);
const surahProphets = (storiesBySurah[N] || []).map(id => stories.prophets.find(p => p.id === id)).filter(Boolean);
const seerahEvents = (seerahBySurah[N] || []).map(id => seerah.events.find(e => e.id === id)).filter(Boolean);
const ch = chs.find(c => c.n === N);
let morphP = null;                                    // word grammar: loaded after the reader is drawn (U4)
const morphNow = () => (morphP ||= C.morph(N).catch(() => null));
const hCounts = hIndex[N] || {};
document.title = t("surah.pageTitle", { name: ch.name, n: ch.n });

// ======================================================= gateway
async function renderGate() {
  const inf = await C.info(N).catch(() => null);
  const gate = $("#gate");
  gate.innerHTML = "";
  const hadithTotal = Object.keys(hCounts).length;
  const mk = ch.place === "makkah";
  // U2: a compact header so reading starts on the first screen; everything else is one tap away
  // under "About this surah" (docs/UX_RESEARCH.md §2, §3.3). The reader's choice is remembered.
  const head = h("div", { class: "gate-head" },
    h("div", { class: "gh-names" },
      h("div", { class: "gh-ar", translate: "no", lang: "ar" }, ch.ar),
      h("div", {},
        h("div", { class: "num" }, t("surah.ofTotal", { n: ch.n })),
        h("h1", {}, ch.nameC),
        h("div", { class: "mean" }, `"${ch.meaning.en}" · `, h("span", { class: "urdu", lang: "ur" }, ch.meaning.ur)))),
    h("div", { class: "gh-facts" },
      h("span", { class: `chip ${ch.place}`, title: t(mk ? "surah.revealedInMakkah" : "surah.revealedInMadinah") }, h("span", { class: "dot" }), C.placeName(ch.place)),
      h("span", { class: "chip" }, t("surah.revealedOrder", { n: ch.order })),
      h("span", { class: "chip" }, t("common.ayahs", { n: ch.ayahs }), ` · ${t("surah.pagesShort", { from: ch.pages[0], to: ch.pages[1] })}`),
      hadithTotal ? h("span", { class: "chip hadith-chip" }, t("surah.hadithAyahs", { n: hadithTotal })) : null));
  const details = h("div", { class: "gate-details", id: "surah-about" });
  const open = !!C.get().surahAbout;
  const toggle = h("button", { class: "btn about-btn", type: "button", "aria-expanded": String(open), "aria-controls": "surah-about",
    onclick: () => {
      const now = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(now));
      details.hidden = !now;
      C.set({ surahAbout: now });
    } }, t("surah.about"), h("span", { class: "about-chev", html: ICON.chevron }));
  details.hidden = !open;
  const left = h("div", { class: "gate-title" },
    h("p", { class: "muted", style: "margin:0 0 6px" }, t(mk ? "surah.revealedInMakkah" : "surah.revealedInMadinah"), " · ",
      t("surah.revealedOrderLong", { n: ch.order })),
    h("div", { class: "mini-journey" },
      C.journeyBars(chs, { current: N }),
      h("div", { class: "journey-axis" }, h("span", {}, t("common.firstRevealed")), h("span", {}, t("common.lastRevealed")))),
    h("div", { class: "source", style: "margin-top:8px" }, src["qc-chapters"].publisher, " — ", src["qc-chapters"].note),
    hadithTotal ? h("div", { style: "margin-top:14px" },
      h("span", { class: "chip hadith-chip" }, t("surah.bukhariCited", { n: hadithTotal }))) : null,
    seerahEvents.length ? h("div", { class: "seerah-links" },
      h("span", { class: "tiny" }, t("surah.seerahLinks")),
      ...seerahEvents.map(e => h("a", { class: "chip", href: `timeline.html#${e.id}` },
        `${e.name.en}${e.year != null ? t("common.yr", { n: e.year }) : ""} →`))) : null,
    surahProphets.length ? h("div", { class: "seerah-links" },
      h("span", { class: "tiny" }, t("surah.prophetLinks")),
      ...surahProphets.map(p => h("a", { class: "chip", href: `stories.html?p=${p.id}` },
        p.en, h("span", { style: "font-family:var(--font-uthmani);margin-left:4px", translate: "no" }, p.ar)))) : null,
  );

  const right = h("div", { class: "intro" });
  if (inf) {
    let lang = C.get().uiMeaning === "en" ? "en" : "ur";
    const body = h("div", { class: "intro-body" });
    const source = h("div", { class: "source" });
    const seg = h("div", { class: "seg" },
      ...["ur", "en"].map(l => h("button", { "data-v": l, onclick: () => { lang = l; fill(); } }, t(`lang.${l}`))));
    const more = h("button", { class: "btn", onclick: () => {
      body.classList.toggle("open");
      more.textContent = t(body.classList.contains("open") ? "surah.introLess" : "surah.introMore");
    } }, t("surah.introMore"));
    function fill() {
      const d = inf[lang];
      body.innerHTML = sanitize(d?.html || "");
      body.className = "intro-body" + (lang === "ur" ? " urdu" : "");
      body.dir = lang === "ur" ? "rtl" : "ltr";
      source.textContent = "";
      source.append(d?.source || "", t("surah.viaQuranCom"));
      $$("button", seg).forEach(b => b.classList.toggle("on", b.dataset.v === lang));
    }
    right.append(h("h3", {}, t("surah.introTitle"), seg), body, h("div", { class: "intro-actions" }, more, source,
      C.reportLink({ kind: "intro", reference: `${t("common.surahNum", { n: ch.n })} ${ch.name}`, source: "Quran.com chapter info" })));
    fill();
  }
  details.append(h("div", { class: "gate-card" }, left, right));
  gate.append(h("div", { class: "card gate-wrap" }, head, h("div", { class: "gh-row" }, toggle), details));
}

// ======================================================= reader
let trList = [];        // selected translation meta
const trTexts = {};     // id -> array
let hadithData = null;
let ip = null;          // IndoPak text for this surah (when that script is chosen)
let tj = null;          // tajweed-coloured text (when "Tajweed" is chosen): word HTML from Quran.com

const isIP = () => C.get().script === "indopak" && ip;
const isTJ = () => C.get().script === "tajweed" && tj;
const plain = html => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent; };
const pageUrl = key => `${location.origin}${location.pathname}?n=${N}#${key}`;
const ayahSources = () => t("report.ayahSource", {
  script: isIP() ? "DigitalKhatt IndoPak" : isTJ() ? "Quran.com tajweed (Uthmani)" : "Quran.com Uthmani",
  translations: trList.map(tr => tr.name).join(", "),
});
const ayahText = idx => isIP() ? ip.ayahs[idx].join(" ") : isTJ() ? tj.ayahs[idx].map(plain).join(" ") : data.ayahs[idx].u;
const wordText = (idx, i) => isIP() ? ip.ayahs[idx][i] : isTJ() ? plain(tj.ayahs[idx][i]) : data.ayahs[idx].w[i].u;
/** The Arabic for one word as an element: tajweed words keep their colour markup (sanitised at build time). */
const wordArabic = (idx, i, cls = "") => isTJ()
  ? h("span", { class: `ar-uthmani tajweed ${cls}`.trim(), lang: "ar", html: tj.ayahs[idx][i] })
  : h("span", { class: `ar-${C.get().script} ${cls}`.trim(), lang: "ar" }, wordText(idx, i));

// Tajweed colour key: rule names (English + Arabic term) as used by Quran.com's tajweed text.
const TAJWEED_KEY = [
  ["ham_wasl", "silent"], ["laam_shamsiyah", "silent"], ["slnt", "silent"],
  ["madda_normal"], ["madda_permissible"], ["madda_obligatory_mottasel"], ["madda_obligatory_monfasel"], ["madda_necessary"],
  ["ghunnah"], ["qalaqah"], ["ikhafa"], ["ikhafa_shafawi"], ["iqlab"],
  ["idgham_ghunnah"], ["idgham_wo_ghunnah"], ["idgham_shafawi"], ["idgham_mutajanisayn"], ["idgham_mutaqaribayn"],
];
function renderTajweedKey() {
  const box = $("#tajweed-key");
  box.innerHTML = "";
  box.classList.toggle("hidden", !tj);
  if (!tj) return;
  box.append(h("details", { open: true },
    h("summary", {}, t("tajweed.keyTitle")),
    h("div", { class: "tj-key" }, ...TAJWEED_KEY.map(([r]) => h("span", { class: "tj-key-item" },
      h("span", { class: `tj tj-${r} tj-swatch`, "aria-hidden": "true" }),
      h("span", {}, t(`tajweed.${r}`), " ", h("span", { class: "tj-ar", lang: "ar" }, t(`tajweed.ar.${r}`)))))),
    h("div", { class: "source", style: "margin-top:8px" }, t("tajweed.source"))));
}

async function loadTranslations() {
  trList = await C.selectedTranslations();
  await Promise.all(trList.map(async tr => { trTexts[tr.id] = await C.tr(tr.id, N); }));
  $("#tr-count").textContent = trList.length;
}

// Extra word data (transliteration, audio path) lives in words/NNN.json and is loaded only when needed (U4b)
let extra = null;
const extraNow = () => C.words(N).then(x => (extra = x)).catch(() => null);
const wordMeaning = w => (C.get().wbwLang === "en" ? w.en : w.ur) || w.en || "";

function wordEl(w, a, i, idx) {
  const st = C.get();
  const el = h("span", { class: "w", "data-k": a.k, "data-i": i, tabindex: "0", role: "button", "aria-label": t("surah.wordAria", { word: w.u, meaning: wordMeaning(w) }) },
    wordArabic(idx, i));
  const tl = extra?.ayahs[idx]?.w[i]?.tl;
  if (st.wbw) {
    if (st.showTranslit && tl) el.append(h("span", { class: "g", style: "font-style:italic;color:var(--ink-3)" }, tl));
    if (st.wbwLang === "ur" || st.wbwLang === "both") el.append(h("span", { class: "g ur", lang: "ur" }, w.ur || ""));
    if (st.wbwLang === "en" || st.wbwLang === "both") el.append(h("span", { class: "g" }, w.en || ""));
  }
  return el;
}

function ayahEl(a, idx) {
  const hc = hCounts[a.k] || 0;
  const head = h("div", { class: "ayah-head" },
    h("span", { class: "ayah-key" }, a.k),
    a.sajdah ? h("span", { class: "chip" }, t("surah.sajdah")) : null,
    h("span", { class: "tiny" }, t("surah.juzPage", { juz: a.juz, page: a.page })),
    h("span", { class: "sp" }),
    hc ? h("button", { class: "chip hadith-chip", onclick: () => openHadith(a.k), title: t("surah.hadithBadgeTitle") }, t("surah.hadithBadge", { n: hc })) : null,
    SIM[a.k] ? h("button", { class: "chip sim-chip", onclick: () => openSimilar(a.k), title: t("surah.similarTitleAttr") }, t("surah.similarBadge", { n: SIM[a.k].length })) : null,
    h("button", { class: "chip tafsir-chip", onclick: () => openTafsir(a.k), title: t("surah.tafsirTitle") }, t("surah.tafsir")),
    // U3: only the most used actions stay visible; the rest are in one labelled menu (docs/UX_RESEARCH.md §3.3)
    P.isBookmarked(a.k) ? bookmarkBtn(a.k) : null,
    h("button", { class: "icon-btn", title: t("surah.playAyah"), "aria-label": t("surah.playAyahAria", { key: a.k }), html: ICON.play, onclick: () => player.playFrom(idx, true) }),
    h("button", { class: "icon-btn more-btn", title: t("surah.ayahMore"), "aria-label": t("surah.ayahMoreAria", { key: a.k }), "aria-haspopup": "dialog",
      html: ICON.more, onclick: () => openAyahMenu(a, idx) }));

  const line = h("div", { class: "arabic-line", lang: "ar" },
    a.w.map((w, i) => wordEl(w, a, i, idx)),
    isIP()
      ? h("span", { class: "end-mark ar-indopak" }, `۝${toArabicDigits(a.n)}`)
      : h("span", { class: "end-mark ar-uthmani" }, `﴿${toArabicDigits(a.n)}﴾`));

  const trs = h("div", { class: "trs" }, trList.map(tr => {
    const ur = tr.lang === "ur";
    return h("div", { class: `tr-item ${ur ? "ur" : ""}`, lang: tr.lang === "ur-Latn" ? "ur" : tr.lang },
      h("div", { class: `txt ${ur ? "urdu" : ""}`, dir: ur ? "rtl" : "ltr" }, trTexts[tr.id]?.[idx] ?? ""),
      h("div", { class: "who" }, `— ${tr.name}`));
  }));
  const myNote = P.note(a.k);
  return h("article", { class: "ayah", id: a.k, "data-idx": idx }, head, line, trs,
    myNote ? h("div", { class: "my-note" }, h("span", { class: "tiny" }, t("progress.yourNote")), h("div", { dir: "auto" }, myNote)) : null);
}

async function renderReader() {
  const st = C.get();
  ip = st.script === "indopak" ? await C.indopak(N) : null;
  if (st.showTranslit && !extra) await extraNow();
  tj = st.script === "tajweed" ? await C.tajweed(N).catch(() => null) : null;
  renderTajweedKey();
  const r = $("#reader");
  r.innerHTML = "";
  if (ch.bismillah) {
    if (tj) {
      const b = await C.tajweed(1);
      r.append(h("div", { class: "bismillah ar-uthmani tajweed", lang: "ar", html: b.ayahs[0].join(" ") }));
    } else {
      const text = ip ? (await C.indopak(1)).ayahs[0].join(" ") : (await C.surah(1)).ayahs[0].u;
      r.append(h("div", { class: `bismillah ar-${st.script}`, lang: "ar" }, text));
    }
  }
  // U4: draw only a window of ayahs: from the start, or around a linked ayah. More are added as the
  // reader scrolls near either end, so long surahs open fast on budget phones.
  io?.disconnect();
  const target = hashIndex();
  first = last = target >= 0 ? Math.max(0, target - 3) : 0;
  sentinelTop.hidden = sentinelEnd.hidden = false;
  r.append(sentinelTop, sentinelEnd);
  renderUpTo(Math.max(first + 2 * CHUNK, target + 8));
  syncToolbar();
  if (target >= 0) pinTo(document.getElementById(data.ayahs[target].k));
  if (more) { more.observe(sentinelEnd); if (first > 0) more.observe(sentinelTop); else sentinelTop.hidden = true; }
}

const CHUNK = 12;                        // small sections keep each drawing step short on slow phones
let first = 0, last = 0;                 // ayahs first..last-1 are drawn
const sentinelTop = h("div", { class: "reader-more", "aria-hidden": "true" });
const sentinelEnd = h("div", { class: "reader-more", "aria-hidden": "true" });
const more = "IntersectionObserver" in window
  ? new IntersectionObserver(es => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      if (e.target === sentinelEnd) renderUpTo(last + CHUNK);
      else renderFrom(first - CHUNK);
    }
  }, { rootMargin: "800px 0px" })
  : null;
const hashIndex = () => location.hash ? data.ayahs.findIndex(a => a.k === decodeURIComponent(location.hash.slice(1))) : -1;
function drawRange(from, to) {
  const frag = document.createDocumentFragment();
  for (let i = from; i < to; i++) {
    const el = ayahEl(data.ayahs[i], i);
    frag.append(el);
    io?.observe(el);
  }
  return frag;
}
/** Draw ayahs up to (not including) n at the end of the window. */
function renderUpTo(n) {
  n = Math.min(more ? n : data.ayahs.length, data.ayahs.length);
  if (n <= last) return;
  sentinelEnd.before(drawRange(last, n));
  last = n;
  more?.unobserve(sentinelEnd);
  if (last >= data.ayahs.length) sentinelEnd.hidden = true;
  else more?.observe(sentinelEnd);        // re-observing reports again if the end is still near, so drawing continues
}
/** Draw ayahs from i up to the current start of the window, keeping the reader's place on screen. */
function renderFrom(i) {
  i = Math.max(0, i);
  if (i >= first) return;
  const anchor = document.getElementById(data.ayahs[first].k);
  const before = anchor?.getBoundingClientRect().top;
  sentinelTop.after(drawRange(i, first));
  first = i;
  if (anchor) scrollBy(0, anchor.getBoundingClientRect().top - before);   // keep the reader's place (#reader has no browser anchoring)
  more?.unobserve(sentinelTop);
  if (first === 0) sentinelTop.hidden = true;
  else more?.observe(sentinelTop);
}
/** Make sure ayah i is drawn (call before looking one up by id). */
function ensureAyah(i) {
  if (i < first) renderFrom(i - 3);
  if (i >= last) renderUpTo(i + CHUNK);
}
addEventListener("hashchange", () => {
  const i = hashIndex();
  if (i < 0) return;
  ensureAyah(i);
  pinTo(document.getElementById(data.ayahs[i].k));
});
// Scroll to an ayah and keep it there for a moment while the ayahs around it finish drawing at their
// real height (they start with an estimate) and fonts arrive. Stops as soon as the reader scrolls.
function pinTo(el) {
  if (!el) return;
  el.scrollIntoView({ block: "start" });
  const want = el.getBoundingClientRect().top;
  let stop = false;
  const quit = () => { stop = true; };
  const evs = ["wheel", "touchstart", "keydown", "pointerdown"];
  evs.forEach(e => addEventListener(e, quit, { once: true, passive: true }));
  // hold for at least 2.5 s, and until the Quran fonts have arrived (a first visit on a slow connection
  // gets them after the text is drawn, and the words rewrap), but never more than 8 s
  const start = performance.now();
  let fontsIn = document.fonts?.status === "loaded";
  document.fonts?.ready.then(() => { fontsIn = true; });
  const tick = () => {
    const t = performance.now() - start;
    if (stop || t > 8000 || (t > 2500 && fontsIn)) { evs.forEach(e => removeEventListener(e, quit)); return; }
    if (Math.abs(el.getBoundingClientRect().top - want) > 4) el.scrollIntoView({ block: "start" });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function copyAyah(a, idx) {
  const lines = [ayahText(idx), ...trList.map(tr => `${trTexts[tr.id][idx]} — ${tr.name}`), t("surah.copyFooter", { key: a.k })];
  const ok = await C.copyText(lines.join("\n\n"));
  C.toast(t(ok ? "surah.copied" : "surah.copyFailed", { key: a.k }));
}

// ======================================================= word popover
const pop = $("#pop");
const wordAudio = new Audio();
document.addEventListener("click", e => {
  const w = e.target.closest(".w");
  if (w) { showPop(w); return; }
  if (!e.target.closest("#pop")) hidePop();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { hidePop(); closeDrawer(); }
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("w")) { e.preventDefault(); showPop(e.target); }
});
function showPop(el) {
  $$(".w.on").forEach(x => x.classList.remove("on"));
  el.classList.add("on");
  const idx = data.ayahs.findIndex(x => x.k === el.dataset.k);
  const a = data.ayahs[idx];
  const w = a.w[+el.dataset.i];
  const st = C.get();
  pop.innerHTML = "";
  const wi = +el.dataset.i;
  const tlBox = h("div", { class: "w-tl" }, extra?.ayahs[idx]?.w[wi]?.tl || "");
  if (!extra) extraNow().then(x => { if (x && popEl === el) tlBox.textContent = x.ayahs[idx]?.w[wi]?.tl || ""; });
  pop.append(
    h("div", { class: "w-ar" }, wordArabic(idx, +el.dataset.i)),
    tlBox,
    h("dl", {},
      h("dt", {}, t("lang.ur")), h("dd", { class: "urdu", lang: "ur" }, w.ur || "—"),
      h("dt", {}, t("lang.en")), h("dd", {}, w.en || "—")),
    grammarBox(idx, +el.dataset.i),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: async () => {
        const x = extra || await extraNow();
        const path = x?.ayahs[idx]?.w[wi]?.a;
        if (!path) return C.toast(t("surah.wordAudioMissing"));
        wordAudio.src = C.audioUrl.word(path); wordAudio.play();
      } },
        h("span", { html: ICON.speaker }), t("surah.wordListen")),
      h("span", { class: "tiny" }, t("surah.wordRef", { key: a.k, n: +el.dataset.i + 1 }))),
    h("div", { class: "row", style: "margin-top:10px" },
      h("div", { class: "source" }, t("surah.wordSource")),
      C.reportLink({ kind: "word", reference: t("report.wordRef", { key: a.k, n: +el.dataset.i + 1, word: wordText(idx, +el.dataset.i) }),
        source: t("report.wordSource"), page: pageUrl(a.k) })));
  pop.classList.add("show");
  popEl = el;
  placePop();
}
let popEl = null;
function placePop() {
  if (!popEl || !pop.classList.contains("show")) return;
  const r = popEl.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.left + r.width / 2 - pw / 2;
  x = Math.max(8, Math.min(x, innerWidth - pw - 8));
  let y = r.bottom + 8;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
  pop.style.left = x + "px"; pop.style.top = y + "px";
}
// root / dictionary form / type for one word (fills in when the grammar data arrives)
function grammarBox(idx, wi) {
  const box = h("dl", { class: "grammar" }, h("dt", {}, t("morph.root")), h("dd", { class: "tiny" }, t("morph.loading")));
  morphNow().then(async m => {
    const e = m?.ayahs?.[idx]?.[wi];
    box.innerHTML = "";
    if (!e) { box.remove(); return; }
    const [root, lemma, pos, feats] = e;
    const info = root ? await C.rootByLetters(root) : null;
    box.append(
      h("dt", {}, t("morph.root")),
      root
        ? h("dd", {}, h("span", { class: "root-letters", lang: "ar" }, C.spacedRoot(root)), " ",
            info ? h("a", { href: `root.html?r=${info.id}`, class: "tiny" }, t("morph.rootCount", { n: info.n })) : null)
        : h("dd", { class: "tiny" }, t("morph.noRoot")),
      lemma ? h("dt", {}, t("morph.lemma")) : null,
      lemma ? h("dd", { class: "lemma", lang: "ar" }, lemma) : null,
      h("dt", {}, t("morph.pos")), h("dd", {}, C.morphLabel(pos, feats)),
      h("dt", {}), h("dd", {}, h("a", { class: "tiny", href: "https://corpus.quran.com", target: "_blank", rel: "noopener" }, t("morph.source"))));
    placePop();
  });
  return box;
}

function hidePop() { pop.classList.remove("show"); $$(".w.on").forEach(x => x.classList.remove("on")); }
addEventListener("scroll", hidePop, { passive: true });

// ======================================================= drawers
const drawer = $("#drawer"), scrim = $("#scrim");
$("#drawer-close").innerHTML = ICON.close;
$("#drawer-close").onclick = closeDrawer;
scrim.onclick = closeDrawer;
function openDrawer(title, body) {
  $("#drawer-title").textContent = title;
  const b = $("#drawer-body"); b.innerHTML = ""; b.append(body); b.scrollTop = 0;
  drawer.classList.add("show"); scrim.classList.add("show"); drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() { drawer.classList.remove("show"); scrim.classList.remove("show"); drawer.setAttribute("aria-hidden", "true"); }

// --- translations picker
$("#open-tr").onclick = () => {
  const chosen = trList.map(tr => tr.id);
  const groups = [["ur", t("lang.urduLabel")], ["ur-Latn", t("lang.romanUrdu")], ["en", t("lang.en")]];
  const body = h("div", {},
    h("p", { class: "muted", style: "margin-top:0" }, t("surah.trPickerHint")),
    ...groups.map(([lang, label]) => h("div", { class: "opt-group" }, h("h4", {}, label),
      ...trMeta.list.filter(tr => tr.lang === lang).map(tr => {
        const i = chosen.indexOf(tr.id);
        return h("label", { class: "check" },
          h("input", { type: "checkbox", checked: i >= 0, onchange: e => {
            const cur = (C.get().translations?.length ? C.get().translations : trMeta.default).filter(x => x !== tr.id);
            if (e.target.checked) cur.push(tr.id);
            C.set({ translations: cur });
            $("#open-tr").click();
          } }),
          h("span", {}, tr.name, h("div", { class: "tiny" }, t("surah.trVia"))),
          i >= 0 ? h("span", { class: "ord" }, `#${i + 1}`) : null);
      }))),
    h("div", { class: "note" }, t("surah.trNote"), h("a", { href: "sources.html" }, t("nav.sources"))));
  openDrawer(t("surah.translations"), body);
};

// --- settings
$("#open-settings").innerHTML = `${ICON.gear}<span class="btn-label">${t("surah.settings")}</span>`;
$("#open-settings").onclick = () => {
  const st = C.get();
  const seg = (key, opts) => h("div", { class: "seg" }, ...opts.map(([v, l]) =>
    h("button", { class: st[key] === v ? "on" : null, onclick: () => { C.set({ [key]: v }); $("#open-settings").click(); } }, l)));
  const body = h("div", {},
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setScript")),
      seg("script", [["indopak", t("surah.setScriptIndopak")], ["uthmani", t("surah.setScriptUthmani")], ["tajweed", t("surah.setScriptTajweed")]]),
      h("div", { class: "tiny", style: "margin-top:6px" }, t("surah.setScriptNote"))),
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setSize")),
      h("div", { class: "range-row" }, h("span", { class: "tiny" }, "A"),
        h("input", { type: "range", min: 22, max: 56, value: st.arSize, "aria-label": t("surah.setSize"), oninput: e => C.set({ arSize: +e.target.value }) }),
        h("span", {}, "A"))),
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setWbw")),
      seg("wbwLang", [["ur", t("lang.ur")], ["en", t("lang.en")], ["both", t("surah.both")]]),
      h("label", { class: "check", style: "margin-top:8px" },
        h("input", { type: "checkbox", checked: st.wbw, onchange: e => C.set({ wbw: e.target.checked }) }), t("surah.setShowWbw")),
      h("label", { class: "check" },
        h("input", { type: "checkbox", checked: st.showTranslit, onchange: e => C.set({ showTranslit: e.target.checked }) }), t("surah.setTranslit"))),
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setMeaningLang")), seg("uiMeaning", [["ur", t("lang.ur")], ["en", t("lang.en")]])),
    RECITERS ? h("div", { class: "opt-group" }, h("h4", {}, t("surah.setReciter")),
      h("select", { class: "tafsir-select", "aria-label": t("surah.setReciter"), onchange: e => C.set({ reciter: +e.target.value }) },
        ...RECITERS.list.map(r => h("option", { value: r.id, selected: r.id === (st.reciter || RECITERS.default) }, `${r.name} — ${r.style}`))),
      h("label", { class: "check", style: "margin-top:8px" },
        h("input", { type: "checkbox", checked: st.followWords, onchange: e => C.set({ followWords: e.target.checked }) }), t("surah.setFollow")),
      h("div", { class: "tiny", style: "margin-top:4px" }, t("surah.setReciterNote"))) : null,
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setTheme")),
      seg("theme", [["auto", t("surah.themeAuto")], ["light", t("surah.themeLight")], ["dark", t("surah.themeDark")]])),
    h("div", { class: "opt-group" }, h("h4", {}, t("pwa.offlineTitle")), C.offlinePanel()));
  openDrawer(t("surah.settingsTitle"), body);
};

// --- tafsir panel (fetched live from Quran.com, shown as published)
let tafsirListener = null;
async function openTafsir(key) {
  const T = await C.tafsirs();
  const pick = () => C.get().tafsir || T.default[C.get().uiMeaning === "en" ? "en" : "ur"];
  const body = h("div");
  openDrawer(t("surah.tafsirOf", { key }), body);

  async function fill() {
    const meta = T.list.find(x => x.id === pick()) || T.list[0];
    const ur = meta.lang === "ur";
    const select = h("select", { class: "tafsir-select", "aria-label": t("surah.tafsirChoose"), onchange: e => C.set({ tafsir: +e.target.value }) },
      ...[["ur", t("lang.urduLabel")], ["en", t("lang.en")]].map(([lang, label]) =>
        h("optgroup", { label }, ...T.list.filter(x => x.lang === lang).map(x =>
          h("option", { value: x.id, selected: x.id === meta.id }, x.name)))));
    const nav = dir => {
      const i = data.ayahs.findIndex(x => x.k === key) + dir;
      if (i >= 0 && i < data.ayahs.length) { key = data.ayahs[i].k; $("#drawer-title").textContent = t("surah.tafsirOf", { key }); fill(); }
    };
    body.innerHTML = "";
    body.append(
      h("div", { class: "tafsir-bar" }, select,
        h("button", { class: "btn", onclick: () => nav(-1), "aria-label": t("surah.prevAyah") }, "←"),
        h("button", { class: "btn", onclick: () => nav(1), "aria-label": t("surah.nextAyah") }, "→")),
      h("div", { class: "skeleton" }, t("surah.tafsirLoading")));
    $("#drawer-body").scrollTop = 0;
    try {
      const res = await C.tafsirFor(meta.id, key);
      const tf = res.tafsir || {};
      const covers = Object.keys(tf.verses || {});
      const html = sanitize(tf.text || "");
      body.lastChild.replaceWith(h("div", {},
        covers.length > 1 ? h("div", { class: "note", style: "margin:12px 0" },
          t("surah.tafsirCovers", { from: covers[0], to: covers[covers.length - 1].split(":")[1] })) : null,
        html.trim()
          ? h("div", { class: `tafsir-body${ur ? " urdu" : ""}`, dir: ur ? "rtl" : "ltr", lang: meta.lang, html })
          : h("div", { class: "note", style: "margin-top:12px" }, t("surah.tafsirNone")),
        h("div", { class: "row-between", style: "margin-top:16px" },
          h("div", { class: "source" }, t("surah.tafsirSource", { name: meta.name, author: meta.author || "" })),
          C.reportLink({ kind: "tafsir", reference: key, source: `${meta.name} (Quran.com tafsir ${meta.id})`, page: pageUrl(key) }))));
    } catch {
      body.lastChild.replaceWith(h("div", { class: "note", style: "margin-top:12px" }, t("surah.tafsirError")));
    }
  }
  tafsirListener = fill;
  fill();
}
C.onChange((_, patch) => { if ("tafsir" in patch && drawer.classList.contains("show") && tafsirListener) tafsirListener(); });

// --- similar wording panel: ayahs sharing 5+ identical consecutive words (computed from the text itself)
async function openSimilar(key) {
  const list = SIM[key] || [];
  const idx = data.ayahs.findIndex(a => a.k === key);
  const tr0 = trList[0];
  const mine = new Set(list.flatMap(([, runs]) => runs.flatMap(([i, n]) => Array.from({ length: n }, (_, d) => i + d))));
  const arabic = (words, marks) => h("div", { class: `p-arabic ar-${isTJ() ? "uthmani" : C.get().script}`, lang: "ar", dir: "rtl", translate: "no" },
    ...words.flatMap((w, i) => [i ? " " : "", h("span", { class: `pw${marks.has(i) ? " name" : ""}` }, w)]));
  const plainWords = (sd, ipd, i) => sd.ayahs[i].w.map((w, j) => ipd ? ipd.ayahs[i][j] : w.u);
  const body = h("div");
  body.append(
    h("div", { class: "note" }, t("surah.similarNote")),
    h("div", { class: "p-ayah" }, h("div", { class: "p-ayah-h" }, h("span", { class: "ayah-key" }, key)),
      arabic(data.ayahs[idx].w.map((w, j) => isIP() ? ip.ayahs[idx][j] : w.u), mine)),
    h("h4", { class: "pc-h" }, t("surah.similarCount", { n: t("common.ayahs", { n: list.length }) })));
  const box = body.appendChild(h("div", {}, h("div", { class: "skeleton" }, t("common.loading"))));
  openDrawer(t("surah.similarTitle", { key }), body);

  const surahs = [...new Set(list.map(([k]) => +k.split(":")[0]))];
  const loaded = Object.fromEntries(await Promise.all(surahs.map(async s => [s, await Promise.all([
    s === N ? data : C.surah(s), isIP() ? C.indopak(s).catch(() => null) : null, tr0 ? C.tr(tr0.id, s).catch(() => null) : null])])));
  box.innerHTML = "";
  for (const [k, runs] of list) {
    const [s, a] = k.split(":").map(Number);
    const [sd, ipd, trd] = loaded[s];
    const marks = new Set(runs.flatMap(([, n, j]) => Array.from({ length: n }, (_, d) => j + d)));
    const c = chs.find(x => x.n === s);
    box.append(h("div", { class: "p-ayah" },
      h("div", { class: "p-ayah-h" },
        h("span", {}, h("span", { class: "ayah-key" }, k), " ", h("span", { class: "tiny" }, `${c.name} · `, t("surah.similarWords", { n: Math.max(...runs.map(r => r[1])) }))),
        h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, t("common.readInContext"))),
      arabic(plainWords(sd, ipd, a - 1), marks),
      trd ? h("div", { class: `tr-item ${tr0.lang === "ur" ? "ur" : ""}` },
        h("div", { class: `txt ${tr0.lang === "ur" ? "urdu" : ""}`, dir: tr0.lang === "ur" ? "rtl" : "ltr" }, trd[a - 1]),
        h("div", { class: "who" }, `— ${tr0.name}`)) : null));
  }
  box.append(h("div", { class: "source", style: "margin-top:14px" }, src["tadabbur-similar"]?.publisher || ""));
}

// --- hadith panel
// Sahih Muslim is referred to by book + in-book number (as on sunnah.com), Bukhari by its standard number
const hadithLabel = x => x.c === "muslim"
  ? t("surah.hadithRefMuslim", { collection: t("collection.muslim"), book: x.book, inBook: x.inBook })
  : t("surah.hadithRef", { collection: t("collection.bukhari"), num: x.num });

async function openHadith(key) {
  hadithData ||= await C.hadith(N);
  const list = hadithData.filter(x => x.refs.includes(key));
  let lang = C.get().uiMeaning === "en" ? "en" : "ur";
  const body = h("div");
  function fill() {
    body.innerHTML = "";
    body.append(
      h("div", { class: "seg", style: "margin-bottom:12px" }, ...["ur", "en", "ar"].map(v =>
        h("button", { class: v === lang ? "on" : null, onclick: () => { lang = v; fill(); } }, t(`lang.${v}`)))),
      h("div", { class: "note" }, t("surah.hadithNote", { key })),
      ...list.map(x => h("div", { class: "hadith" },
        h("div", { class: "h-ref" },
          h("span", {}, h("b", {}, hadithLabel(x)),
            x.c === "bukhari" ? h("span", { class: "tiny" }, t("surah.hadithBook", { book: x.book, bookName: x.bookName || "", inBook: x.inBook }))
              : h("span", { class: "tiny" }, ` · ${x.bookName || ""}`)),
          h("a", { href: x.url, target: "_blank", rel: "noopener" }, t("common.verifySunnah"))),
        h("div", { class: "h-how" }, (x.quoted || []).includes(key) ? t("surah.hadithQuotes") : t("surah.hadithCites")),
        h("div", { class: `h-txt ${lang === "ur" ? "urdu" : lang === "ar" ? "ar" : ""}`, dir: lang === "en" ? "ltr" : "rtl", lang },
          (lang === "ur" ? x.ur : lang === "ar" ? x.ar : x.en) || t("common.notInLanguage")),
        h("div", { class: "row-between", style: "margin-top:6px" },
          h("div", { class: "tiny" }, t("surah.alsoCites"), x.refs.filter(r => r !== key).slice(0, 12).join(", ") || "—"),
          C.reportLink({ kind: "hadith", reference: `${hadithLabel(x)}, linked to ${key}`,
            source: t("report.hadithSource"), page: pageUrl(key) })))),
      h("div", { class: "source", style: "margin-top:14px" }, src["sahih-hadith-text"].publisher));
  }
  fill();
  openDrawer(t("surah.hadithTitle", { key }), body);
}

// ======================================================= audio player
// Full-surah recitation with ayah + word timings (data/audio/<reciter>/NNN.json), so each word
// lights up as it's recited. Falls back to per-ayah audio if timings can't be loaded.
const audio = $("#audio");
const player = {
  playing: false, single: false, idx: -1, word: null, T: null, reciterId: null, raf: 0,
  async timings() {
    const rec = await C.selectedReciter();
    if (this.T && this.reciterId === rec.id) return this.T;
    this.reciterId = rec.id;
    this.T = await C.audioTimings(rec.id, N).catch(() => null);
    return this.T;
  },
  async playFrom(i, single = false) {
    this.single = single;
    const T = await this.timings();
    if (T) {
      if (audio.src !== T.url) audio.src = T.url;
      audio.currentTime = T.ayahs[i][0] / 1000;
    } else {
      audio.src = C.audioUrl.ayah(data.ayahs[i].id);           // fallback: one file per ayah
    }
    this.idx = -1;
    this.setAyah(i);
    await audio.play().catch(() => {});
    this.playing = true; syncPlay(); this.loop();
  },
  toggle() {
    if (this.playing) { audio.pause(); this.playing = false; syncPlay(); return; }
    if (this.idx < 0 || audio.ended) return this.playFrom(0, false);
    this.single = false;
    audio.play().catch(() => {}); this.playing = true; syncPlay(); this.loop();
  },
  setAyah(i) {
    if (i === this.idx) return;
    if (this.idx >= 0 && this.playing) P.markRead([OFFSET + this.idx]);
    this.idx = i;
    ensureAyah(i);
    $$(".ayah.playing").forEach(x => x.classList.remove("playing"));
    const el = document.getElementById(data.ayahs[i].k);
    el?.classList.add("playing");
    if (el && !inView(el)) el.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  setWord(i, w) {
    const key = i == null || w == null ? null : `${i}:${w}`;
    if (key === this.word) return;
    $$(".w.speak").forEach(x => x.classList.remove("speak"));
    this.word = key;
    if (key && C.get().followWords) document.querySelector(`.w[data-k="${data.ayahs[i].k}"][data-i="${w - 1}"]`)?.classList.add("speak");
  },
  loop() {
    cancelAnimationFrame(this.raf);
    const startIdx = this.idx;
    const tick = () => {
      if (!this.playing) return;
      const T = this.T;
      if (T) {
        const ms = audio.currentTime * 1000;
        let i = this.idx < 0 ? 0 : this.idx;                       // ayahs are in time order
        while (i < T.ayahs.length - 1 && ms >= T.ayahs[i + 1][0]) i++;
        while (i > 0 && ms < T.ayahs[i][0]) i--;
        if (this.single && i !== startIdx) { audio.pause(); this.playing = false; this.setWord(); syncPlay(); return; }
        this.setAyah(i);
        const seg = T.ayahs[i][2].find(([, a, b]) => ms >= a && ms < b);
        this.setWord(i, seg ? seg[0] : null);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },
};
const inView = el => { const r = el.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 40; };
audio.addEventListener("ended", () => {
  if (!player.T && !player.single && player.idx < data.ayahs.length - 1) return player.playFrom(player.idx + 1, false);
  player.playing = false; player.setWord(); syncPlay();
});
function syncPlay() {
  $("#play-all").innerHTML = player.playing ? `${ICON.pause}<span>${t("surah.pause")}</span>` : `${ICON.play}<span>${t("surah.listen")}</span>`;
}
$("#play-all").onclick = () => player.toggle();
syncPlay();
C.onChange((_, patch) => {
  if (!("reciter" in patch)) return;
  const was = player.playing;
  audio.pause(); player.playing = false; player.T = null; syncPlay();
  if (was) player.playFrom(Math.max(0, player.idx), false);
});

// ======================================================= toolbar sync
function syncToolbar() {
  const st = C.get();
  $$("#script-seg button").forEach(b => b.classList.toggle("on", b.dataset.v === st.script));
  const w = st.wbw ? st.wbwLang : "off";
  $$("#wbw-seg button").forEach(b => b.classList.toggle("on", b.dataset.v === w));
}
$$("#script-seg button").forEach(b => b.onclick = () => C.set({ script: b.dataset.v }));
$$("#wbw-seg button").forEach(b => b.onclick = () =>
  b.dataset.v === "off" ? C.set({ wbw: false }) : C.set({ wbw: true, wbwLang: b.dataset.v }));

C.onChange(async (_, patch) => {
  if ("arSize" in patch || "theme" in patch || "tafsir" in patch || "known" in patch || "reciter" in patch || "followWords" in patch) return;
  if ("translations" in patch) await loadTranslations();
  if ("uiMeaning" in patch) await renderGate();
  const keep = player.idx;
  await renderReader();
  if (keep >= 0) document.getElementById(data.ayahs[keep].k)?.classList.add("playing");
  player.word = null;
});

// ======================================================= mushaf page view link (opens at the ayah in view)
$("#open-mushaf").addEventListener("click", e => {
  const inView = [...document.querySelectorAll(".ayah")].find(el => el.getBoundingClientRect().bottom > 140);
  const key = inView ? inView.id : `${N}:1`;
  e.currentTarget.href = `page.html?k=${key}&m=${C.get().script === "indopak" ? "indopak" : "madani"}`;
});

// ======================================================= share an ayah as an image (drawn in the browser)
async function openShare(a, idx) {
  const script = isIP() ? "indopak" : "uthmani";            // tajweed mode shares plain Uthmani text
  const arabic = `${ayahText(idx)} ${isIP() ? "۝" : "﴿"}${toArabicDigits(a.n)}${isIP() ? "" : "﴾"}`;
  const opts = {
    format: "square",
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    picked: new Set(trList.slice(0, 2).map(tr => tr.id)),
  };
  const canvas = h("canvas", { class: "share-preview", role: "img", "aria-label": t("share.previewAria", { key: a.k }) });
  const body = h("div");
  openDrawer(t("share.drawerTitle", { key: a.k }), body);
  const Card = await import("./sharecard.js");          // loaded only when someone shares (U4)
  await Card.loadFonts(script);

  const card = () => {
    const translations = trList.filter(tr => opts.picked.has(tr.id))
      .map(tr => ({ text: trTexts[tr.id][idx], lang: tr.lang === "ur" ? "ur" : "en", name: tr.name }));
    const credit = t("share.credit", {
      arabic: script === "indopak" ? "DigitalKhatt IndoPak" : "Quran.com",
      translations: translations.map(x => x.name).join(", ") || "—",
    });
    return Card.drawCard(canvas, { arabic, script, translations, ref: `${ch.name} · ${a.k}`,
      surahAr: `${t("page.surahWord")} ${ch.ar}`, theme: opts.theme, format: opts.format, credit, brand: t("share.brand") });
  };
  const fileName = `tadabbur-${a.k.replace(":", "-")}.png`;
  const seg = (key, choices) => h("div", { class: "seg" }, ...choices.map(([v, l]) =>
    h("button", { class: opts[key] === v ? "on" : null, onclick: e => {
      opts[key] = v; [...e.currentTarget.parentNode.children].forEach(b => b.classList.toggle("on", b === e.currentTarget)); card();
    } }, l)));

  body.append(
    canvas,
    h("div", { class: "opt-group", style: "margin-top:12px" }, h("h4", {}, t("share.size")),
      seg("format", [["square", t("share.square")], ["story", t("share.story")]])),
    h("div", { class: "opt-group" }, h("h4", {}, t("share.look")),
      seg("theme", [["light", t("surah.themeLight")], ["dark", t("surah.themeDark")]])),
    trList.length ? h("div", { class: "opt-group" }, h("h4", {}, t("surah.translations")),
      ...trList.map(tr => h("label", { class: "check" },
        h("input", { type: "checkbox", checked: opts.picked.has(tr.id), onchange: e => {
          e.target.checked ? opts.picked.add(tr.id) : opts.picked.delete(tr.id); card();
        } }), tr.name))) : null,
    h("div", { class: "share-actions" },
      h("button", { class: "btn primary", onclick: async () => {
        const file = new File([await Card.toBlob(canvas)], fileName, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: `${ch.name} ${a.k}` }); } catch { /* cancelled */ }
        } else { download(file); C.toast(t("share.downloaded")); }
      } }, h("span", { html: ICON.share }), t("share.share")),
      h("button", { class: "btn", onclick: async () => download(new File([await Card.toBlob(canvas)], fileName, { type: "image/png" })) }, t("share.download")),
      h("button", { class: "btn", onclick: async () => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": Card.toBlob(canvas) })]);
          C.toast(t("share.copied"));
        } catch { C.toast(t("share.copyFailed")); }
      } }, t("share.copy"))),
    h("p", { class: "tiny", style: "margin-top:10px" }, t("share.note")));
  card();
}
function download(file) {
  const url = URL.createObjectURL(file);
  const link = h("a", { href: url, download: file.name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ======================================================= reading progress (stored on this device)
const P = C.progress;
const OFFSET = chs.slice(0, N - 1).reduce((s, c) => s + c.ayahs, 0);   // global index of this surah's first ayah
// The per-ayah "More" menu: copy, share, bookmark, note, report (U3)
function openAyahMenu(a, idx) {
  const marked = P.isBookmarked(a.k);
  const hasNote = !!P.note(a.k);
  const redraw = () => {
    const el = document.getElementById(a.k);
    if (el) el.replaceWith(ayahEl(a, idx));
    observeAyahs();
  };
  C.actionSheet({
    title: t("surah.ayahMenuTitle", { key: a.k }),
    items: [
      { label: t("surah.copyAyah"), icon: ICON.copy, onClick: () => copyAyah(a, idx) },
      { label: t("share.title"), icon: ICON.share, onClick: () => openShare(a, idx) },
      { label: t(marked ? "progress.unbookmark" : "progress.bookmark"), icon: marked ? ICON.bookmarkOn : ICON.bookmark,
        onClick: () => { const now = P.toggleBookmark(a.k); redraw(); C.toast(t(now ? "progress.bookmarked" : "progress.unbookmarked", { key: a.k })); } },
      { label: t(hasNote ? "progress.noteEdit" : "progress.noteTitle"), icon: ICON.note, onClick: () => openNote(a.k) },
      { label: t("report.label"), hint: t("report.hintShort"), icon: ICON.flag, external: true,
        href: C.reportUrl({ kind: "translation", reference: a.k, page: pageUrl(a.k), source: ayahSources() }) },
    ],
    note: t("surah.juzPage", { juz: a.juz, page: a.page }),
  });
}

function bookmarkBtn(key) {
  const on = P.isBookmarked(key);
  return h("button", { class: `icon-btn bm-btn${on ? " on" : ""}`, title: t(on ? "progress.unbookmark" : "progress.bookmark"),
    "aria-label": t(on ? "progress.unbookmark" : "progress.bookmark"), "aria-pressed": on ? "true" : "false", html: on ? ICON.bookmarkOn : ICON.bookmark,
    onclick: e => {
      const now = P.toggleBookmark(key);
      const el = document.getElementById(key);
      const i = data.ayahs.findIndex(x => x.k === key);
      if (el && i >= 0) { el.replaceWith(ayahEl(data.ayahs[i], i)); observeAyahs(); }
      C.toast(t(now ? "progress.bookmarked" : "progress.unbookmarked", { key }));
    } });
}
function openNote(key) {
  const ta = h("textarea", { class: "note-input", rows: 6, dir: "auto", placeholder: t("progress.notePlaceholder") });
  ta.value = P.note(key);
  const saveIt = () => {
    P.setNote(key, ta.value);
    closeDrawer();
    const el = document.getElementById(key);
    const idx = data.ayahs.findIndex(x => x.k === key);
    if (el && idx >= 0) el.replaceWith(ayahEl(data.ayahs[idx], idx));
    observeAyahs();
  };
  openDrawer(t("progress.noteFor", { key }), h("div", {},
    h("p", { class: "muted", style: "margin-top:0" }, t("progress.notePrivate")), ta,
    h("div", { class: "row-between", style: "margin-top:10px" },
      h("button", { class: "btn", onclick: () => { ta.value = ""; saveIt(); } }, t("progress.noteDelete")),
      h("button", { class: "btn primary", onclick: saveIt }, t("progress.noteSave")))));
  setTimeout(() => ta.focus(), 50);
}

// an ayah counts as read after 1.5 s on screen; the topmost visible ayah is "last read"
const seenTimers = new Map();
const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    const idx = +e.target.dataset.idx;
    if (e.isIntersecting) {
      if (!seenTimers.has(idx)) seenTimers.set(idx, setTimeout(() => { P.markRead([OFFSET + idx]); seenTimers.delete(idx); }, 1500));
    } else if (seenTimers.has(idx)) {
      clearTimeout(seenTimers.get(idx)); seenTimers.delete(idx);
    }
  }
}, { threshold: 0.6 }) : null;
function observeAyahs() {
  if (!io) return;
  io.disconnect();
  document.querySelectorAll(".ayah").forEach(el => io.observe(el));
}
let lastTimer;
addEventListener("scroll", () => {
  clearTimeout(lastTimer);
  lastTimer = setTimeout(() => {
    const top = [...document.querySelectorAll(".ayah")].find(el => el.getBoundingClientRect().bottom > 140);
    if (top) P.setLast(top.id, "reader");
  }, 800);
}, { passive: true });

// ======================================================= pager
function pager() {
  const p = $("#pager");
  const prev = chs.find(c => c.n === N - 1), next = chs.find(c => c.n === N + 1);
  p.append(
    prev ? h("a", { class: "btn", href: `surah.html?n=${prev.n}` }, `← ${prev.n}. ${prev.name}`) : h("span"),
    next ? h("a", { class: "btn", href: `surah.html?n=${next.n}` }, `${next.n}. ${next.name} →`) : h("span"));
}

await Promise.all([renderGate(), loadTranslations()]);
await renderReader();
// word grammar: fetched when the phone is idle (or when a word is tapped), so it never delays a tap (U4)
// …and the same for the extra word data (transliteration, word audio)
if ("requestIdleCallback" in window) requestIdleCallback(() => { morphNow(); extraNow(); }, { timeout: 8000 });
else setTimeout(() => { morphNow(); extraNow(); }, 4000);
pager();
P.setLast(location.hash ? decodeURIComponent(location.hash.slice(1)) : `${N}:1`, "reader");
