import * as C from "./common.js";
const { h, $, $$, ICON, t } = C;

C.header("timeline");
C.footer();
document.title = t("timeline.pageTitle");

const [chs, S] = await Promise.all([C.chapters(), C.seerah()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const Y = S.frame.years;                       // 23
const pct = y => (y / Y) * 100;
let lang = C.get().uiMeaning === "en" ? "en" : "ur";
const ayahLink = k => `surah.html?n=${k.split(":")[0]}#${k}`;

// ---------------------------------------------------------------- frame quote (Bukhari 3902)
function renderQuote() {
  const q = $("#frame-quote");
  q.innerHTML = "";
  q.append(
    h("div", { class: "seg", style: "float:right;margin-left:10px" }, ...["ur", "en"].map(v =>
      h("button", { class: v === lang ? "on" : null, onclick: () => { lang = v; renderQuote(); renderEvents(); } }, t(`lang.${v}`)))),
    h("div", { class: lang === "ur" ? "urdu" : "", dir: lang === "ur" ? "rtl" : "ltr", style: "font-size:" + (lang === "ur" ? "17px" : "15px") },
      lang === "ur" ? S.frame.ur : S.frame.text),
    h("div", { class: "source", style: "margin-top:8px;clear:both" }, t("timeline.frameSource"),
      h("a", { href: S.frame.url, target: "_blank", rel: "noopener" }, t("timeline.verify"))));
}
renderQuote();

// ---------------------------------------------------------------- periods + ruler
$("#tl-periods").append(
  h("div", { class: "period makkah", style: `width:${pct(S.frame.makkah)}%` }, h("b", {}, t("common.makkah")), h("span", {}, t("timeline.years", { n: S.frame.makkah }))),
  h("div", { class: "period madinah", style: `width:${pct(S.frame.madinah)}%` }, h("b", {}, t("common.madinah")), h("span", {}, t("timeline.years", { n: S.frame.madinah }))));
const ruler = $("#tl-ruler");
for (let y = 0; y <= Y; y++) {
  const major = y % 5 === 0 || y === S.frame.makkah || y === Y;
  ruler.append(h("span", { class: `tick${major ? " major" : ""}`, style: `left:${pct(y)}%` }, major ? h("i", {}, String(y)) : null));
}
ruler.append(h("span", { class: "ruler-cap" }, t("timeline.rulerCap")));

// ---------------------------------------------------------------- dated anchors
const events = S.events;
const evById = Object.fromEntries(events.map(e => [e.id, e]));
const anchorBox = $("#tl-anchors");
const ROW = { revelation: 0, khadija: 1, hijrah: 0, conquest: 2, death: 3 };   // label rows so labels never collide
S.anchors.forEach(a => {
  const ev = evById[a.id];
  const pos = a.year === 0 ? " start" : pct(a.year) > 70 ? " end" : "";
  const row = ROW[a.id] ?? 0;
  const label = t(`timeline.anchor.${a.id}`);
  const el = h("button", {
    class: `anchor${pos}`, style: `left:${pct(a.year)}%`,
    onclick: () => openEvent(ev.id), title: a.how,
  }, h("span", { class: "pin" }), h("span", { class: "stem", style: `height:${4 + row * 24}px` }),
    h("span", { class: "lbl" }, label.startsWith("⟦") ? ev.name.en : label, h("em", {}, t("common.yr", { n: a.year }))));
  el.addEventListener("mousemove", e => C.tip(e, `<b>${ev.name.en}</b><br>${a.how}`));
  el.addEventListener("mouseleave", () => C.tip(null));
  anchorBox.append(el);
});

// ---------------------------------------------------------------- surah lane (order within each period)
const lane = $("#tl-surahs");
const ordered = [...chs].sort((a, b) => a.order - b.order);
const maxA = Math.sqrt(Math.max(...chs.map(c => c.ayahs)));
function placeGroup(list, from, span) {
  list.forEach((c, i) => {
    const x = from + span * ((i + 0.5) / list.length);
    const bar = h("a", {
      class: `sbar ${c.place}`, href: `surah.html?n=${c.n}`, "data-n": c.n,
      style: `left:${pct(x)}%;height:${Math.max(8, Math.sqrt(c.ayahs) / maxA * 100)}%`,
      "aria-label": t("aria.surahBar", { name: c.name, order: c.order, ayahs: c.ayahs, place: C.placeName(c.place) }),
    });
    bar.addEventListener("mousemove", e => C.tip(e, C.surahTip(c)));
    bar.addEventListener("mouseleave", () => C.tip(null));
    lane.append(bar);
  });
}
placeGroup(ordered.filter(c => c.place === "makkah"), 0, S.frame.makkah);
placeGroup(ordered.filter(c => c.place === "madinah"), S.frame.makkah, S.frame.madinah);

function highlight(surahs) {
  const set = new Set(surahs || []);
  lane.classList.toggle("focus", set.size > 0);
  $$(".sbar", lane).forEach(b => b.classList.toggle("hit", set.has(+b.dataset.n)));
}

// ---------------------------------------------------------------- events
$("#order-note").textContent = S.note;
function eventCard(e) {
  const card = h("button", { class: `card ev ${e.period}`, id: `ev-${e.id}`, onclick: () => openEvent(e.id) },
    h("div", { class: "ev-n" }, e.order),
    h("div", { class: "ev-body" },
      h("div", { class: "ev-name" }, e.name.en),
      h("div", { class: "ev-ur urdu" }, e.name.ur),
      h("div", { class: "ev-meta" },
        e.year != null ? h("span", { class: "chip dated" }, t("common.year", { n: e.year })) : null,
        h("span", { class: "chip" }, t("common.hadith", { n: e.count })),
        e.surahs.length ? h("span", { class: "chip hadith-chip" },
          t("timeline.cites", { n: e.refs.length, surahs: e.surahs.map(n => byN[n].name).join(", ") })) : null)));
  card.addEventListener("mouseenter", () => highlight(e.surahs));
  card.addEventListener("mouseleave", () => highlight(null));
  return card;
}
function renderEvents() {
  const box = $("#events");
  box.innerHTML = "";
  for (const p of ["makkah", "madinah"]) {
    box.append(h("div", { class: "ev-col" },
      h("h3", { class: `ev-h ${p}` }, t(`timeline.${p}Period`)),
      ...events.filter(e => e.period === p).map(eventCard)));
  }
}
renderEvents();

// ---------------------------------------------------------------- drawer
const drawer = $("#drawer"), scrim = $("#scrim");
$("#drawer-close").innerHTML = ICON.close;
const close = () => { drawer.classList.remove("show"); scrim.classList.remove("show"); highlight(null); history.replaceState(null, "", location.pathname); };
$("#drawer-close").onclick = close; scrim.onclick = close;
document.addEventListener("keydown", e => e.key === "Escape" && close());

async function openEvent(id) {
  const e = evById[id];
  const recs = await C.seerahEvent(id);
  const anchor = S.anchors.find(a => a.id === id);
  let hl = lang;
  let shown = 8;
  const body = h("div");
  function fill() {
    body.innerHTML = "";
    body.append(...[
      h("div", { class: "ev-ur urdu", style: "font-size:20px" }, e.name.ur),
      anchor ? h("div", { class: "note", style: "margin:10px 0" }, h("b", {}, t("timeline.anchorYear", { n: anchor.year })), anchor.how) : null,
      h("div", { class: "note", style: "margin:10px 0" },
        t("timeline.chapterNote", { from: e.range[0], to: e.range[1], n: e.count }), t("timeline.quoteNote")),
      e.refs.length ? h("div", { style: "margin:12px 0" },
        h("h4", { class: "tiny", style: "text-transform:uppercase;letter-spacing:1px;margin:0 0 6px" }, t("timeline.ayahsCited")),
        h("div", { class: "ev-meta" }, ...e.refs.map(k => h("a", { class: "chip hadith-chip", href: ayahLink(k) }, `${byN[+k.split(":")[0]].name} ${k}`)))) : null,
      h("div", { class: "seg", style: "margin:6px 0 4px" }, ...["ur", "en", "ar"].map(v =>
        h("button", { class: v === hl ? "on" : null, onclick: () => { hl = v; fill(); } }, t(`lang.${v}`)))),
      ...recs.slice(0, shown).map(x => h("div", { class: "hadith" },
        h("div", { class: "h-ref" }, h("b", {}, t("surah.hadithRef", { collection: t("collection.bukhari"), num: x.num })),
          h("a", { href: x.url, target: "_blank", rel: "noopener" }, t("common.verifySunnah"))),
        h("div", { class: `h-txt ${hl === "ur" ? "urdu" : hl === "ar" ? "ar" : ""}`, dir: hl === "en" ? "ltr" : "rtl", lang: hl },
          (hl === "ur" ? x.ur : hl === "ar" ? x.ar : x.en) || t("common.notInLanguage")),
        x.refs.length ? h("div", { class: "tiny", style: "margin-top:6px" }, t("timeline.citesShort"),
          ...x.refs.map((k, i) => [i ? ", " : "", h("a", { href: ayahLink(k) }, k)])) : null)),
      recs.length > shown ? h("button", { class: "btn", style: "margin-top:14px", onclick: () => { shown += 10; fill(); } },
        t("common.showMore", { n: recs.length - shown })) : null,
      h("div", { class: "source", style: "margin-top:14px" }, t("timeline.source"))].filter(Boolean));
  }
  fill();
  $("#drawer-title").textContent = e.name.en;
  const b = $("#drawer-body"); b.innerHTML = ""; b.append(body); b.scrollTop = 0;
  drawer.classList.add("show"); scrim.classList.add("show");
  highlight(e.surahs);
  history.replaceState(null, "", `#${id}`);
}

const fromHash = () => { const id = location.hash.slice(1); if (evById[id]) openEvent(id); };
addEventListener("hashchange", fromHash);
fromHash();
