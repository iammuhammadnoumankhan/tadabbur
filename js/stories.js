import * as C from "./common.js";
const { h, $, $$ } = C;

C.header("stories");
C.footer();

const [D, chs, src] = await Promise.all([C.getJSON("data/stories.json"), C.chapters(), C.sources()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const byId = Object.fromEntries(D.prophets.map(p => [p.id, p]));
const nameOf = id => byId[id]?.en || D.names[id] || id;
const main = $("#main");
const params = new URLSearchParams(location.search);

// 114 tiny cells in mushaf order; lit where this prophet is referred to
function quranStrip(surahs) {
  const set = new Set(surahs);
  const el = h("div", { class: "qstrip", "aria-hidden": "true" });
  for (const c of chs) el.append(h("span", { class: set.has(c.n) ? `on ${c.place}` : "" }));
  return el;
}

function relationsText(p) {
  return p.relations.map(([rel, a, b]) => {
    if (rel !== "son-of") return null;
    if (a === p.id) return h("span", {}, "Son of ", link(b));
    if (b === p.id) return h("span", {}, "Father of ", link(a));
    return null;
  }).filter(Boolean);
}
const link = id => byId[id] ? h("a", { href: `stories.html?p=${id}` }, nameOf(id)) : h("span", {}, nameOf(id));

// ------------------------------------------------------------------ index
function renderIndex() {
  document.title = "Prophets in the Quran · Tadabbur";
  main.innerHTML = "";
  main.append(
    h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
      h("h1", {}, "Prophets in the ", h("em", {}, "Quran")),
      h("p", { class: "lead", style: "margin:0" },
        `The ${D.prophets.length} prophets and messengers named in the Quran, with every ayah that refers to them, gathered from across the surahs so you can read each one's story in the Quran's own words.`)),
    h("div", { class: "note", style: "margin:18px 0 0" },
      "Who is included and which ayahs refer to them come from the Quranic Arabic Corpus Ontology. Nothing is selected by us. ",
      h("a", { href: "sources.html" }, "Source details")),
    h("div", { class: "p-grid" }, ...D.prophets.map(p =>
      h("a", { class: "card p-card", href: `stories.html?p=${p.id}` },
        h("div", { class: "p-ar", translate: "no" }, p.ar),
        h("div", { class: "p-en" }, p.en),
        h("div", { class: "p-meta" }, `${p.ayahs} ayahs · ${p.surahs.length} surah${p.surahs.length > 1 ? "s" : ""}`),
        quranStrip(p.surahs)))));
}

// ------------------------------------------------------------------ one prophet
async function renderProphet(p) {
  document.title = `${p.en} in the Quran · Tadabbur`;
  let order = params.get("order") === "revelation" ? "revelation" : "mushaf";
  const st = C.get();
  const trs = await C.selectedTranslations();
  const rels = relationsText(p);
  const aliases = p.names.filter(n => n.id !== p.id);

  main.innerHTML = "";
  const groupsBox = h("div", { class: "p-groups" });
  const orderSeg = h("div", { class: "seg" }, ...[["mushaf", "Mushaf order"], ["revelation", "Revelation order"]].map(([v, l]) =>
    h("button", { class: v === order ? "on" : null, onclick: () => { order = v; history.replaceState(null, "", `?p=${p.id}&order=${v}`); renderGroups(); syncSeg(); } }, l)));
  const syncSeg = () => $$("button", orderSeg).forEach((b, i) => b.classList.toggle("on", ["mushaf", "revelation"][i] === order));

  main.append(
    h("nav", { style: "margin:24px 0 0" }, h("a", { href: "stories.html" }, "← All prophets")),
    h("section", { class: "card p-head" },
      h("div", {},
        h("div", { class: "p-ar big", translate: "no" }, p.ar),
        h("h1", {}, p.en),
        aliases.length ? h("div", { class: "muted" }, "Also referred to as ",
          ...aliases.map((n, i) => [i ? ", " : "", h("b", {}, n.en), ` (${n.ar})`])) : null,
        rels.length ? h("div", { class: "muted" }, ...rels.map((r, i) => [i ? " · " : "", r])) : null,
        h("div", { class: "p-meta", style: "margin-top:8px" },
          p.cats.map(c => c[0].toUpperCase() + c.slice(1)).join(" & "), ` · referred to in ${p.ayahs} ayahs across ${p.surahs.length} surahs`)),
      h("div", {},
        h("div", { class: "tiny", style: "margin-bottom:6px" }, "Where in the Quran (all 114 surahs, in mushaf order)"),
        quranStrip(p.surahs),
        h("div", { class: "source", style: "margin-top:10px" }, "Quranic Arabic Corpus Ontology · ",
          h("a", { href: p.url, target: "_blank", rel: "noopener" }, "view concept ↗")))),
    h("div", { class: "section-h", style: "margin-top:26px" },
      h("div", {}, h("h2", {}, "The ayahs"),
        h("p", {}, "Grouped by surah. Revelation order shows how the mentions unfolded over the 23 years. The highlighted word is the one the Corpus tags as referring to him. Tap “Read in context” for the full passage.")),
      orderSeg),
    groupsBox);

  const bySurah = {};
  for (const m of p.mentions) {
    const s = +m.k.split(":")[0];
    ((bySurah[s] ||= {})[m.k] ||= []).push(m.w);
  }

  async function group(s) {
    const c = byN[s];
    const [sd, ip, ...trTexts] = await Promise.all([C.surah(s), C.scriptText(s), ...trs.map(t => C.tr(t.id, s))]);
    const keys = Object.keys(bySurah[s]).sort((a, b) => +a.split(":")[1] - +b.split(":")[1]);
    return h("section", { class: "card p-group" },
      h("div", { class: "p-group-h" },
        h("a", { href: `surah.html?n=${s}`, class: "p-sname" }, `${s}. ${c.name}`, h("span", { class: "s-ar-inline", translate: "no" }, c.ar)),
        h("span", { class: `chip ${c.place}` }, h("span", { class: "dot" }), c.place === "makkah" ? "Makki" : "Madani"),
        h("span", { class: "chip" }, `Revealed #${c.order}`),
        h("span", { class: "tiny" }, `${keys.length} ayah${keys.length > 1 ? "s" : ""}`)),
      ...keys.map(k => {
        const idx = +k.split(":")[1] - 1;
        const a = sd.ayahs[idx];
        const marks = new Set(bySurah[s][k]);
        const words = a.w.map((w, i) => h("span", { class: `pw${marks.has(i + 1) ? " name" : ""}` },
          ip ? ip.ayahs[idx][i] : w.u));
        return h("div", { class: "p-ayah" },
          h("div", { class: "p-ayah-h" }, h("span", { class: "ayah-key" }, k),
            h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, "Read in context →")),
          h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, ...words.flatMap((w, i) => i ? [" ", w] : [w])),
          ...trs.map((t, ti) => h("div", { class: `tr-item ${t.lang === "ur" ? "ur" : ""}` },
            h("div", { class: `txt ${t.lang === "ur" ? "urdu" : ""}`, dir: t.lang === "ur" ? "rtl" : "ltr" }, trTexts[ti][idx]),
            h("div", { class: "who" }, `— ${t.name}`))));
      }));
  }

  let token = 0;
  async function renderGroups() {
    const my = ++token;
    groupsBox.innerHTML = "";
    const surahs = Object.keys(bySurah).map(Number).sort((a, b) => order === "revelation" ? byN[a].order - byN[b].order : a - b);
    const slots = surahs.map(() => groupsBox.appendChild(h("div", { class: "skeleton" }, "Loading…")));
    // load in order, a few at a time
    for (let i = 0; i < surahs.length; i += 4) {
      const batch = await Promise.all(surahs.slice(i, i + 4).map(group));
      if (my !== token) return;
      batch.forEach((el, j) => slots[i + j].replaceWith(el));
    }
  }
  renderGroups();
}

const pid = params.get("p");
if (pid && byId[pid]) renderProphet(byId[pid]); else renderIndex();
