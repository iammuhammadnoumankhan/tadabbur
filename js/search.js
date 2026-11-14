// Search page: renders results from the DOM-free search engine in js/core/search.js.
import * as C from "./common.js";
const { h, $, t } = C;
const engine = C.searchEngine;

C.header("search");
C.footer();
document.title = t("search.pageTitle");

const [chs, trMeta] = await Promise.all([C.chapters(), C.translations()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
let selected = await C.selectedTranslations();
let scope = "all";

// ------------------------------------------------------------------ scope picker
function renderScope() {
  const box = $("#scope");
  box.innerHTML = "";
  const opts = [["all", t("search.everything")], ["ar", t("search.arabic")], ...selected.map(tr => [String(tr.id), tr.name])];
  box.append(h("span", { class: "tiny" }, t("search.searchIn")),
    h("div", { class: "seg wrap-seg" }, ...opts.map(([v, l]) =>
      h("button", { class: v === scope ? "on" : null, type: "button", onclick: () => { scope = v; renderScope(); run(); } }, l))),
    h("a", { class: "tiny", href: "#", onclick: e => { e.preventDefault(); pickTranslations(); } }, t("search.changeTr")));
}
function pickTranslations() {
  $("#scope").append(h("div", { class: "card", style: "padding:14px;margin:10px 0" },
    h("div", { class: "tiny", style: "margin-bottom:6px" }, t("search.trPick")),
    ...trMeta.list.map(tr => h("label", { class: "check" },
      h("input", { type: "checkbox", checked: selected.some(s => s.id === tr.id), onchange: async e => {
        const cur = selected.map(s => s.id).filter(x => x !== tr.id);
        if (e.target.checked) cur.push(tr.id);
        C.set({ translations: cur.length ? cur : null });
        selected = await C.selectedTranslations();
        renderScope(); run();
      } }), tr.name, h("span", { class: "tiny", style: "margin-left:6px" }, tr.lang)))));
}

function highlighted(text, ranges) {
  const out = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s < at) continue;
    out.push(text.slice(at, s), h("mark", {}, text.slice(s, e)));
    at = e;
  }
  out.push(text.slice(at));
  return out;
}

// ------------------------------------------------------------------ run a search
let token = 0, shown = 0, result = null, raw = {};
const PAGE = 25;

async function run() {
  const q = $("#q").value.trim();
  const my = ++token;
  history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : location.pathname);
  const res = $("#results");
  res.innerHTML = "";
  if (!q) { res.append(examples()); return; }

  const status = h("div", { class: "tiny", style: "margin:14px 0" }, t("search.searching"));
  res.append(status);
  result = await engine.search(q, { scope, translations: selected });
  if (my !== token) return;
  status.remove();

  if (result.ref) {
    const [s, a] = result.ref, k = `${s}:${a}`;
    res.append(h("a", { class: "card jump", href: `surah.html?n=${s}#${k}` },
      h("span", { class: "ayah-key" }, k), t("search.goTo", { name: byN[s].name, n: a })));
  }
  if (result.surahs.length || result.prophets.length) {
    res.append(h("div", { class: "jump-row" },
      ...result.surahs.slice(0, 8).map(c => h("a", { class: "chip", href: `surah.html?n=${c.n}` },
        `${t("common.surahNum", { n: c.n })}. ${c.name}`, h("span", { class: "s-ar-inline", translate: "no" }, c.ar))),
      ...result.prophets.map(p => h("a", { class: "chip hadith-chip", href: `stories.html?p=${p.id}` },
        t("search.prophetIn", { name: p.en }), h("span", { class: "s-ar-inline", translate: "no" }, p.ar)))));
  }
  if (result.ref || !result.fields.length) return;

  raw = Object.fromEntries(await Promise.all(result.fields.map(async f => [f, await C.searchText(f)])));
  if (my !== token) return;
  const total = result.hits.length;
  const fieldName = f => f === "ar" ? t("search.arabic") : trMeta.list.find(x => x.id === f).name;
  const surahCount = new Set(result.hits.map(x => x.key.split(":")[0])).size;
  res.append(h("div", { class: "tiny", style: "margin:14px 0" }, total
    ? t("search.found", { n: total.toLocaleString(), surahs: t("common.surahs", { n: surahCount }), fields: result.fields.map(fieldName).join(", ") })
    : result.surahs.length || result.prophets.length ? t("search.noneAfterJump")
    : t(engine.isArabicScript(q) ? "search.none" : "search.noneLatin")));
  const list = h("div", { class: "results" });
  res.append(list);
  shown = 0;
  await more(list, my);
}

async function more(list, my) {
  const st = C.get();
  const slice = result.hits.slice(shown, shown + PAGE);
  shown += slice.length;
  const cards = await Promise.all(slice.map(async ({ index, key, matches: m }) => {
    const [s, a] = C.splitKey(key);
    const [sd, ip] = await Promise.all([C.surah(s), C.scriptText(s)]);
    const arabic = ip ? ip.ayahs[a - 1].join(" ") : sd.ayahs[a - 1].u;
    const matched = selected.filter(tr => m[tr.id]);
    const showTr = matched.length ? matched : selected.slice(0, 1);
    const trTexts = await Promise.all(showTr.map(tr => m[tr.id] ? raw[tr.id][index] : C.tr(tr.id, s).then(x => x[a - 1])));
    return h("article", { class: "card result" },
      h("div", { class: "p-ayah-h" },
        h("a", { href: `surah.html?n=${s}#${key}`, class: "result-ref" }, h("span", { class: "ayah-key" }, key), ` ${byN[s].name}`),
        h("a", { href: `surah.html?n=${s}#${key}`, class: "tiny" }, t("common.readInContext"))),
      h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, arabic),
      m.ar ? h("div", { class: "matched-ar-wrap" },
        h("div", { class: "tiny" }, t("search.matchedAr")),
        h("div", { class: "matched-ar", dir: "rtl", lang: "ar", translate: "no" }, ...highlighted(raw.ar[index], m.ar))) : null,
      ...showTr.map((tr, ti) => h("div", { class: `tr-item ${tr.lang === "ur" ? "ur" : ""}` },
        h("div", { class: `txt ${tr.lang === "ur" ? "urdu" : ""}`, dir: tr.lang === "ur" ? "rtl" : "ltr" },
          ...(m[tr.id] ? highlighted(trTexts[ti], m[tr.id]) : [trTexts[ti]])),
        h("div", { class: "who" }, `— ${tr.name}`))));
  }));
  if (my !== token) return;
  list.querySelector(".more")?.remove();
  cards.forEach(c => list.append(c));
  if (shown < result.hits.length)
    list.append(h("button", { class: "btn more", style: "margin:6px auto 40px;display:flex", onclick: () => more(list, my) },
      t("common.showMore", { n: (result.hits.length - shown).toLocaleString() })));
}

function examples() {
  const ex = ["صبر", "patience", "رحمة", "جنت", "mercy", "2:255", "Baqarah 255", "Yusuf", "Kahf", "light"];
  return h("div", { class: "jump-row", style: "margin-top:16px" }, h("span", { class: "tiny" }, t("search.try")),
    ...ex.map(x => h("button", { class: "chip", type: "button", onclick: () => { $("#q").value = x; run(); } }, x)));
}

// ------------------------------------------------------------------ wiring
let deb;
$("#q").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(run, 300); });
$("#form").addEventListener("submit", e => { e.preventDefault(); clearTimeout(deb); run(); });
$("#q").value = new URLSearchParams(location.search).get("q") || "";
renderScope();
run();
$("#q").focus();
