import * as C from "./common.js";
const { h, $, $$, ICON } = C;

C.header("timeline");
C.footer();

const [chs, S] = await Promise.all([C.chapters(), C.getJSON("data/seerah.json")]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const Y = S.frame.years;                       // 23
const pct = y => (y / Y) * 100;
let lang = C.get().uiMeaning === "en" ? "en" : "ur";

// ---------------------------------------------------------------- frame quote (Bukhari 3902)
function renderQuote() {
  const q = $("#frame-quote");
  q.innerHTML = "";
  q.append(
    h("div", { class: "seg", style: "float:right;margin-left:10px" }, ...[["ur", "اردو"], ["en", "English"]].map(([v, l]) =>
      h("button", { class: v === lang ? "on" : null, onclick: () => { lang = v; renderQuote(); renderEvents(); } }, l))),
    h("div", { class: lang === "ur" ? "urdu" : "", dir: lang === "ur" ? "rtl" : "ltr", style: "font-size:" + (lang === "ur" ? "17px" : "15px") },
      lang === "ur" ? S.frame.ur : S.frame.text),
    h("div", { class: "source", style: "margin-top:8px;clear:both" }, "Sahih al-Bukhari 3902 · ",
      h("a", { href: S.frame.url, target: "_blank", rel: "noopener" }, "verify on sunnah.com ↗")));
}
renderQuote();

// ---------------------------------------------------------------- periods + ruler
$("#tl-periods").append(
  h("div", { class: "period makkah", style: `width:${pct(S.frame.makkah)}%` }, h("b", {}, "Makkah"), h("span", {}, ` · ${S.frame.makkah} years`)),
  h("div", { class: "period madinah", style: `width:${pct(S.frame.madinah)}%` }, h("b", {}, "Madinah"), h("span", {}, ` · ${S.frame.madinah} years`)));
const ruler = $("#tl-ruler");
for (let y = 0; y <= Y; y++) {
  const major = y % 5 === 0 || y === 13 || y === Y;
  ruler.append(h("span", { class: `tick${major ? " major" : ""}`, style: `left:${pct(y)}%` }, major ? h("i", {}, String(y)) : null));
}
ruler.append(h("span", { class: "ruler-cap" }, "years after the first revelation"));

// ---------------------------------------------------------------- dated anchors
const events = S.events;
const evById = Object.fromEntries(events.map(e => [e.id, e]));
const anchorBox = $("#tl-anchors");
const SHORT = { revelation: "Revelation begins", khadija: "Death of Khadija", hijrah: "Hijrah", conquest: "Conquest of Makkah", death: "Passing of the Prophet" };
const ROW = { revelation: 0, khadija: 1, hijrah: 0, conquest: 2, death: 3 };   // label rows so labels never collide
S.anchors.forEach(a => {
  const ev = evById[a.id];
  const pos = a.year === 0 ? " start" : pct(a.year) > 70 ? " end" : "";
  const row = ROW[a.id] ?? 0;
  const el = h("button", {
    class: `anchor${pos}`, style: `left:${pct(a.year)}%`,
    onclick: () => openEvent(ev.id), title: a.how,
  }, h("span", { class: "pin" }), h("span", { class: "stem", style: `height:${4 + row * 24}px` }),
    h("span", { class: "lbl" }, SHORT[a.id] || ev.name.en, h("em", {}, ` · yr ${a.year}`)));
  el.addEventListener("mousemove", e => C.tip(e, `<b>${ev.name.en}</b><br>${a.how}`));
  el.addEventListener("mouseleave", () => C.tip(null));
  anchorBox.append(el);
});

// ---------------------------------------------------------------- surah lane (order within each period)
const lane = $("#tl-surahs");
const ordered = [...chs].sort((a, b) => a.order - b.order);
const mk = ordered.filter(c => c.place === "makkah"), md = ordered.filter(c => c.place === "madinah");
const maxA = Math.sqrt(Math.max(...chs.map(c => c.ayahs)));
function placeGroup(list, from, span) {
  list.forEach((c, i) => {
    const x = from + span * ((i + 0.5) / list.length);
    const bar = h("a", {
      class: `sbar ${c.place}`, href: `surah.html?n=${c.n}`, "data-n": c.n,
      style: `left:${pct(x)}%;height:${Math.max(8, Math.sqrt(c.ayahs) / maxA * 100)}%`,
      "aria-label": `${c.name}, revealed number ${c.order}`,
    });
    bar.addEventListener("mousemove", e => C.tip(e,
      `<b>${c.n}. ${c.name}</b> <span style="font-family:var(--font-uthmani)">${c.ar}</span><br>Revealed #${c.order} of 114 · ${c.ayahs} ayahs`));
    bar.addEventListener("mouseleave", () => C.tip(null));
    lane.append(bar);
  });
}
placeGroup(mk, 0, S.frame.makkah);
placeGroup(md, S.frame.makkah, S.frame.madinah);

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
        e.year != null ? h("span", { class: "chip dated" }, `Year ${e.year}`) : null,
        h("span", { class: "chip" }, `${e.count} hadith`),
        e.surahs.length ? h("span", { class: "chip hadith-chip" }, `Cites ${e.refs.length} ayah${e.refs.length > 1 ? "s" : ""}: ` +
          e.surahs.map(n => byN[n].name).join(", ")) : null)));
  card.addEventListener("mouseenter", () => highlight(e.surahs));
  card.addEventListener("mouseleave", () => highlight(null));
  return card;
}
function renderEvents() {
  const box = $("#events");
  box.innerHTML = "";
  for (const [p, label] of [["makkah", "Makkah period"], ["madinah", "Madinah period"]]) {
    box.append(h("div", { class: "ev-col" },
      h("h3", { class: `ev-h ${p}` }, label),
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
  const recs = await C.getJSON(`data/seerah/${id}.json`);
  const anchor = S.anchors.find(a => a.id === id);
  let hl = lang === "en" ? "en" : lang;
  let shown = 8;
  const body = h("div");
  function fill() {
    body.innerHTML = "";
    body.append(...[
      h("div", { class: "ev-ur urdu", style: "font-size:20px" }, e.name.ur),
      anchor ? h("div", { class: "note", style: "margin:10px 0" }, h("b", {}, `Year ${anchor.year} after the first revelation. `), anchor.how) : null,
      h("div", { class: "note", style: "margin:10px 0" },
        `Sahih al-Bukhari ${e.range[0]}–${e.range[1]}: ${e.count} hadith in the chapter Imam al-Bukhari gave to this event. `,
        "We quote them as published. Check each one on sunnah.com."),
      e.refs.length ? h("div", { style: "margin:12px 0" }, h("h4", { class: "tiny", style: "text-transform:uppercase;letter-spacing:1px;margin:0 0 6px" }, "Ayahs these hadith cite"),
        h("div", { class: "ev-meta" }, ...e.refs.map(k => h("a", { class: "chip hadith-chip", href: `surah.html?n=${k.split(":")[0]}#${k}` }, `${byN[+k.split(":")[0]].name} ${k}`)))) : null,
      h("div", { class: "seg", style: "margin:6px 0 4px" }, ...[["ur", "اردو"], ["en", "English"], ["ar", "العربية"]].map(([v, l]) =>
        h("button", { class: v === hl ? "on" : null, onclick: () => { hl = v; fill(); } }, l))),
      ...recs.slice(0, shown).map(x => h("div", { class: "hadith" },
        h("div", { class: "h-ref" }, h("b", {}, `Sahih al-Bukhari ${x.num}`),
          h("a", { href: x.url, target: "_blank", rel: "noopener" }, "Verify on sunnah.com ↗")),
        h("div", { class: `h-txt ${hl === "ur" ? "urdu" : hl === "ar" ? "ar" : ""}`, dir: hl === "en" ? "ltr" : "rtl", lang: hl },
          (hl === "ur" ? x.ur : hl === "ar" ? x.ar : x.en) || "(not available in this language)"),
        x.refs.length ? h("div", { class: "tiny", style: "margin-top:6px" }, "Cites: ",
          ...x.refs.map((k, i) => [i ? ", " : "", h("a", { href: `surah.html?n=${k.split(":")[0]}#${k}` }, k)])) : null)),
      recs.length > shown ? h("button", { class: "btn", style: "margin-top:14px", onclick: () => { shown += 10; fill(); } },
        `Show more (${recs.length - shown} left)`) : null,
      h("div", { class: "source", style: "margin-top:14px" }, "Sahih al-Bukhari · fawazahmed0/hadith-api")].filter(Boolean));
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
