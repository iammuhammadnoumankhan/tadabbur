import * as C from "./common.js";
const { h, $, $$ } = C;

C.header("search");
C.footer();

const [chs, stories, trMeta] = await Promise.all([C.chapters(), C.getJSON("data/stories.json"), C.translations()]);
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
// global ayah index -> "s:a"
const KEYS = chs.flatMap(c => Array.from({ length: c.ayahs }, (_, i) => `${c.n}:${i + 1}`));
const IDX = Object.fromEntries(KEYS.map((k, i) => [k, i]));

// ------------------------------------------------------------------ normalisation (keeps a map back to the original text)
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ​-‏﻿]/;
const AR_MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ے": "ي", "ئ": "ي", "ك": "ك", "ک": "ك",
  "ة": "ه", "ۃ": "ه", "ہ": "ه", "ھ": "ه", "ؤ": "و", "ۓ": "ي", "ٰ": "" };
const isArabicScript = s => /[؀-ۿ]/.test(s);

function norm(s) {
  let out = "", map = [];
  const src = (s || "");
  for (let i = 0; i < src.length; i++) {
    let ch = src[i];
    if (AR_MARKS.test(ch)) continue;
    if (AR_MAP[ch] !== undefined) ch = AR_MAP[ch];
    else {
      const d = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      ch = d.toLowerCase().replace(/[’‘`]/g, "'");
    }
    for (const c of ch) { out += c; map.push(i); }
  }
  return { n: out, map };
}
const normText = s => norm(s).n;

// ------------------------------------------------------------------ data
const cache = {};
const load = id => (cache[id] ||= C.getJSON(id === "ar" ? "data/search/ar.json" : `data/search/tr-${id}.json`)
  .then(arr => arr.map(t => norm(t))));

let selected = await C.selectedTranslations();
let scope = "all";

function renderScope() {
  const box = $("#scope");
  box.innerHTML = "";
  const opts = [["all", "Everything"], ["ar", "Arabic"], ...selected.map(t => [String(t.id), t.name])];
  box.append(h("span", { class: "tiny" }, "Search in:"),
    h("div", { class: "seg wrap-seg" }, ...opts.map(([v, l]) =>
      h("button", { class: v === scope ? "on" : null, type: "button", onclick: () => { scope = v; renderScope(); run(); } }, l))),
    h("a", { class: "tiny", href: "#", onclick: e => { e.preventDefault(); pickTranslations(); } }, "Change translations"));
}
function pickTranslations() {
  // reuse the reader's choice; send people to a surah's translation picker would be clunky, so offer a simple list here
  const box = h("div", { class: "card", style: "padding:14px;margin:10px 0" },
    h("div", { class: "tiny", style: "margin-bottom:6px" }, "Translations to search (also used in the reader):"),
    ...trMeta.list.map(t => h("label", { class: "check" },
      h("input", { type: "checkbox", checked: selected.some(s => s.id === t.id), onchange: async e => {
        const cur = selected.map(s => s.id).filter(x => x !== t.id);
        if (e.target.checked) cur.push(t.id);
        C.set({ translations: cur.length ? cur : null });
        selected = await C.selectedTranslations();
        renderScope(); run();
      } }), t.name, h("span", { class: "tiny", style: "margin-left:6px" }, t.lang))));
  $("#scope").append(box);
}

// ------------------------------------------------------------------ query parsing
function parseRef(q) {
  let m = q.match(/^\s*(\d{1,3})\s*[:.\s]\s*(\d{1,3})\s*$/);
  if (m) return [+m[1], +m[2]];
  m = q.match(/^\s*(.+?)\s+(\d{1,3})\s*$/);          // "baqarah 255"
  if (m) {
    const c = matchSurahs(m[1])[0];
    if (c) return [c.n, +m[2]];
  }
  return null;
}
function matchSurahs(q) {
  const nq = normText(q).replace(/[-'\s]/g, "");
  if (nq.length < 2) return [];
  if (/^\d{1,3}$/.test(q.trim())) return chs.filter(c => c.n === +q.trim());
  return chs.filter(c => [c.name, c.nameC, c.meaning.en, c.meaning.ur, c.ar]
    .some(x => normText(x).replace(/[-'\s]/g, "").includes(nq)));
}
function matchProphets(q) {
  const nq = normText(q).trim();
  if (nq.length < 2) return [];
  return stories.prophets.filter(p => p.names.some(n => normText(n.en).startsWith(nq) || normText(n.ar).includes(nq)));
}

function findRanges(nobj, words) {
  const ranges = [];
  for (const w of words) {
    let from = 0, i;
    while ((i = nobj.n.indexOf(w, from)) !== -1) {
      ranges.push([nobj.map[i], nobj.map[i + w.length - 1] + 1]);
      from = i + w.length;
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}
function highlighted(text, ranges) {
  const frag = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s < at) continue;
    frag.push(text.slice(at, s), h("mark", {}, text.slice(s, e)));
    at = e;
  }
  frag.push(text.slice(at));
  return frag;
}

// ------------------------------------------------------------------ search
let token = 0, shown = 0, hits = [], words = [], raw = {};
const PAGE = 25;

async function run() {
  const q = $("#q").value.trim();
  const my = ++token;
  history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : location.pathname);
  const res = $("#results");
  res.innerHTML = "";
  if (!q) { res.append(examples()); return; }

  // direct jumps
  const ref = parseRef(q);
  if (ref && byN[ref[0]] && ref[1] >= 1 && ref[1] <= byN[ref[0]].ayahs) {
    const k = `${ref[0]}:${ref[1]}`;
    res.append(h("a", { class: "card jump", href: `surah.html?n=${ref[0]}#${k}` },
      h("span", { class: "ayah-key" }, k), ` Go to ${byN[ref[0]].name}, ayah ${ref[1]} →`));
  }
  const ss = matchSurahs(q), ps = matchProphets(q);
  if (ss.length || ps.length) {
    res.append(h("div", { class: "jump-row" },
      ...ss.slice(0, 8).map(c => h("a", { class: "chip", href: `surah.html?n=${c.n}` }, `Surah ${c.n}. ${c.name}`, h("span", { class: "s-ar-inline", translate: "no" }, c.ar))),
      ...ps.map(p => h("a", { class: "chip hadith-chip", href: `stories.html?p=${p.id}` }, `${p.en} in the Quran`, h("span", { class: "s-ar-inline", translate: "no" }, p.ar)))));
  }

  // text search: every word must appear (in any order)
  words = normText(q).split(/\s+/).filter(w => w.length >= 2 || isArabicScript(w));
  if (!words.length || ref) return;
  const hadJump = ss.length || ps.length;
  const arabicQ = isArabicScript(q);
  const fields = [];
  if ((scope === "all" || scope === "ar") && arabicQ) fields.push("ar");
  for (const t of selected) {
    if (scope !== "all" && scope !== String(t.id)) continue;
    const scriptMatch = (t.lang === "ur") === arabicQ;    // Urdu & Arabic queries search Urdu; Latin queries search English/Roman Urdu
    if (scriptMatch || scope === String(t.id)) fields.push(t.id);
  }
  const status = h("div", { class: "tiny", style: "margin:14px 0" }, "Searching…");
  res.append(status);
  const data = await Promise.all(fields.map(load));
  if (my !== token) return;
  raw = Object.fromEntries(await Promise.all(fields.map(async f =>
    [f, await C.getJSON(f === "ar" ? "data/search/ar.json" : `data/search/tr-${f}.json`)])));

  hits = [];
  for (let i = 0; i < KEYS.length; i++) {
    const m = {};
    fields.forEach((f, fi) => { const n = data[fi][i]; if (words.every(w => n.n.includes(w))) m[f] = findRanges(n, words); });
    if (Object.keys(m).length) hits.push([i, m]);
  }
  const total = hits.length;
  status.textContent = total
    ? `${total.toLocaleString()} ayah${total > 1 ? "s" : ""} found in ${new Set(hits.map(([i]) => KEYS[i].split(":")[0])).size} surahs · searched ${fields.map(f => f === "ar" ? "Arabic" : trMeta.list.find(t => t.id === f).name).join(", ")}`
    : hadJump ? "No ayahs contain this word in the selected translations."
    : `No ayahs found. Try another word or spelling${arabicQ ? "" : ", or search in Urdu/Arabic"}.`;
  const list = h("div", { class: "results" });
  res.append(list);
  shown = 0;
  await more(list, my);
}

async function more(list, my) {
  const st = C.get();
  const slice = hits.slice(shown, shown + PAGE);
  shown += slice.length;
  const cards = await Promise.all(slice.map(async ([i, m]) => {
    const k = KEYS[i];
    const [s, a] = k.split(":").map(Number);
    const [sd, ip] = await Promise.all([C.surah(s), C.scriptText(s)]);
    const arabic = ip ? ip.ayahs[a - 1].join(" ") : sd.ayahs[a - 1].u;
    const trLines = selected.filter(t => m[t.id]);
    const showTr = trLines.length ? trLines : selected.slice(0, 1);
    const trTexts = await Promise.all(showTr.map(t => m[t.id] ? raw[t.id][i] : C.tr(t.id, s).then(x => x[a - 1])));
    return h("article", { class: "card result" },
      h("div", { class: "p-ayah-h" },
        h("a", { href: `surah.html?n=${s}#${k}`, class: "result-ref" }, h("span", { class: "ayah-key" }, k), ` ${byN[s].name}`),
        h("a", { href: `surah.html?n=${s}#${k}`, class: "tiny" }, "Read in context →")),
      h("div", { class: `p-arabic ar-${st.script}`, lang: "ar", dir: "rtl", translate: "no" }, arabic),
      m.ar ? h("div", { class: "matched-ar-wrap" },
        h("div", { class: "tiny" }, "Matched in the Arabic (plain spelling):"),
        h("div", { class: "matched-ar", dir: "rtl", lang: "ar", translate: "no" }, ...highlighted(raw.ar[i], m.ar))) : null,
      ...showTr.map((t, ti) => h("div", { class: `tr-item ${t.lang === "ur" ? "ur" : ""}` },
        h("div", { class: `txt ${t.lang === "ur" ? "urdu" : ""}`, dir: t.lang === "ur" ? "rtl" : "ltr" },
          ...(m[t.id] ? highlighted(trTexts[ti], m[t.id]) : [trTexts[ti]])),
        h("div", { class: "who" }, `— ${t.name}`))));
  }));
  if (my !== token) return;
  list.querySelector(".more")?.remove();
  cards.forEach(c => list.append(c));
  if (shown < hits.length)
    list.append(h("button", { class: "btn more", style: "margin:6px auto 40px;display:flex", onclick: () => more(list, my) },
      `Show more (${(hits.length - shown).toLocaleString()} left)`));
}

function examples() {
  const ex = ["صبر", "patience", "رحمة", "جنت", "mercy", "2:255", "Baqarah 255", "Yusuf", "Kahf", "light"];
  return h("div", { class: "jump-row", style: "margin-top:16px" }, h("span", { class: "tiny" }, "Try:"),
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
