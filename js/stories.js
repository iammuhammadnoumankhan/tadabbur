import * as C from "./common.js";
const { h, $, $$, t } = C;

C.header("stories");
C.footer();

const [D, chs, FAM] = await Promise.all([C.stories(), C.chapters(), C.family().catch(() => null)]);
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

// Ontology links + links an ayah or Sahih hadith states (each with its evidence)
const TREE_RELS = new Set(["son-of", "daughter-of", "adopted-son-of"]);
const EV = FAM?.evidenced || [];
const LINKS = FAM ? [...FAM.links, ...EV.filter(e => TREE_RELS.has(e.rel)).map(e => [e.rel, e.a, e.b])] : [];
const EV_KEYS = new Set(EV.map(e => `${e.a}|${e.b}`));
const list = ids => ids.flatMap((c, i) => [i ? ", " : "", personLink(c)]);

const link = id => byId[id] ? h("a", { href: `stories.html?p=${id}` }, nameOf(id)) : h("span", {}, nameOf(id));
function relations(p) {
  if (!FAM) return [];
  const out = [];
  for (const [rel, child, parent] of LINKS) {
    if (child === p.id) out.push(h("span", {}, t(`family.${rel}`), personLink(parent)));
  }
  const kids = LINKS.filter(([rel, , parent]) => parent === p.id && rel !== "adopted-son-of").map(([, c]) => c);
  if (kids.length) out.push(h("span", {}, t("family.children"), ...list(kids)));
  const brothers = EV.filter(e => e.rel === "brother-of" && (e.a === p.id || e.b === p.id)).map(e => e.a === p.id ? e.b : e.a);
  if (brothers.length) out.push(h("span", {}, t("family.brother"), ...list(brothers)));
  const uncles = EV.filter(e => e.rel === "uncle-of" && e.b === p.id).map(e => e.a);
  if (uncles.length) out.push(h("span", {}, t("family.uncles"), ...list(uncles)));
  for (const e of EV.filter(e => e.rel === "descendant-of" && e.a === p.id)) out.push(h("span", {}, t("family.descendant-of"), personLink(e.b)));
  const adopted = LINKS.filter(([rel, , parent]) => parent === p.id && rel === "adopted-son-of").map(([, c]) => c);
  if (adopted.length) out.push(h("span", {}, t("family.adoptedChild"), ...adopted.flatMap((c, i) => [i ? ", " : "", personLink(c)])));
  return out;
}
const personLink = id => byId[id] ? h("a", { href: `stories.html?p=${id}` }, nameOf(id)) : h("span", {}, FAM?.people[id]?.en || nameOf(id));

// ------------------------------------------------------------------ family tree (only the ontology's stated links)
function familyTree() {
  if (!FAM) return null;
  const parentOf = new Map(LINKS.map(([rel, c, p]) => [c, { p, rel }]));
  const childrenOf = new Map();
  for (const [rel, c, p] of LINKS) (childrenOf.get(p) || childrenOf.set(p, []).get(p)).push({ c, rel });
  const inTree = new Set(LINKS.flatMap(([, c, p]) => [c, p]));
  const roots = [...inTree].filter(id => !parentOf.has(id))
    .sort((a, b) => (childrenOf.get(b)?.length || 0) - (childrenOf.get(a)?.length || 0));
  const node = id => {
    const person = FAM.people[id];
    const inner = [h("span", { class: "ft-ar", lang: "ar" }, person.ar), h("span", { class: "ft-en" }, person.en)];
    return byId[id]
      ? h("a", { class: "ft-node prophet", href: `stories.html?p=${id}` }, ...inner)
      : h("span", { class: "ft-node" }, ...inner);
  };
  const branch = id => h("li", {}, node(id),
    childrenOf.has(id) ? h("ul", {}, ...childrenOf.get(id).map(({ c, rel }) => {
      const li = branch(c);
      if (rel !== "son-of") li.classList.add(`rel-${rel}`), li.prepend(h("span", { class: "ft-rel" }, t(`family.edge.${rel}`)));
      if (EV_KEYS.has(`${c}|${id}`)) li.classList.add("rel-ev");
      return li;
    })) : null);
  const alone = D.prophets.filter(p => !inTree.has(p.id));
  return h("section", { class: "ft-section" },
    h("div", { class: "section-h" }, h("div", {}, h("h2", {}, t("family.title")), h("p", {}, t("family.lead")))),
    h("div", { class: "ft-forest" }, ...roots.map(r => h("div", { class: "card ft-card" }, h("ul", { class: "ftree" }, branch(r))))),
    h("div", { class: "ft-legend" },
      h("span", { class: "ft-node prophet ft-mini" }, t("family.legendProphet")),
      h("span", { class: "ft-node ft-mini" }, t("family.legendOther")),
      EV.length ? h("span", { class: "ft-legend-ev" }, t("family.legendEvidence")) : null),
    alone.length ? h("div", { class: "jump-row" }, h("span", { class: "tiny" }, t("family.noLinks")),
      ...alone.map(p => h("a", { class: "chip", href: `stories.html?p=${p.id}` }, p.en))) : null,
    EV.length ? evidenceList() : null,
    h("div", { class: "source", style: "margin-top:12px" }, t("family.source"), " ",
      h("a", { href: "https://corpus.quran.com/concept.jsp?id=prophet", target: "_blank", rel: "noopener" }, "corpus.quran.com ↗")));
}

// Every link added beyond the ontology, with the ayahs / hadith that state it
function evidenceList() {
  const evLink = x => x.type === "ayah"
    ? h("a", { class: "chip", href: `surah.html?n=${x.key.split(":")[0]}#${x.key}`, title: x.quote }, x.key)
    : h("a", { class: "chip", href: x.url, target: "_blank", rel: "noopener", title: x.quote }, `${t(`collection.${x.c}`)} ${x.num} ↗`);
  return h("div", { class: "card ft-evidence" },
    h("h3", {}, t("family.evidenceTitle")),
    h("p", { class: "tiny" }, t("family.evidenceLead")),
    ...EV.map(e => h("div", { class: "ft-ev-row" },
      h("div", {}, personLink(e.a), ` ${t(`family.rel.${e.rel}`)} `, personLink(e.b)),
      h("div", { class: "ft-ev-src" }, ...e.evidence.map(evLink)),
      ...e.evidence.filter(x => x.type === "hadith").slice(0, 1).map(x =>
        h("div", { class: "ft-ev-quote", lang: "ar", dir: "rtl", translate: "no" }, `«${x.quote}»`)),
      C.reportLink({ kind: "prophets", reference: `${FAM.people[e.a].en} ${t(`family.rel.${e.rel}`)} ${FAM.people[e.b].en}`, source: e.evidence.map(x => x.key || `${t(`collection.${x.c}`)} ${x.num}`).join(", ") }))));
}
const counts = p => ({ ayahs: t("common.ayahs", { n: p.ayahs }), surahs: t("common.surahs", { n: p.surahs.length }) });

// ------------------------------------------------------------------ index
function renderIndex() {
  document.title = t("stories.pageTitle");
  main.innerHTML = "";
  main.append(
    h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
      h("h1", { html: t("stories.titleHtml") }),
      h("p", { class: "lead", style: "margin:0" }, t("stories.lead", { n: D.prophets.length }))),
    h("div", { class: "note", style: "margin:18px 0 0" }, t("stories.note"), h("a", { href: "sources.html" }, t("stories.noteLink"))),
    h("div", { class: "p-grid" }, ...D.prophets.map(p =>
      h("a", { class: "card p-card", href: `stories.html?p=${p.id}` },
        h("div", { class: "p-ar", translate: "no" }, p.ar),
        h("div", { class: "p-en" }, p.en),
        h("div", { class: "p-meta" }, t("stories.cardMeta", counts(p))),
        quranStrip(p.surahs)))),
    familyTree());
}

// ------------------------------------------------------------------ one prophet
async function renderProphet(p) {
  document.title = t("stories.prophetTitle", { name: p.en });
  let order = params.get("order") === "revelation" ? "revelation" : "mushaf";
  const st = C.get();
  const trs = await C.selectedTranslations();
  const rels = relations(p);
  const aliases = p.names.filter(n => n.id !== p.id);

  main.innerHTML = "";
  const groupsBox = h("div", { class: "p-groups" });
  const orders = ["mushaf", "revelation"];
  const orderSeg = h("div", { class: "seg" }, ...orders.map(v =>
    h("button", { class: v === order ? "on" : null, onclick: () => {
      order = v;
      history.replaceState(null, "", `?p=${p.id}&order=${v}`);
      $$("button", orderSeg).forEach((b, i) => b.classList.toggle("on", orders[i] === order));
      renderGroups();
    } }, t(v === "mushaf" ? "home.orderMushaf" : "home.orderRevelation"))));

  main.append(
    h("nav", { style: "margin:24px 0 0" }, h("a", { href: "stories.html" }, t("stories.back"))),
    h("section", { class: "card p-head" },
      h("div", {},
        h("div", { class: "p-ar big", translate: "no" }, p.ar),
        h("h1", {}, p.en),
        aliases.length ? h("div", { class: "muted" }, t("stories.alsoCalled"),
          ...aliases.map((n, i) => [i ? ", " : "", h("b", {}, n.en), ` (${n.ar})`])) : null,
        rels.length ? h("div", { class: "muted" }, ...rels.map((r, i) => [i ? " · " : "", r])) : null,
        h("div", { class: "p-meta", style: "margin-top:8px" },
          p.cats.map(c => t(`stories.cat.${c}`)).join(" & "), t("stories.referredIn", counts(p)))),
      h("div", {},
        h("div", { class: "tiny", style: "margin-bottom:6px" }, t("stories.whereLabel")),
        quranStrip(p.surahs),
        h("div", { class: "row-between", style: "margin-top:10px" },
          h("div", { class: "source" }, t("stories.source"),
            h("a", { href: p.url, target: "_blank", rel: "noopener" }, t("stories.viewConcept"))),
          C.reportLink({ kind: "prophets", reference: p.en, source: t("report.prophetsSource") })))),
    h("div", { class: "section-h", style: "margin-top:26px" },
      h("div", {}, h("h2", {}, t("stories.ayahsTitle")), h("p", {}, t("stories.ayahsLead"))),
      orderSeg),
    groupsBox);

  const bySurah = {};
  for (const m of p.mentions) {
    const s = +m.k.split(":")[0];
    ((bySurah[s] ||= {})[m.k] ||= []).push(m.w);
  }

  async function group(s) {
    const c = byN[s];
    const [sd, ip, ...trTexts] = await Promise.all([C.surah(s), C.scriptText(s), ...trs.map(tr => C.tr(tr.id, s))]);
    const keys = Object.keys(bySurah[s]).sort((a, b) => +a.split(":")[1] - +b.split(":")[1]);
    return h("section", { class: "card p-group" },
      h("div", { class: "p-group-h" },
        h("a", { href: `surah.html?n=${s}`, class: "p-sname" }, `${s}. ${c.name}`, h("span", { class: "s-ar-inline", translate: "no" }, c.ar)),
        h("span", { class: `chip ${c.place}` }, h("span", { class: "dot" }), C.placeName(c.place)),
        h("span", { class: "chip" }, t("common.revealedNum", { n: c.order })),
        h("span", { class: "tiny" }, t("common.ayahs", { n: keys.length }))),
      ...keys.map(k => {
        const idx = +k.split(":")[1] - 1;
        const a = sd.ayahs[idx];
        const marks = new Set(bySurah[s][k]);
        const words = a.w.map((w, i) => h("span", { class: `pw${marks.has(i + 1) ? " name" : ""}` }, ip ? ip.ayahs[idx][i] : w.u));
        return h("div", { class: "p-ayah" },
          h("div", { class: "p-ayah-h" }, h("span", { class: "ayah-key" }, k),
            h("span", { class: "row-between" },
              C.reportLink({ kind: "prophets", reference: t("report.mentionRef", { key: k, name: p.en }), source: t("report.prophetsSource") }),
              h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, t("common.readInContext")))),
          h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, ...words.flatMap((w, i) => i ? [" ", w] : [w])),
          ...trs.map((tr, ti) => h("div", { class: `tr-item ${tr.lang === "ur" ? "ur" : ""}` },
            h("div", { class: `txt ${tr.lang === "ur" ? "urdu" : ""}`, dir: tr.lang === "ur" ? "rtl" : "ltr" }, trTexts[ti][idx]),
            h("div", { class: "who" }, `— ${tr.name}`))));
      }));
  }

  let token = 0;
  async function renderGroups() {
    const my = ++token;
    groupsBox.innerHTML = "";
    const surahs = Object.keys(bySurah).map(Number).sort((a, b) => order === "revelation" ? byN[a].order - byN[b].order : a - b);
    const slots = surahs.map(() => groupsBox.appendChild(h("div", { class: "skeleton" }, t("common.loading"))));
    for (let i = 0; i < surahs.length; i += 4) {        // load in order, a few at a time
      const batch = await Promise.all(surahs.slice(i, i + 4).map(group));
      if (my !== token) return;
      batch.forEach((el, j) => slots[i + j].replaceWith(el));
    }
  }
  renderGroups();
}

const pid = params.get("p");
if (pid && byId[pid]) renderProphet(byId[pid]); else renderIndex();
