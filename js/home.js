import * as C from "./common.js";
const { h, $, $$, t } = C;

C.header("surahs");
C.footer();
document.title = t("home.title");

// U7: first visit → the setup slides up over the page after it has settled (it never moves the page)
if (!C.get().onboarded) setTimeout(() => C.openSetup({ onSaved: () => location.reload() }), 900);

const chs = await C.chapters();
const src = await C.sources();

// ----- hero ayah: 38:29, shown from the data (Arabic + chosen translations)
(async () => {
  const st = C.get();
  const [s, trs, ip] = await Promise.all([C.surah(38), C.selectedTranslations(), C.scriptText(38)]);
  const a = s.ayahs[28];
  const box = $("#hero-ayah");
  box.innerHTML = "";
  box.append(h("div", { class: `arabic ar-${st.script}`, lang: "ar" }, ip ? ip.ayahs[28].join(" ") : a.u));
  for (const tr of trs.slice(0, 2)) {
    const texts = await C.tr(tr.id, 38);
    box.append(h("div", { class: `tr${tr.lang === "ur" ? " urdu" : ""}`, lang: tr.lang }, texts[28]));
  }
  box.append(h("div", { class: "ref" },
    h("a", { href: "surah.html?n=38#38:29" }, t("home.heroRef", { name: chs[37].name, key: "38:29" })),
    h("span", { class: "tiny" }, t("home.heroTranslation", { names: trs.slice(0, 2).map(x => x.name).join(" / ") }))));
})();

// ----- continue reading (saved on this device)
(() => {
  const l = C.progress.get().last;
  if (!l) return;
  const name = chs[+l.key.split(":")[0] - 1].name;
  const href = l.where === "mushaf" ? `page.html?m=${l.mushaf}&p=${l.page}` : `surah.html?n=${l.key.split(":")[0]}#${l.key}`;
  const k = C.progress.khatmStatus();
  $("#continue").append(h("div", { class: "card continue-card" },
    h("div", {}, h("div", { class: "tiny" }, t("progress.continueTitle")),
      h("b", {}, l.where === "mushaf"
        ? t("progress.continueMushaf", { name, page: l.page, mushaf: t(l.mushaf === "indopak" ? "page.indopak" : "page.madani") })
        : t("progress.continueAt", { name, key: l.key })),
      k ? h("div", { class: "tiny" }, `${t("progress.readOf", { read: k.read.toLocaleString(), total: C.progress.TOTAL.toLocaleString() })} · ${t("progress.today", { n: k.today })}`) : null),
    h("a", { class: "btn primary", href }, t("progress.continue"))));
})();

// ----- revelation journey
$("#journey-bars").append(C.journeyBars(chs));
$("#journey-src").textContent = t("home.journeySource", { publisher: src["qc-chapters"].publisher });

// ----- offline reading
$("#offline-panel").append(C.offlinePanel());

// ----- grid
let order = "mushaf", place = "all", q = "";

function card(c) {
  return h("a", { class: "card s-card", href: `surah.html?n=${c.n}` },
    h("div", { class: "s-num" }, h("span", {}, order === "revelation" ? c.order : c.n)),
    h("div", {},
      h("div", { class: "s-name" }, c.name),
      h("div", { class: "s-meta" },
        h("span", { class: `pl ${c.place}` }, C.placeName(c.place)),
        h("span", {}, t("common.ayahs", { n: c.ayahs })),
        h("span", {}, order === "revelation" ? t("common.surahNum", { n: c.n }) : t("common.revealedNum", { n: c.order })))),
    h("div", { class: "s-ar", translate: "no" }, c.ar,
      h("span", { class: "m" }, c.meaning.ur), h("span", { class: "tiny", style: "display:block;font-family:var(--font-ui)" }, c.meaning.en)));
}

function render() {
  const ql = q.trim().toLowerCase();
  let list = chs.filter(c => place === "all" || c.place === place)
    .filter(c => !ql || String(c.n) === ql || c.name.toLowerCase().includes(ql) || c.nameC.toLowerCase().includes(ql)
      || c.meaning.en.toLowerCase().includes(ql) || c.meaning.ur.includes(q.trim()) || c.ar.includes(q.trim()));
  list = [...list].sort((a, b) => order === "revelation" ? a.order - b.order : a.n - b.n);
  const g = $("#grid");
  g.innerHTML = "";
  list.forEach(c => g.append(card(c)));
  $("#surah-count").textContent = t("home.count", { shown: list.length, ayahs: list.reduce((s, c) => s + c.ayahs, 0).toLocaleString() })
    + (order === "revelation" ? t("home.sortedRevelation") : "");
}

function seg(id, fn) {
  $$(`#${id} button`).forEach(b => b.addEventListener("click", () => {
    $$(`#${id} button`).forEach(x => x.classList.toggle("on", x === b));
    fn(b.dataset.v); render();
  }));
}
seg("order-seg", v => order = v);
seg("place-seg", v => place = v);
$("#q").addEventListener("input", e => { q = e.target.value; render(); });
render();
