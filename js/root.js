// Word roots: all roots (root.html) or every occurrence of one root (root.html?r=<id>).
// Roots, word forms and positions: Quranic Arabic Corpus. Word meanings + translations: Quran.com.
import * as C from "./common.js";
const { h, $, $$, t } = C;

C.header("roots");
C.footer();

const [IX, chs] = await Promise.all([C.rootsIndex(), C.chapters()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const main = $("#main");
const params = new URLSearchParams(location.search);
const sourceNote = () => h("div", { class: "source", style: "margin:16px 0 0" }, t("root.source"), " ",
  h("a", { href: "https://corpus.quran.com", target: "_blank", rel: "noopener" }, IX.notice));

// ------------------------------------------------------------------ all roots
function renderIndex() {
  document.title = t("root.indexTitle");
  const roots = [...IX.roots].sort((a, b) => b.n - a.n);
  const grid = h("div", { class: "r-grid" });
  const input = h("input", { type: "search", placeholder: t("root.filter"), "aria-label": t("root.filter"), dir: "auto", style: "width:100%;max-width:360px" });
  const norm = s => C.searchEngine.normText(s).replace(/\s+/g, "");
  function fill() {
    const q = norm(input.value);
    grid.innerHTML = "";
    for (const r of roots) {
      if (q && !norm(r.r).includes(q) && !r.l.some(([l]) => norm(l).includes(q))) continue;
      grid.append(h("a", { class: "card r-card", href: `root.html?r=${r.id}` },
        h("span", { class: "root-letters", lang: "ar" }, C.spacedRoot(r.r)),
        r.l[0] ? h("span", { class: "lemma", lang: "ar" }, r.l[0][0]) : null,
        h("span", { class: "tiny" }, t("root.times", { n: r.n }))));
    }
  }
  input.addEventListener("input", fill);
  main.innerHTML = "";
  main.append(
    h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
      h("h1", { html: t("root.indexHtml") }),
      h("p", { class: "lead", style: "margin:0" }, t("root.indexLead", { n: IX.roots.length.toLocaleString() }))),
    h("div", { style: "margin-top:18px" }, input), sourceNote(), grid);
  fill();
}

// ------------------------------------------------------------------ one root
async function renderRoot(r) {
  document.title = t("root.pageTitle", { root: r.r });
  const occ = await C.rootOccurrences(r.id);          // ["s:a:w", …]
  const st = C.get();
  const trs = (await C.selectedTranslations()).slice(0, 1);
  let lemmaFilter = params.get("l") || "";
  let shown = 0;
  const PAGE = 30;
  const list = h("div", { class: "r-occ" });
  const status = h("div", { class: "tiny" });

  // which lemma each occurrence is (from the per-surah grammar files)
  const morphs = {};
  async function lemmaOf(key) {
    const [s, a, w] = key.split(":").map(Number);
    morphs[s] ||= C.morph(s);
    return (await morphs[s]).ayahs[a - 1][w - 1]?.[1] || "";
  }
  let filtered = occ;
  async function applyFilter() {
    if (!lemmaFilter) { filtered = occ; return; }
    const lem = await Promise.all(occ.map(lemmaOf));
    filtered = occ.filter((_, i) => lem[i] === lemmaFilter);
  }

  const chips = h("div", { class: "r-lemmas" },
    h("button", { class: `chip${lemmaFilter ? "" : " on"}`, onclick: () => setFilter("") }, t("root.allForms")),
    ...r.l.map(([l, n]) => h("button", { class: `chip${l === lemmaFilter ? " on" : ""}`, "data-l": l, onclick: () => setFilter(l) },
      h("span", { class: "lemma", lang: "ar" }, l), ` ${n}`)));
  async function setFilter(l) {
    lemmaFilter = l;
    $$(".chip", chips).forEach(c => c.classList.toggle("on", (c.dataset.l || "") === l));
    history.replaceState(null, "", `?r=${r.id}${l ? `&l=${encodeURIComponent(l)}` : ""}`);
    list.innerHTML = ""; shown = 0;
    status.textContent = t("common.loading");
    await applyFilter();
    status.textContent = "";
    more();
  }

  async function card(key) {
    const [s, a, w] = key.split(":").map(Number);
    const [sd, ip, ...trTexts] = await Promise.all([C.surah(s), C.scriptText(s), ...trs.map(tr => C.tr(tr.id, s))]);
    const ay = sd.ayahs[a - 1], word = ay.w[w - 1];
    const words = ay.w.map((x, i) => h("span", { class: `pw${i === w - 1 ? " name" : ""}` }, ip ? ip.ayahs[a - 1][i] : x.u));
    const k = `${s}:${a}`;
    return h("article", { class: "card result" },
      h("div", { class: "p-ayah-h" },
        h("a", { href: `surah.html?n=${s}#${k}`, class: "result-ref" }, h("span", { class: "ayah-key" }, k), ` ${byN[s].name}`),
        h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, t("common.readInContext"))),
      h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, ...words.flatMap((x, i) => i ? [" ", x] : [x])),
      h("div", { class: "r-meaning" }, t("root.wordMeaning"),
        h("b", { lang: "ar", class: `ar-${st.script}` }, ip ? ip.ayahs[a - 1][w - 1] : word.u), " — ",
        h("span", { class: "urdu", lang: "ur" }, word.ur || ""), " · ", word.en || ""),
      ...trs.map((tr, i) => h("div", { class: `tr-item ${tr.lang === "ur" ? "ur" : ""}` },
        h("div", { class: `txt ${tr.lang === "ur" ? "urdu" : ""}`, dir: tr.lang === "ur" ? "rtl" : "ltr" }, trTexts[i][a - 1]),
        h("div", { class: "who" }, `— ${tr.name}`))));
  }
  async function more() {
    const slice = filtered.slice(shown, shown + PAGE);
    shown += slice.length;
    list.querySelector(".more")?.remove();
    (await Promise.all(slice.map(card))).forEach(c => list.append(c));
    if (shown < filtered.length)
      list.append(h("button", { class: "btn more", style: "margin:6px auto 0;display:flex", onclick: more },
        t("common.showMore", { n: filtered.length - shown })));
  }

  main.innerHTML = "";
  main.append(
    h("nav", { style: "margin:24px 0 0" }, h("a", { href: "root.html" }, t("root.back"))),
    h("section", { class: "card r-head" },
      h("div", { class: "root-letters", lang: "ar" }, C.spacedRoot(r.r)),
      h("p", { class: "lead", style: "margin:6px 0 0" }, t("root.lead", { n: r.n, forms: t("root.forms", { n: r.l.length }) })),
      chips,
      h("div", { class: "row-between", style: "margin-top:14px" },
        h("a", { href: C.corpusRootUrl(r.b), target: "_blank", rel: "noopener", class: "tiny" }, t("root.corpusLink")),
        C.reportLink({ kind: "word", reference: `${t("morph.root")} ${r.r}`, source: "Quranic Arabic Corpus morphology" })),
      sourceNote()),
    h("div", { class: "section-h", style: "margin-top:26px" }, h("div", {}, h("h2", {}, t("root.occurrences")), status)),
    list);
  await applyFilter();
  more();
}

const rid = params.get("r");
const root = rid != null ? IX.roots.find(x => String(x.id) === rid) : null;
if (root) renderRoot(root); else renderIndex();
