import * as C from "./common.js";
const { h, $, $$, ICON, t, sanitize, toArabicDigits } = C;

C.header();
C.footer();

const params = new URLSearchParams(location.search);
const N = Math.min(114, Math.max(1, parseInt(params.get("n") || "1", 10) || 1));

const [chs, data, hIndex, src, trMeta, seerah, seerahBySurah, stories, storiesBySurah] = await Promise.all([
  C.chapters(), C.surah(N), C.hadithIndex(), C.sources(), C.translations(),
  C.seerah().catch(() => null), C.seerahBySurah(), C.stories().catch(() => null), C.storiesBySurah(),
]);
const surahProphets = (storiesBySurah[N] || []).map(id => stories.prophets.find(p => p.id === id)).filter(Boolean);
const seerahEvents = (seerahBySurah[N] || []).map(id => seerah.events.find(e => e.id === id)).filter(Boolean);
const ch = chs.find(c => c.n === N);
const hCounts = hIndex[N] || {};
document.title = t("surah.pageTitle", { name: ch.name, n: ch.n });

// ======================================================= gateway
async function renderGate() {
  const inf = await C.info(N).catch(() => null);
  const gate = $("#gate");
  gate.innerHTML = "";
  const hadithTotal = Object.keys(hCounts).length;
  const mk = ch.place === "makkah";
  const left = h("div", { class: "gate-title" },
    h("div", { class: "num" }, t("surah.ofTotal", { n: ch.n })),
    h("div", { class: "ar", translate: "no" }, ch.ar),
    h("h1", {}, ch.nameC),
    h("div", { class: "mean" }, `"${ch.meaning.en}" · `, h("span", { class: "urdu" }, ch.meaning.ur)),
    h("div", { class: "stats" },
      h("div", { class: `stat ${ch.place}` }, h("div", { class: "v" }, C.placeName(ch.place)),
        h("div", { class: "l" }, t(mk ? "surah.revealedInMakkah" : "surah.revealedInMadinah"))),
      h("div", { class: "stat" }, h("div", { class: "v" }, `#${ch.order}`), h("div", { class: "l" }, t("surah.inRevelationOrder"))),
      h("div", { class: "stat" }, h("div", { class: "v" }, ch.ayahs), h("div", { class: "l" }, t("surah.ayahsPages", { from: ch.pages[0], to: ch.pages[1] })))),
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
    right.append(h("h3", {}, t("surah.introTitle"), seg), body, h("div", { class: "intro-actions" }, more, source));
    fill();
  }
  gate.append(h("div", { class: "card gate-card" }, left, right));
}

// ======================================================= reader
let trList = [];        // selected translation meta
const trTexts = {};     // id -> array
let hadithData = null;
let ip = null;          // IndoPak text for this surah (when that script is chosen)

const isIP = () => C.get().script === "indopak" && ip;
const ayahText = idx => isIP() ? ip.ayahs[idx].join(" ") : data.ayahs[idx].u;
const wordText = (idx, i) => isIP() ? ip.ayahs[idx][i] : data.ayahs[idx].w[i].u;

async function loadTranslations() {
  trList = await C.selectedTranslations();
  await Promise.all(trList.map(async tr => { trTexts[tr.id] = await C.tr(tr.id, N); }));
  $("#tr-count").textContent = trList.length;
}

function wordEl(w, a, i, idx) {
  const st = C.get();
  const el = h("span", { class: "w", "data-k": a.k, "data-i": i, tabindex: "0", role: "button", "aria-label": t("surah.wordAria", { tl: w.tl, en: w.en }) },
    h("span", { class: `ar-${st.script}`, lang: "ar" }, wordText(idx, i)));
  if (st.wbw) {
    if (st.showTranslit && w.tl) el.append(h("span", { class: "g", style: "font-style:italic;color:var(--ink-3)" }, w.tl));
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
    h("button", { class: "chip tafsir-chip", onclick: () => openTafsir(a.k), title: t("surah.tafsirTitle") }, t("surah.tafsir")),
    h("button", { class: "icon-btn", title: t("surah.playAyah"), "aria-label": t("surah.playAyahAria", { key: a.k }), html: ICON.play, onclick: () => player.playFrom(idx, true) }),
    h("button", { class: "icon-btn", title: t("surah.copyAyah"), "aria-label": t("surah.copy"), html: ICON.copy, onclick: () => copyAyah(a, idx) }));

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
  return h("article", { class: "ayah", id: a.k, "data-idx": idx }, head, line, trs);
}

async function renderReader() {
  const st = C.get();
  ip = st.script === "indopak" ? await C.indopak(N) : null;
  const r = $("#reader");
  r.innerHTML = "";
  if (ch.bismillah) {
    const text = ip ? (await C.indopak(1)).ayahs[0].join(" ") : (await C.surah(1)).ayahs[0].u;
    r.append(h("div", { class: `bismillah ar-${st.script}`, lang: "ar" }, text));
  }
  const frag = document.createDocumentFragment();
  data.ayahs.forEach((a, i) => frag.append(ayahEl(a, i)));
  r.append(frag);
  syncToolbar();
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" });
}

function copyAyah(a, idx) {
  const lines = [ayahText(idx), ...trList.map(tr => `${trTexts[tr.id][idx]} — ${tr.name}`), t("surah.copyFooter", { key: a.k })];
  navigator.clipboard?.writeText(lines.join("\n\n"));
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
  pop.append(
    h("div", { class: `w-ar ar-${st.script}`, lang: "ar" }, wordText(idx, +el.dataset.i)),
    h("div", { class: "w-tl" }, w.tl || ""),
    h("dl", {},
      h("dt", {}, t("lang.ur")), h("dd", { class: "urdu", lang: "ur" }, w.ur || "—"),
      h("dt", {}, t("lang.en")), h("dd", {}, w.en || "—")),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => { wordAudio.src = C.audioUrl.word(w.a); wordAudio.play(); } },
        h("span", { html: ICON.speaker }), t("surah.wordListen")),
      h("span", { class: "tiny" }, t("surah.wordRef", { key: a.k, n: +el.dataset.i + 1 }))),
    h("div", { class: "source", style: "margin-top:10px" }, t("surah.wordSource")));
  pop.classList.add("show");
  const r = el.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.left + r.width / 2 - pw / 2;
  x = Math.max(8, Math.min(x, innerWidth - pw - 8));
  let y = r.bottom + 8;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
  pop.style.left = x + "px"; pop.style.top = y + "px";
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
$("#open-settings").innerHTML = `${ICON.gear}<span>${t("surah.settings")}</span>`;
$("#open-settings").onclick = () => {
  const st = C.get();
  const seg = (key, opts) => h("div", { class: "seg" }, ...opts.map(([v, l]) =>
    h("button", { class: st[key] === v ? "on" : null, onclick: () => { C.set({ [key]: v }); $("#open-settings").click(); } }, l)));
  const body = h("div", {},
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setScript")),
      seg("script", [["indopak", t("surah.setScriptIndopak")], ["uthmani", t("surah.setScriptUthmani")]]),
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
    h("div", { class: "opt-group" }, h("h4", {}, t("surah.setTheme")),
      seg("theme", [["auto", t("surah.themeAuto")], ["light", t("surah.themeLight")], ["dark", t("surah.themeDark")]])));
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
        h("div", { class: "source", style: "margin-top:16px" }, t("surah.tafsirSource", { name: meta.name, author: meta.author || "" }))));
    } catch {
      body.lastChild.replaceWith(h("div", { class: "note", style: "margin-top:12px" }, t("surah.tafsirError")));
    }
  }
  tafsirListener = fill;
  fill();
}
C.onChange((_, patch) => { if ("tafsir" in patch && drawer.classList.contains("show") && tafsirListener) tafsirListener(); });

// --- hadith panel
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
          h("span", {}, h("b", {}, t("surah.hadithRef", { collection: t(`collection.${x.c}`), num: x.num })),
            h("span", { class: "tiny" }, t("surah.hadithBook", { book: x.book, bookName: x.bookName || "", inBook: x.inBook }))),
          h("a", { href: x.url, target: "_blank", rel: "noopener" }, t("common.verifySunnah"))),
        h("div", { class: `h-txt ${lang === "ur" ? "urdu" : lang === "ar" ? "ar" : ""}`, dir: lang === "en" ? "ltr" : "rtl", lang },
          (lang === "ur" ? x.ur : lang === "ar" ? x.ar : x.en) || t("common.notInLanguage")),
        h("div", { class: "tiny", style: "margin-top:6px" }, t("surah.alsoCites"), x.refs.filter(r => r !== key).slice(0, 12).join(", ") || "—"))),
      h("div", { class: "source", style: "margin-top:14px" }, src["sahih-hadith-text"].publisher));
  }
  fill();
  openDrawer(t("surah.hadithTitle", { key }), body);
}

// ======================================================= audio player
const audio = $("#audio");
const player = {
  idx: -1, playing: false, continuous: true,
  playFrom(i, single = false) {
    this.continuous = !single || this.playing;
    this.idx = i; this.load(); audio.play(); this.playing = true; syncPlay();
  },
  load() {
    const a = data.ayahs[this.idx];
    audio.src = C.audioUrl.ayah(a.id);
    $$(".ayah.playing").forEach(x => x.classList.remove("playing"));
    const el = document.getElementById(a.k);
    el?.classList.add("playing");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  toggle() {
    if (this.playing) { audio.pause(); this.playing = false; }
    else { if (this.idx < 0) { this.idx = 0; this.load(); } this.continuous = true; audio.play(); this.playing = true; }
    syncPlay();
  },
};
audio.addEventListener("ended", () => {
  if (player.continuous && player.idx < data.ayahs.length - 1) { player.idx++; player.load(); audio.play(); }
  else { player.playing = false; syncPlay(); }
});
function syncPlay() {
  $("#play-all").innerHTML = player.playing ? `${ICON.pause}<span>${t("surah.pause")}</span>` : `${ICON.play}<span>${t("surah.listen")}</span>`;
}
$("#play-all").onclick = () => player.toggle();
syncPlay();

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
  if ("arSize" in patch || "theme" in patch || "tafsir" in patch) return;
  if ("translations" in patch) await loadTranslations();
  if ("uiMeaning" in patch) await renderGate();
  const keep = player.idx;
  await renderReader();
  if (keep >= 0) document.getElementById(data.ayahs[keep].k)?.classList.add("playing");
});

// ======================================================= pager
function pager() {
  const p = $("#pager");
  const prev = chs.find(c => c.n === N - 1), next = chs.find(c => c.n === N + 1);
  p.append(
    prev ? h("a", { class: "btn", href: `surah.html?n=${prev.n}` }, `← ${prev.n}. ${prev.name}`) : h("span"),
    next ? h("a", { class: "btn", href: `surah.html?n=${next.n}` }, `${next.n}. ${next.name} →`) : h("span"));
}

await renderGate();
await loadTranslations();
await renderReader();
pager();
