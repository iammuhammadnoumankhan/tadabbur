import * as C from "./common.js";
const { h, $, $$ } = C;

C.header("surahs");
C.footer();

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
  for (const t of trs.slice(0, 2)) {
    const texts = await C.tr(t.id, 38);
    box.append(h("div", { class: `tr${t.lang === "ur" ? " urdu" : ""}`, lang: t.lang }, texts[28]));
  }
  box.append(h("div", { class: "ref" },
    h("a", { href: "surah.html?n=38#38:29" }, "Surah Sad 38:29"),
    h("span", { class: "tiny" }, " · translation: ", trs.slice(0, 2).map(t => t.name).join(" / "))));
})();

// ----- revelation journey
$("#journey-bars").append(C.journeyBars(chs));
$("#journey-src").textContent = "Order & place: " + src["qc-chapters"].publisher + ". Scholars differ on the exact order, so treat it as approximate.";

// ----- grid
let order = "mushaf", place = "all", q = "";
const meaning = c => C.get().uiMeaning === "ur" ? c.meaning.ur : c.meaning.en;

function card(c) {
  return h("a", { class: "card s-card", href: `surah.html?n=${c.n}` },
    h("div", { class: "s-num" }, h("span", {}, order === "revelation" ? c.order : c.n)),
    h("div", {},
      h("div", { class: "s-name" }, c.name),
      h("div", { class: "s-meta" },
        h("span", { class: `pl ${c.place}` }, c.place === "makkah" ? "Makki" : "Madani"),
        h("span", {}, `${c.ayahs} ayahs`),
        h("span", {}, order === "revelation" ? `Surah ${c.n}` : `Revealed #${c.order}`))),
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
  $("#surah-count").textContent = `${list.length} of 114 surahs · ${list.reduce((s, c) => s + c.ayahs, 0).toLocaleString()} ayahs`
    + (order === "revelation" ? " · sorted by revelation order" : "");
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
