import * as C from "./common.js";
const { h, $, $$, t } = C;

C.header("places");
C.footer();

const [D, chs] = await Promise.all([C.places(), C.chapters()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const byId = Object.fromEntries(D.places.map(p => [p.id, p]));
const M = D.map;
const main = $("#main");
const params = new URLSearchParams(location.search);
const SVG = "http://www.w3.org/2000/svg";
const TYPES = ["city", "land", "mountain", "mosque"];

function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

// Places closer than this (in map units) share one marker, e.g. Makkah, the Kaaba, Safa and Marwah.
const NEAR = 18;
function clusters(list) {
  const out = [];
  for (const p of list.filter(p => p.at)) {
    const c = out.find(c => Math.hypot(c.x - p.at.x, c.y - p.at.y) < NEAR);
    if (c) c.places.push(p); else out.push({ x: p.at.x, y: p.at.y, places: [p] });
  }
  return out;
}

/** The map. focus = a place id to highlight (detail page); onPick(cluster) for the index page. */
function drawMap({ focus = null, onPick = null } = {}) {
  const root = svg("svg", { viewBox: `0 0 ${M.w} ${M.h}`, class: "pl-map", role: onPick ? "group" : "img", "aria-label": t("places.mapAria") },
    svg("rect", { x: 0, y: 0, width: M.w, height: M.h, class: "pl-sea" }),
    svg("path", { d: M.land, class: "pl-land" }),
    ...M.rivers.map(d => svg("path", { d, class: "pl-river" })));
  const cs = clusters(D.places);
  for (const c of cs) {
    const ids = c.places.map(p => p.id);
    const on = focus && ids.includes(focus);
    const region = c.places.every(p => p.at.region);
    const label = c.places.length > 1 ? t("places.cluster", { name: c.places[0].en, n: c.places.length - 1 }) : c.places[0].en;
    const g = svg("g", { class: `pl-pin${on ? " on" : ""}${region ? " region" : ""}${focus && !on ? " dim" : ""}`, tabindex: onPick ? 0 : null,
      role: onPick ? "button" : null, "aria-label": c.places.length > 1 ? `${label}: ${c.places.map(p => p.en).join(", ")}` : label },
      region ? svg("circle", { cx: c.x, cy: c.y, r: 34, class: "pl-area" }) : null,
      svg("circle", { cx: c.x, cy: c.y, r: c.places.length > 1 ? 8 : 6, class: "pl-dot" }),
      svg("text", { x: c.x + 12, y: c.y + 5, class: "pl-label" }, label));
    if (onPick) {
      g.addEventListener("click", () => onPick(c));
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(c); } });
    }
    root.append(g);
  }
  return root;
}

const typeChip = p => h("span", { class: "chip" }, t(`places.type.${p.type}`));
const ayahCount = p => t("common.ayahs", { n: p.ayahs });
const unplacedChip = () => h("span", { class: "chip pl-off" }, t("places.unplaced"));

function card(p) {
  return h("a", { class: "card p-card", href: `places.html?p=${p.id}` },
    h("div", { class: "p-ar", translate: "no" }, p.ar),
    h("div", { class: "p-en" }, p.en),
    p.names.length > 1 ? h("div", { class: "tiny" }, t("places.alsoCalled"), p.names.filter(n => n.id !== p.id).map(n => n.en).join(", ")) : null,
    h("div", { class: "pl-row", style: "margin-top:4px" },
      typeChip(p), h("span", { class: "p-meta" }, ayahCount(p)), p.at ? null : unplacedChip()));
}

// ------------------------------------------------------------------ index
function renderIndex() {
  document.title = t("places.pageTitle");
  const pick = h("div", { class: "pl-pick", "aria-live": "polite" }, h("span", { class: "tiny" }, t("places.tapHint")));
  const onPick = c => {
    pick.innerHTML = "";
    pick.append(...c.places.map(p => h("a", { class: "chip", href: `places.html?p=${p.id}` }, p.en, h("span", { class: "s-ar-inline", translate: "no" }, p.ar))));
  };
  const off = D.places.filter(p => !p.at);
  main.innerHTML = "";
  main.append(
    h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
      h("h1", { html: t("places.titleHtml") }),
      h("p", { class: "lead", style: "margin:0" }, t("places.lead", { n: D.places.length }))),
    h("div", { class: "note", style: "margin:18px 0 0" }, t("places.note"), h("a", { href: "sources.html" }, t("places.noteLink"))),
    h("section", { class: "card pl-card" }, drawMap({ onPick }), pick,
      h("div", { class: "tiny", style: "margin-top:8px" }, t("places.mapNote", { n: off.length, list: off.map(p => p.en).join(", ") }))),
    ...TYPES.map(type => {
      const list = D.places.filter(p => p.type === type);
      return list.length ? h("section", {},
        h("div", { class: "section-h", style: "margin-top:26px" }, h("h2", {}, t(`places.types.${type}`))),
        h("div", { class: "p-grid", style: "margin:12px 0 0" }, ...list.map(card))) : null;
    }),
    h("div", { style: "height:60px" }));
}

// ------------------------------------------------------------------ one place
async function renderPlace(p) {
  document.title = t("places.placeTitle", { name: p.en });
  const st = C.get();
  const trs = await C.selectedTranslations();
  const aliases = p.names.filter(n => n.id !== p.id);
  main.innerHTML = "";
  const groupsBox = h("div", { class: "p-groups" });
  main.append(
    h("nav", { style: "margin:24px 0 0" }, h("a", { href: "places.html" }, t("places.back"))),
    h("section", { class: "card p-head pl-head" },
      h("div", {},
        h("div", { class: "p-ar big", translate: "no" }, p.ar),
        h("h1", {}, p.en),
        aliases.length ? h("div", { class: "muted" }, t("places.alsoCalled"),
          ...aliases.map((n, i) => [i ? ", " : "", h("b", {}, n.en), ` (${n.ar})`])) : null,
        h("div", { class: "pl-row", style: "margin-top:8px" }, typeChip(p), h("span", { class: "p-meta" }, t("places.mentionedIn", { ayahs: ayahCount(p) }))),
        h("div", { class: "source", style: "margin-top:10px" }, t("places.source"),
          h("a", { href: p.url, target: "_blank", rel: "noopener" }, t("places.viewConcept"))),
        p.at
          ? h("div", { class: "source" }, t(p.at.region ? "places.positionRegion" : "places.position", { label: p.at.label }),
              h("a", { href: `https://www.wikidata.org/wiki/${p.at.qid}`, target: "_blank", rel: "noopener" }, `Wikidata ${p.at.qid} ↗`))
          : h("div", { class: "note", style: "margin-top:10px" }, t("places.unplacedNote")),
        h("div", { style: "margin-top:10px" }, C.reportLink({ kind: "places", reference: p.en, source: t("places.reportSource") }))),
      p.at ? h("div", {}, drawMap({ focus: p.id })) : null),
    h("div", { class: "section-h", style: "margin-top:26px" },
      h("div", {}, h("h2", {}, t("places.ayahsTitle")), h("p", {}, t("places.ayahsLead")))),
    groupsBox);

  const bySurah = {};
  for (const m of p.mentions) {
    const s = +m.k.split(":")[0];
    ((bySurah[s] ||= {})[m.k] ||= []).push(m.w);
  }
  const surahs = Object.keys(bySurah).map(Number).sort((a, b) => a - b);
  const groups = await Promise.all(surahs.map(async s => {
    const c = byN[s];
    const [sd, ip, ...trTexts] = await Promise.all([C.surah(s), C.scriptText(s), ...trs.map(tr => C.tr(tr.id, s))]);
    const keys = Object.keys(bySurah[s]).sort((a, b) => +a.split(":")[1] - +b.split(":")[1]);
    return h("section", { class: "card p-group" },
      h("div", { class: "p-group-h" },
        h("a", { href: `surah.html?n=${s}`, class: "p-sname" }, `${s}. ${c.name}`, h("span", { class: "s-ar-inline", translate: "no" }, c.ar)),
        h("span", { class: `chip ${c.place}` }, h("span", { class: "dot" }), C.placeName(c.place))),
      ...keys.map(k => {
        const idx = +k.split(":")[1] - 1;
        const a = sd.ayahs[idx];
        const marks = new Set(bySurah[s][k]);
        const words = a.w.map((w, i) => h("span", { class: `pw${marks.has(i + 1) ? " name" : ""}` }, ip ? ip.ayahs[idx][i] : w.u));
        return h("div", { class: "p-ayah" },
          h("div", { class: "p-ayah-h" }, h("span", { class: "ayah-key" }, k),
            h("span", { class: "row-between" },
              C.reportLink({ kind: "places", reference: t("report.mentionRef", { key: k, name: p.en }), source: t("places.reportSource") }),
              h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, t("common.readInContext")))),
          h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, ...words.flatMap((w, i) => i ? [" ", w] : [w])),
          ...trs.map((tr, ti) => h("div", { class: `tr-item ${tr.lang === "ur" ? "ur" : ""}` },
            h("div", { class: `txt ${tr.lang === "ur" ? "urdu" : ""}`, dir: tr.lang === "ur" ? "rtl" : "ltr" }, trTexts[ti][idx]),
            h("div", { class: "who" }, `— ${tr.name}`))));
      }));
  }));
  groupsBox.append(...groups);
}

const pid = params.get("p");
if (pid && byId[pid]) renderPlace(byId[pid]); else renderIndex();
