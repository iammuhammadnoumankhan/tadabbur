// Mushaf page view: read page by page, line by line, like a printed Quran.
// Layouts: data/layout/madani (604 pages, Quran.com) and data/layout/indopak (610 pages, DigitalKhatt).
// Only positions come from the layout; the words are our existing text in the chosen script.
import * as C from "./common.js";
const { h, $, t } = C;

C.header("mushaf");
C.footer();

const params = new URLSearchParams(location.search);
const st = C.get();
let mushaf = params.get("m") === "indopak" || params.get("m") === "madani" ? params.get("m")
  : (st.script === "indopak" ? "indopak" : "madani");
const chs = await C.chapters();
let IX = await C.layoutIndex(mushaf);
const main = $("#main");

function startPage() {
  const k = params.get("k"), s = +params.get("s"), p = +params.get("p");
  if (k) { const [ks, ka] = k.split(":").map(Number); return IX.ayah[ks]?.[ka - 1] || 1; }
  if (s) return IX.surah[s] || 1;
  return p >= 1 && p <= IX.pages ? p : 1;
}
let page = startPage();

// ------------------------------------------------------------------ text for one word reference
const cache = {};
async function surahText(s) {
  if (!cache[s]) {
    cache[s] = Promise.all([
      C.surah(s),
      mushaf === "indopak" ? C.indopak(s) : Promise.resolve(null),
      mushaf === "madani" && C.get().script === "tajweed" ? C.tajweed(s).catch(() => null) : Promise.resolve(null),
    ]).then(([sd, ip, tj]) => ({ sd, ip, tj }));
  }
  return cache[s];
}
function wordEl(ref, T) {
  const [s, a, w] = ref.split(":");
  const ai = +a - 1;
  if (w === "e") {
    return mushaf === "indopak"
      ? h("span", { class: "m-end ar-indopak" }, `۝${C.toArabicDigits(a)}`)
      : h("span", { class: "m-end ar-uthmani" }, `﴿${C.toArabicDigits(a)}﴾`);
  }
  const wi = +w - 1;
  const word = T.sd.ayahs[ai].w[wi];
  const attrs = { class: "m-w", "data-ref": ref, tabindex: "0", role: "button", "aria-label": `${word.tl}: ${word.en}` };
  if (T.ip) return h("span", { ...attrs, class: "m-w ar-indopak" }, T.ip.ayahs[ai][wi]);
  if (T.tj) return h("span", { ...attrs, class: "m-w ar-uthmani tajweed", html: T.tj.ayahs[ai][wi] });
  return h("span", { ...attrs, class: "m-w ar-uthmani" }, word.u);
}

// ------------------------------------------------------------------ render one page
let token = 0;
async function render(p) {
  const my = ++token;
  page = Math.min(IX.pages, Math.max(1, p));
  const lay = await C.layoutPage(mushaf, page);
  const surahs = [...new Set(lay.lines.flatMap(l => l.t === "s" ? [l.s] : (l.w || []).map(r => +r.split(":")[0])))];
  const texts = Object.fromEntries(await Promise.all(surahs.map(async s => [s, await surahText(s)])));
  const bism = await bismillahText();
  if (my !== token) return;

  const firstRef = lay.lines.find(l => l.t === "w")?.w[0];
  const [fs, fa] = firstRef ? firstRef.split(":").map(Number) : [surahs[0], 1];
  const juz = texts[fs]?.sd.ayahs[fa - 1]?.juz;
  const short = lay.lines.filter(l => l.t !== "x").length < 12;

  const sheet = h("div", { class: `m-page ${mushaf}${short ? " short" : ""}`, lang: "ar", dir: "rtl", translate: "no" },
    ...lay.lines.map(l => {
      if (l.t === "x") return h("div", { class: "m-line m-blank" });
      if (l.t === "s") return h("div", { class: "m-line m-surah" },
        h("span", { class: "m-surah-name" }, `${t("page.surahWord")} ${chs[l.s - 1].ar}`),
        h("span", { class: "m-surah-en", dir: "ltr" }, `${l.s}. ${chs[l.s - 1].name}`));
      if (l.t === "b") return h("div", { class: `m-line m-bism ${mushaf === "indopak" ? "ar-indopak" : "ar-uthmani"}` }, bism);
      return h("div", { class: "m-line" }, ...l.w.map(r => wordEl(r, texts[+r.split(":")[0]])));
    }));

  main.innerHTML = "";
  main.append(
    h("div", { class: "m-bar card" },
      h("button", { class: "btn", onclick: () => go(page + 1), "aria-label": t("page.next") }, "‹ ", t("page.nextShort")),
      h("div", { class: "m-info" },
        h("b", {}, surahs.map(s => chs[s - 1].name).join(" · ")),
        h("span", { class: "tiny" }, t("page.info", { page, pages: IX.pages, juz: juz ?? "–" }))),
      h("button", { class: "btn", onclick: () => go(page - 1), "aria-label": t("page.prev") }, t("page.prevShort"), " ›")),
    h("div", { class: "m-tools" },
      h("div", { class: "seg" }, ...[["madani", "page.madani"], ["indopak", "page.indopak"]].map(([v, k]) =>
        h("button", { class: v === mushaf ? "on" : null, onclick: () => switchMushaf(v) }, t(k)))),
      surahSelect(fs),
      h("label", { class: "tiny m-goto" }, t("page.goto"), " ",
        h("input", { type: "number", min: 1, max: IX.pages, value: page, "aria-label": t("page.goto"),
          onchange: e => go(+e.target.value) })),
      firstRef ? h("a", { class: "btn", href: `surah.html?n=${fs}#${fs}:${fa}` }, t("page.openReader")) : null),
    sheet,
    h("div", { class: "source", style: "margin:12px 0 40px" }, t(mushaf === "indopak" ? "page.srcIndopak" : "page.srcMadani"),
      " ", h("a", { href: "sources.html" }, t("nav.sources"))));
  document.title = t("page.title", { page, name: surahs.map(s => chs[s - 1].name).join(" · ") });
  history.replaceState(null, "", `?m=${mushaf}&p=${page}`);
  await document.fonts.ready;
  fitLines(sheet);
  prefetch(page + 1); prefetch(page - 1);
}

// shrink any line that is wider than the page, so every printed line stays one line
function fitLines(sheet) {
  for (const line of sheet.querySelectorAll(".m-line:not(.m-surah):not(.m-blank)")) {
    line.style.fontSize = "";
    const over = line.scrollWidth / line.clientWidth;
    if (over > 1.001) line.style.fontSize = `${100 / over * 0.98}%`;
  }
}
function prefetch(p) { if (p >= 1 && p <= IX.pages) C.layoutPage(mushaf, p).catch(() => {}); }
let bismCache = {};
async function bismillahText() {
  if (bismCache[mushaf]) return bismCache[mushaf];
  bismCache[mushaf] = mushaf === "indopak" ? (await C.indopak(1)).ayahs[0].join(" ") : (await C.surah(1)).ayahs[0].u;
  return bismCache[mushaf];
}
function surahSelect(current) {
  return h("select", { class: "tafsir-select m-surah-select", "aria-label": t("page.surah"), onchange: e => go(IX.surah[+e.target.value]) },
    ...chs.map(c => h("option", { value: c.n, selected: c.n === current }, `${c.n}. ${c.name}`)));
}
async function switchMushaf(m) {
  if (m === mushaf) return;
  const firstRef = (await C.layoutPage(mushaf, page)).lines.find(l => l.t === "w")?.w[0] || "1:1:1";
  const [s, a] = firstRef.split(":").map(Number);
  mushaf = m;
  for (const k in cache) delete cache[k];
  IX = await C.layoutIndex(mushaf);
  render(IX.ayah[s][a - 1]);
}
const go = p => { if (p >= 1 && p <= IX.pages && p !== page) render(p); };

// ------------------------------------------------------------------ word meaning on tap
const tipBox = h("div", { class: "pop card m-tip", role: "dialog" });
document.body.append(tipBox);
document.addEventListener("click", async e => {
  const w = e.target.closest(".m-w");
  if (!w) { if (!e.target.closest(".m-tip")) tipBox.classList.remove("show"); return; }
  const [s, a, wi] = w.dataset.ref.split(":").map(Number);
  const word = (await surahText(s)).sd.ayahs[a - 1].w[wi - 1];
  tipBox.innerHTML = "";
  tipBox.append(
    h("div", { class: "urdu", lang: "ur", style: "font-size:18px" }, word.ur || ""),
    h("div", {}, word.en || ""),
    h("div", { class: "row-between", style: "margin-top:6px" },
      h("span", { class: "tiny" }, `${s}:${a}`),
      h("a", { class: "tiny", href: `surah.html?n=${s}#${s}:${a}` }, t("common.readInContext"))));
  tipBox.classList.add("show");
  const r = w.getBoundingClientRect();
  tipBox.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - tipBox.offsetWidth / 2, innerWidth - tipBox.offsetWidth - 8))}px`;
  tipBox.style.top = `${r.bottom + 6 + tipBox.offsetHeight > innerHeight ? r.top - tipBox.offsetHeight - 6 : r.bottom + 6}px`;
});
addEventListener("scroll", () => tipBox.classList.remove("show"), { passive: true });

// ------------------------------------------------------------------ turning pages: keys + swipe
// Like a printed Arabic mushaf: the next page is to the left.
document.addEventListener("keydown", e => {
  if (e.target.closest?.("input, select")) return;
  if (e.key === "ArrowLeft") go(page + 1);
  if (e.key === "ArrowRight") go(page - 1);
});
let sx = null, sy = null;
addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
addEventListener("touchend", e => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? page + 1 : page - 1);
  sx = null;
}, { passive: true });
addEventListener("resize", () => { const s = $(".m-page"); if (s) fitLines(s); });

render(page);
