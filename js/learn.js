// Learn the most frequent words: coverage meter, "top N" chart, flashcards, word list.
// Word list + counts: data/vocab.json (Quranic Arabic Corpus lemmas; Quran.com word-by-word meanings).
import * as C from "./common.js";
const { h, $, $$, t } = C;
const L = C.learn;

C.header("learn");
C.footer();
document.title = t("learn.pageTitle");

const [V, IX] = await Promise.all([L.vocab(), C.rootsIndex()]);
const rootId = new Map(IX.roots.map(r => [r.r, r.id]));
const rank = new Map(V.items.map((it, i) => [it.k, i + 1]));
const cum = [];                                  // cumulative coverage after rank i
V.items.reduce((s, it, i) => (cum[i] = s + it.n, cum[i]), 0);
const pct = x => (Math.round(x * 10) / 10).toLocaleString();
const fmt = n => n.toLocaleString();
const main = $("#main");

const meaning = (it, lang, n = 2) => it[lang].slice(0, n).map(([g]) => g).join(" · ");
const rootLink = it => it.r && rootId.has(it.r)
  ? h("a", { href: `root.html?r=${rootId.get(it.r)}`, class: "root-letters small", lang: "ar" }, C.spacedRoot(it.r)) : null;

// ------------------------------------------------------------------ coverage meter + curve
const meter = h("section", { class: "card learn-meter" });
function renderMeter() {
  const c = L.coverage(V);
  meter.innerHTML = "";
  meter.append(
    h("div", { class: "lm-num" }, t("learn.youKnow", { n: fmt(c.words) })),
    h("div", { class: "lm-sub" }, t("learn.recognise", { pct: pct(c.pct), total: fmt(V.total) })),
    h("div", { class: "progress show big" }, h("span", { style: `width:${Math.min(100, c.pct)}%` })));
}
const curve = h("section", { class: "card learn-curve" },
  h("h3", {}, t("learn.curveTitle")),
  ...L.coverageCurve(V).map(p => h("div", { class: "lc-row" },
    h("span", { class: "lc-label" }, t("learn.curveRow", { n: fmt(p.n), pct: Math.round(p.pct) })),
    h("span", { class: "lc-bar" }, h("span", { style: `width:${p.pct}%` })))),
  h("div", { class: "tiny", style: "margin-top:10px" }, t("learn.curveNote", { total: fmt(V.total) })));

// ------------------------------------------------------------------ flashcards
let group = "all";
const practice = h("section", { class: "card learn-practice" });
function renderPracticeStart() {
  const sizes = [10, 20, 50];
  let size = 20;
  const sizeSeg = h("div", { class: "seg" }, ...sizes.map(n =>
    h("button", { class: n === size ? "on" : null, onclick: e => { size = n; $$("button", sizeSeg).forEach(b => b.classList.toggle("on", b === e.currentTarget)); } }, String(n))));
  practice.innerHTML = "";
  practice.append(
    h("h3", {}, t("learn.practiceTitle")),
    h("p", { class: "muted", style: "margin:0 0 12px" }, t("learn.practiceLead")),
    h("div", { class: "controls" }, h("span", { class: "tiny" }, t("learn.deck")), sizeSeg, groupSeg(() => {}),
      h("button", { class: "btn primary", onclick: () => startPractice(size) }, t("learn.start"))));
}

async function startPractice(size) {
  const deck = L.nextToLearn(V, size, { group });
  if (!deck.length) { practice.append(h("p", { class: "note" }, t("learn.allKnown"))); return; }
  let i = 0, knew = 0;
  async function show() {
    if (i >= deck.length) {
      practice.innerHTML = "";
      practice.append(h("h3", {}, t("learn.practiceTitle")), h("p", { class: "lead" }, t("learn.done", { known: knew, n: deck.length })),
        h("button", { class: "btn primary", onclick: renderPracticeStart }, t("learn.again")));
      return;
    }
    const it = deck[i];
    const back = h("div", { class: "fc-back hidden" });
    const revealBtn = h("button", { class: "btn", onclick: async () => { revealBtn.remove(); back.classList.remove("hidden"); back.append(await example(it)); } }, t("learn.show"));
    back.append(
      h("div", { class: "fc-meaning urdu", lang: "ur", dir: "rtl" }, meaning(it, "ur")),
      h("div", { class: "fc-meaning" }, meaning(it, "en")),
      h("div", { class: "tiny" }, t("learn.times", { n: fmt(it.n) }), " · ", C.morphLabel(it.p, ""), " ", rootLink(it) || ""));
    practice.innerHTML = "";
    practice.append(
      h("div", { class: "row-between" }, h("h3", { style: "margin:0" }, t("learn.practiceTitle")), h("span", { class: "tiny" }, t("learn.cardOf", { i: i + 1, n: deck.length }))),
      h("div", { class: "progress show" }, h("span", { style: `width:${(i / deck.length) * 100}%` })),
      h("div", { class: "flashcard" },
        h("div", { class: "fc-word", lang: "ar" }, it.l),
        h("div", { class: "tiny" }, `#${rank.get(it.k)}`),
        revealBtn, back),
      h("div", { class: "fc-actions" },
        h("button", { class: "btn", onclick: () => { i++; show(); } }, t("learn.stillLearning")),
        h("button", { class: "btn primary", onclick: () => { L.setKnown(it.k, true); knew++; i++; refresh(); show(); } }, t("learn.knowIt"))),
      h("div", { class: "tiny", style: "margin-top:10px" }, t("learn.meaningsNote")));
  }
  show();
}

async function example(it) {
  const [s, a, w] = it.ex.split(":").map(Number);
  const [sd, ip, ch] = await Promise.all([C.surah(s), C.scriptText(s), C.chapters()]);
  const ay = sd.ayahs[a - 1];
  const words = ay.w.map((x, i) => h("span", { class: `pw${i === w - 1 ? " name" : ""}` }, ip ? ip.ayahs[a - 1][i] : x.u));
  return h("div", { class: "fc-example" },
    h("div", { class: "tiny" }, t("learn.example", { key: `${ch[s - 1].name} ${s}:${a}` }), " ",
      h("a", { href: `surah.html?n=${s}#${s}:${a}` }, t("common.readInContext"))),
    h("div", { class: `p-arabic ar-${C.get().script}`, lang: "ar", dir: "rtl" }, ...words.flatMap((x, i) => i ? [" ", x] : [x])));
}

function groupSeg(onChange) {
  const opts = [["all", "learn.groupAll"], ["nouns", "learn.groupNouns"], ["verbs", "learn.groupVerbs"], ["particles", "learn.groupParticles"]];
  const seg = h("div", { class: "seg wrap-seg" }, ...opts.map(([v, k]) =>
    h("button", { class: v === group ? "on" : null, "data-v": v, onclick: () => { group = v; $$(`.group-seg button`).forEach(b => b.classList.toggle("on", b.dataset.v === v)); onChange(); renderList(); } }, t(k))));
  seg.classList.add("group-seg");
  return seg;
}

// ------------------------------------------------------------------ word list
let filter = "all", shown = 0;
const PAGE = 50;
const listBody = h("div", { class: "v-list" });
const listCount = h("span", { class: "tiny" });
function rows() {
  const known = L.knownSet();
  return V.items.filter(it => L.inGroup(it.p, group) &&
    (filter === "all" || (filter === "known") === known.has(it.k)));
}
function row(it, known) {
  const r = rank.get(it.k);
  return h("div", { class: `v-row${known.has(it.k) ? " known" : ""}` },
    h("span", { class: "v-rank" }, r),
    h("span", { class: "v-word", lang: "ar" }, it.l),
    h("span", { class: "v-mean" }, h("span", { class: "urdu", lang: "ur" }, meaning(it, "ur", 1)), h("span", {}, meaning(it, "en", 1))),
    h("span", { class: "v-type tiny" }, C.morphLabel(it.p, ""), " ", rootLink(it) || ""),
    h("span", { class: "v-count" }, fmt(it.n)),
    h("span", { class: "v-cum tiny" }, `${pct(cum[r - 1] / V.total * 100)}%`),
    h("label", { class: "v-known" }, h("input", {
      type: "checkbox", checked: known.has(it.k), "aria-label": t("learn.markKnown", { word: it.l }),
      onchange: e => { L.setKnown(it.k, e.target.checked); e.target.closest(".v-row").classList.toggle("known", e.target.checked); renderMeter(); },
    })));
}
function renderList() {
  shown = 0;
  listBody.innerHTML = "";
  listBody.append(h("div", { class: "v-row v-head" },
    ...["learn.colRank", "learn.colWord", "learn.colMeaning", "morph.pos", "learn.colCount", "learn.colCum", "learn.colKnown"].map(k => h("span", {}, t(k)))));
  more();
}
function more() {
  const all = rows(), known = L.knownSet();
  listCount.textContent = t("learn.listCount", { n: fmt(all.length) });
  listBody.querySelector(".more")?.remove();
  all.slice(shown, shown + PAGE).forEach(it => listBody.append(row(it, known)));
  shown += PAGE;
  if (shown < all.length)
    listBody.append(h("button", { class: "btn more", style: "margin:10px auto;display:flex", onclick: more }, t("common.showMore", { n: fmt(all.length - shown) })));
}
const filterSeg = h("div", { class: "seg" }, ...[["all", "learn.filterAll"], ["todo", "learn.filterTodo"], ["known", "learn.filterKnown"]].map(([v, k]) =>
  h("button", { class: v === filter ? "on" : null, onclick: e => { filter = v; $$("button", filterSeg).forEach(b => b.classList.toggle("on", b === e.currentTarget)); renderList(); } }, t(k))));

function refresh() { renderMeter(); }

// ------------------------------------------------------------------ page
main.innerHTML = "";
main.append(
  h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
    h("h1", { html: t("learn.titleHtml") }),
    h("p", { class: "lead", style: "margin:0" }, t("learn.lead"))),
  h("div", { class: "learn-top" }, meter, curve),
  practice,
  h("div", { class: "section-h" }, h("div", {}, h("h2", {}, t("learn.listTitle")), listCount),
    h("div", { class: "controls" }, filterSeg, groupSeg(() => {}))),
  listBody,
  h("div", { class: "row-between", style: "margin:10px 0 60px" },
    h("div", { class: "source" }, t("learn.source"), " ", h("a", { href: "sources.html" }, t("nav.sources"))),
    h("button", { class: "btn", onclick: () => { if (confirm(t("learn.resetConfirm"))) { C.set({ known: [] }); renderMeter(); renderList(); } } }, t("learn.reset"))));
renderMeter();
renderPracticeStart();
renderList();
C.onChange((_, patch) => { if ("known" in patch) renderMeter(); });
