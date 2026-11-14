import * as C from "./common.js";
const { h, $, $$, ICON } = C;

C.header();
C.footer();

const params = new URLSearchParams(location.search);
const N = Math.min(114, Math.max(1, parseInt(params.get("n") || "1", 10) || 1));

const [chs, data, hIndex, src, trMeta, seerah, seerahBySurah] = await Promise.all([
  C.chapters(), C.surah(N), C.hadithIndex(), C.sources(), C.translations(),
  C.getJSON("data/seerah.json").catch(() => null), C.getJSON("data/seerah-by-surah.json").catch(() => ({})),
]);
const [stories, storiesBySurah] = await Promise.all([
  C.getJSON("data/stories.json").catch(() => null), C.getJSON("data/stories-by-surah.json").catch(() => ({})),
]);
const surahProphets = (storiesBySurah[N] || []).map(id => stories.prophets.find(p => p.id === id)).filter(Boolean);
const seerahEvents = (seerahBySurah[N] || []).map(id => seerah.events.find(e => e.id === id)).filter(Boolean);
const ch = chs.find(c => c.n === N);
const hCounts = hIndex[N] || {};
document.title = `${ch.name} (${ch.n}) · Tadabbur`;

// ======================================================= sanitize 3rd-party HTML
const ALLOWED = new Set(["H1", "H2", "H3", "H4", "P", "DIV", "SPAN", "BR", "B", "I", "STRONG", "EM", "UL", "OL", "LI", "SUP", "SUB", "BLOCKQUOTE"]);
function sanitize(html) {
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

// ======================================================= gateway
async function renderGate() {
  const inf = await C.info(N).catch(() => null);
  const gate = $("#gate");
  gate.innerHTML = "";
  const hadithTotal = Object.keys(hCounts).length;
  const left = h("div", { class: "gate-title" },
    h("div", { class: "num" }, `Surah ${ch.n} of 114`),
    h("div", { class: "ar", translate: "no" }, ch.ar),
    h("h1", {}, ch.nameC),
    h("div", { class: "mean" }, `"${ch.meaning.en}" · `, h("span", { class: "urdu" }, ch.meaning.ur)),
    h("div", { class: "stats" },
      h("div", { class: `stat ${ch.place}` }, h("div", { class: "v" }, ch.place === "makkah" ? "Makki" : "Madani"), h("div", { class: "l" }, ch.place === "makkah" ? "Revealed in Makkah period" : "Revealed in Madinah period")),
      h("div", { class: "stat" }, h("div", { class: "v" }, `#${ch.order}`), h("div", { class: "l" }, "in order of revelation")),
      h("div", { class: "stat" }, h("div", { class: "v" }, ch.ayahs), h("div", { class: "l" }, `ayahs · pages ${ch.pages[0]}–${ch.pages[1]}`))),
    h("div", { class: "mini-journey" },
      C.journeyBars(chs, { current: N }),
      h("div", { class: "journey-axis" }, h("span", {}, "First revealed"), h("span", {}, "Last revealed"))),
    h("div", { class: "source", style: "margin-top:8px" }, src["qc-chapters"].publisher, " — ", src["qc-chapters"].note),
    hadithTotal ? h("div", { style: "margin-top:14px" },
      h("span", { class: "chip hadith-chip" }, `${hadithTotal} ayah${hadithTotal > 1 ? "s" : ""} of this surah ${hadithTotal > 1 ? "are" : "is"} cited in Sahih al-Bukhari. Look for the gold badge.`)) : null,
    seerahEvents.length ? h("div", { class: "seerah-links" },
      h("span", { class: "tiny" }, "Seerah events whose hadith cite this surah:"),
      ...seerahEvents.map(e => h("a", { class: "chip", href: `timeline.html#${e.id}` },
        `${e.name.en}${e.year != null ? ` · yr ${e.year}` : ""} →`))) : null,
    surahProphets.length ? h("div", { class: "seerah-links" },
      h("span", { class: "tiny" }, "Prophets referred to in this surah:"),
      ...surahProphets.map(p => h("a", { class: "chip", href: `stories.html?p=${p.id}` },
        p.en, h("span", { style: "font-family:var(--font-uthmani);margin-left:4px", translate: "no" }, p.ar)))) : null,
  );

  const right = h("div", { class: "intro" });
  if (inf) {
    let lang = C.get().uiMeaning === "en" ? "en" : "ur";
    const body = h("div", { class: "intro-body" });
    const source = h("div", { class: "source" });
    const seg = h("div", { class: "seg" },
      ...["ur", "en"].map(l => h("button", { "data-v": l, onclick: () => { lang = l; fill(); } }, l === "ur" ? "اردو" : "English")));
    const more = h("button", { class: "btn", onclick: () => { body.classList.toggle("open"); more.textContent = body.classList.contains("open") ? "Show less" : "Read full introduction"; } }, "Read full introduction");
    function fill() {
      const d = inf[lang];
      body.innerHTML = sanitize(d?.html || "");
      body.className = "intro-body" + (lang === "ur" ? " urdu" : "");
      body.dir = lang === "ur" ? "rtl" : "ltr";
      source.textContent = "";
      source.append(d?.source || "", " · via Quran.com");
      $$("button", seg).forEach(b => b.classList.toggle("on", b.dataset.v === lang));
    }
    right.append(h("h3", {}, "Before you read: background", seg), body, h("div", { class: "intro-actions" }, more, source));
    fill();
  }
  gate.append(h("div", { class: "card gate-card" }, left, right));
}

// ======================================================= reader
let trList = [];        // selected translation meta
let trTexts = {};       // id -> array
let hadithData = null;
let ip = null;          // IndoPak text for this surah (when that script is chosen)

const isIP = () => C.get().script === "indopak" && ip;
const ayahText = idx => isIP() ? ip.ayahs[idx].join(" ") : data.ayahs[idx].u;
const wordText = (idx, i) => isIP() ? ip.ayahs[idx][i] : data.ayahs[idx].w[i].u;

async function loadTranslations() {
  trList = await C.selectedTranslations();
  await Promise.all(trList.map(async t => { trTexts[t.id] = await C.tr(t.id, N); }));
  $("#tr-count").textContent = trList.length;
}

function wordEl(w, a, i, idx) {
  const st = C.get();
  const txt = wordText(idx, i);
  const el = h("span", { class: "w", "data-k": a.k, "data-i": i, tabindex: "0", role: "button", "aria-label": `${w.tl}: ${w.en}` },
    h("span", { class: `ar-${st.script}`, lang: "ar" }, txt));
  if (st.wbw) {
    if (st.showTranslit && w.tl) el.append(h("span", { class: "g", style: "font-style:italic;color:var(--ink-3)" }, w.tl));
    if (st.wbwLang === "ur" || st.wbwLang === "both") el.append(h("span", { class: "g ur", lang: "ur" }, w.ur || ""));
    if (st.wbwLang === "en" || st.wbwLang === "both") el.append(h("span", { class: "g" }, w.en || ""));
  }
  return el;
}

function ayahEl(a, idx) {
  const st = C.get();
  const hc = hCounts[a.k] || 0;
  const head = h("div", { class: "ayah-head" },
    h("span", { class: "ayah-key" }, a.k),
    a.sajdah ? h("span", { class: "chip" }, "Sajdah") : null,
    h("span", { class: "tiny" }, `Juz ${a.juz} · Page ${a.page}`),
    h("span", { class: "sp" }),
    hc ? h("button", { class: "chip hadith-chip", onclick: () => openHadith(a.k), title: "Sahih hadith that cite this ayah" }, `${hc} Sahih hadith`) : null,
    h("button", { class: "chip tafsir-chip", onclick: () => openTafsir(a.k), title: "Read tafsir (commentary) of this ayah" }, "Tafsir"),
    h("button", { class: "icon-btn", title: "Play this ayah", "aria-label": `Play ayah ${a.k}`, html: ICON.play, onclick: () => player.playFrom(idx, true) }),
    h("button", { class: "icon-btn", title: "Copy ayah with translations", "aria-label": "Copy", html: ICON.copy, onclick: () => copyAyah(a, idx) }));

  const line = h("div", { class: "arabic-line", lang: "ar" },
    a.w.map((w, i) => wordEl(w, a, i, idx)),
    isIP()
      ? h("span", { class: "end-mark ar-indopak" }, `۝${toArabicDigits(a.n)}`)
      : h("span", { class: "end-mark ar-uthmani" }, `﴿${toArabicDigits(a.n)}﴾`));

  const trs = h("div", { class: "trs" }, trList.map(t => {
    const ur = t.lang === "ur";
    return h("div", { class: `tr-item ${ur ? "ur" : ""}`, lang: t.lang === "ur-Latn" ? "ur" : t.lang },
      h("div", { class: `txt ${ur ? "urdu" : ""}`, dir: ur ? "rtl" : "ltr" }, trTexts[t.id]?.[idx] ?? ""),
      h("div", { class: "who" }, `— ${t.name}`));
  }));
  return h("article", { class: "ayah", id: a.k, "data-idx": idx }, head, line, trs);
}

const toArabicDigits = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

async function renderReader() {
  const st = C.get();
  ip = st.script === "indopak" ? await C.indopak(N) : null;
  const r = $("#reader");
  r.innerHTML = "";
  if (ch.bismillah) {
    const text = ip ? (await C.indopak(1)).ayahs[0].join(" ") : (await C.surah(1)).ayahs[0].u;
    r.append(h("div", { class: `bismillah ar-${st.script}`, lang: "ar" }, text));
  }
  // render in chunks so long surahs stay responsive
  const frag = document.createDocumentFragment();
  data.ayahs.forEach((a, i) => frag.append(ayahEl(a, i)));
  r.append(frag);
  syncToolbar();
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" });
}

function copyAyah(a, idx) {
  const lines = [ayahText(idx), ...trList.map(t => `${trTexts[t.id][idx]} — ${t.name}`), `Quran ${a.k}`];
  navigator.clipboard?.writeText(lines.join("\n\n"));
}

// ======================================================= word popover
const pop = $("#pop");
let popWord = null;
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
  popWord = w;
  const st = C.get();
  pop.innerHTML = "";
  pop.append(
    h("div", { class: `w-ar ar-${st.script}`, lang: "ar" }, wordText(idx, +el.dataset.i)),
    h("div", { class: "w-tl" }, w.tl || ""),
    h("dl", {},
      h("dt", {}, "اردو"), h("dd", { class: "urdu", lang: "ur" }, w.ur || "—"),
      h("dt", {}, "English"), h("dd", {}, w.en || "—")),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => { wordAudio.src = C.WORD_AUDIO + w.a; wordAudio.play(); } }, h("span", { html: ICON.speaker }), "Listen"),
      h("span", { class: "tiny" }, `${a.k} · word ${+el.dataset.i + 1}`)),
    h("div", { class: "source", style: "margin-top:10px" }, "Word-by-word: Quran.com"));
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
  const chosen = trList.map(t => t.id);
  const groups = [["ur", "Urdu — اردو"], ["ur-Latn", "Roman Urdu"], ["en", "English"]];
  const body = h("div", {},
    h("p", { class: "muted", style: "margin-top:0" }, "Pick as many as you like. They appear in the order you tick them."),
    ...groups.map(([lang, label]) => h("div", { class: "opt-group" }, h("h4", {}, label),
      ...trMeta.list.filter(t => t.lang === lang).map(t => {
        const i = chosen.indexOf(t.id);
        return h("label", { class: "check" },
          h("input", { type: "checkbox", checked: i >= 0, onchange: e => {
            const cur = (C.get().translations?.length ? C.get().translations : trMeta.default).filter(x => x !== t.id);
            if (e.target.checked) cur.push(t.id);
            C.set({ translations: cur });
            $("#open-tr").click();
          } }),
          h("span", {}, t.name, h("div", { class: "tiny" }, "via Quran.com")),
          i >= 0 ? h("span", { class: "ord" }, `#${i + 1}`) : null);
      }))),
    h("div", { class: "note" }, "Translations are shown exactly as published. Only footnote markers are removed. ", h("a", { href: "sources.html" }, "Sources")));
  openDrawer("Translations", body);
};

// --- settings
$("#open-settings").innerHTML = ICON.gear + "<span>Settings</span>";
$("#open-settings").onclick = () => {
  const st = C.get();
  const seg = (key, opts) => h("div", { class: "seg" }, ...opts.map(([v, l]) =>
    h("button", { class: st[key] === v ? "on" : null, onclick: () => { C.set({ [key]: v }); $("#open-settings").click(); } }, l)));
  const body = h("div", {},
    h("div", { class: "opt-group" }, h("h4", {}, "Arabic script"), seg("script", [["indopak", "IndoPak (South Asian)"], ["uthmani", "Uthmani"]]),
      h("div", { class: "tiny", style: "margin-top:6px" }, "IndoPak: DigitalKhatt text and font, after the IndoPak 'Quraan Al Majeed' mushaf. Uthmani: Quran.com text.")),
    h("div", { class: "opt-group" }, h("h4", {}, "Arabic size"),
      h("div", { class: "range-row" }, h("span", { class: "tiny" }, "A"),
        h("input", { type: "range", min: 22, max: 56, value: st.arSize, oninput: e => C.set({ arSize: +e.target.value }) }),
        h("span", {}, "A"))),
    h("div", { class: "opt-group" }, h("h4", {}, "Word-by-word under each word"),
      seg("wbwLang", [["ur", "اردو"], ["en", "English"], ["both", "Both"]]),
      h("label", { class: "check", style: "margin-top:8px" },
        h("input", { type: "checkbox", checked: st.wbw, onchange: e => C.set({ wbw: e.target.checked }) }), "Show word meanings"),
      h("label", { class: "check" },
        h("input", { type: "checkbox", checked: st.showTranslit, onchange: e => C.set({ showTranslit: e.target.checked }) }), "Show transliteration")),
    h("div", { class: "opt-group" }, h("h4", {}, "Surah names & introduction language"), seg("uiMeaning", [["ur", "اردو"], ["en", "English"]])),
    h("div", { class: "opt-group" }, h("h4", {}, "Theme"), seg("theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]])));
  openDrawer("Reading settings", body);
};

// --- tafsir panel (fetched live from Quran.com, shown as published)
async function openTafsir(key) {
  const T = await C.tafsirs();
  const pick = () => C.get().tafsir || T.default[C.get().uiMeaning === "en" ? "en" : "ur"];
  const body = h("div");
  openDrawer(`Tafsir of ${key}`, body);

  async function fill() {
    const id = pick();
    const meta = T.list.find(t => t.id === id) || T.list[0];
    const ur = meta.lang === "ur";
    const select = h("select", { class: "tafsir-select", "aria-label": "Choose tafsir", onchange: e => { C.set({ tafsir: +e.target.value }); } },
      ...[["ur", "اردو — Urdu"], ["en", "English"]].map(([lang, label]) =>
        h("optgroup", { label }, ...T.list.filter(t => t.lang === lang).map(t =>
          h("option", { value: t.id, selected: t.id === meta.id }, t.name)))));
    const nav = (dir) => {
      const i = data.ayahs.findIndex(x => x.k === key) + dir;
      if (i >= 0 && i < data.ayahs.length) { key = data.ayahs[i].k; $("#drawer-title").textContent = `Tafsir of ${key}`; fill(); }
    };
    body.innerHTML = "";
    body.append(
      h("div", { class: "tafsir-bar" }, select,
        h("button", { class: "btn", onclick: () => nav(-1), "aria-label": "Previous ayah" }, "←"),
        h("button", { class: "btn", onclick: () => nav(1), "aria-label": "Next ayah" }, "→")),
      h("div", { class: "skeleton" }, "Loading tafsir…"));
    $("#drawer-body").scrollTop = 0;
    try {
      const res = await C.tafsirFor(meta.id, key);
      const t = res.tafsir || {};
      const covers = Object.keys(t.verses || {});
      const html = sanitize(t.text || "");
      body.lastChild.replaceWith(h("div", {},
        covers.length > 1 ? h("div", { class: "note", style: "margin:12px 0" },
          `This commentary explains ayahs ${covers[0]}–${covers[covers.length - 1].split(":")[1]} together.`) : null,
        html.trim()
          ? h("div", { class: `tafsir-body${ur ? " urdu" : ""}`, dir: ur ? "rtl" : "ltr", lang: meta.lang, html })
          : h("div", { class: "note", style: "margin-top:12px" }, "This tafsir has no separate commentary for this ayah."),
        h("div", { class: "source", style: "margin-top:16px" },
          `${meta.name} · ${meta.author || ""} · loaded live from Quran.com, shown as published`)));
    } catch {
      body.lastChild.replaceWith(h("div", { class: "note", style: "margin-top:12px" },
        "Couldn't load the tafsir. It's fetched live from Quran.com, so please check your internet connection and try again."));
    }
  }
  tafsirListener = fill;
  fill();
}
let tafsirListener = null;
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
      h("div", { class: "seg", style: "margin-bottom:12px" }, ...[["ur", "اردو"], ["en", "English"], ["ar", "العربية"]].map(([v, l]) =>
        h("button", { class: v === lang ? "on" : null, onclick: () => { lang = v; fill(); } }, l))),
      h("div", { class: "note" },
        `These hadith from Sahih al-Bukhari cite ayah ${key} in their text. We only show a link where the hadith's own published translation names the ayah. We add no links of our own. Check each one on sunnah.com.`),
      ...list.map(x => h("div", { class: "hadith" },
        h("div", { class: "h-ref" },
          h("span", {}, h("b", {}, `${x.c === "bukhari" ? "Sahih al-Bukhari" : "Sahih Muslim"} ${x.num}`), h("span", { class: "tiny" }, ` · Book ${x.book}: ${x.bookName || ""} · Hadith ${x.inBook}`)),
          h("a", { href: x.url, target: "_blank", rel: "noopener" }, "Verify on sunnah.com ↗")),
        h("div", { class: `h-txt ${lang === "ur" ? "urdu" : lang === "ar" ? "ar" : ""}`, dir: lang === "en" ? "ltr" : "rtl", lang },
          (lang === "ur" ? x.ur : lang === "ar" ? x.ar : x.en) || "(not available in this language)"),
        h("div", { class: "tiny", style: "margin-top:6px" }, "Also cites: ", x.refs.filter(r => r !== key).slice(0, 12).join(", ") || "—"))),
      h("div", { class: "source", style: "margin-top:14px" }, src["sahih-hadith-text"].publisher));
  }
  fill();
  openDrawer(`Sahih hadith citing ${key}`, body);
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
    audio.src = C.AYAH_AUDIO(a.id);
    $$(".ayah.playing").forEach(x => x.classList.remove("playing"));
    const el = document.getElementById(a.k);
    el?.classList.add("playing");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  toggle() {
    if (this.playing) { audio.pause(); this.playing = false; }
    else { if (this.idx < 0) this.idx = 0, this.load(); this.continuous = true; audio.play(); this.playing = true; }
    syncPlay();
  },
};
audio.addEventListener("ended", () => {
  if (player.continuous && player.idx < data.ayahs.length - 1) { player.idx++; player.load(); audio.play(); }
  else { player.playing = false; syncPlay(); }
});
function syncPlay() {
  $("#play-all").innerHTML = (player.playing ? ICON.pause + "<span>Pause</span>" : ICON.play + "<span>Listen</span>");
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
