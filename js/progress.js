// My reading: continue where you stopped, khatm progress, bookmarks, notes, backup.
// All data stays on this device (js/core/progress.js).
import * as C from "./common.js";
const { h, $, t } = C;
const P = C.progress;

C.header("progress");
C.footer();
document.title = t("progress.pageTitle");

const chs = await C.chapters();
const byN = Object.fromEntries(chs.map(c => [c.n, c]));
const OFFS = [];
chs.reduce((acc, c) => (OFFS[c.n] = acc, acc + c.ayahs), 0);
const main = $("#main");
const fmt = n => n.toLocaleString();
const keyLink = key => { const [s] = key.split(":"); return `surah.html?n=${s}#${key}`; };
const surahName = key => byN[+key.split(":")[0]].name;

// ------------------------------------------------------------------ continue reading
function continueCard() {
  const l = P.get().last;
  const box = h("section", { class: "card pr-card" }, h("h3", {}, t("progress.continueTitle")));
  if (!l) { box.append(h("p", { class: "muted", style: "margin:0" }, t("progress.nothingYet"))); return box; }
  const href = l.where === "mushaf" ? `page.html?m=${l.mushaf}&p=${l.page}` : keyLink(l.key);
  box.append(h("div", { class: "row-between" },
    h("div", { class: "lead", style: "margin:0" }, l.where === "mushaf"
      ? t("progress.continueMushaf", { name: surahName(l.key), page: l.page, mushaf: t(l.mushaf === "indopak" ? "page.indopak" : "page.madani") })
      : t("progress.continueAt", { name: surahName(l.key), key: l.key })),
    h("a", { class: "btn primary", href }, t("progress.continue"))));
  return box;
}

// ------------------------------------------------------------------ khatm
function khatmCard() {
  const box = h("section", { class: "card pr-card" }, h("h3", {}, t("progress.khatmTitle")));
  const st = P.khatmStatus();
  const done = P.get().done.length;
  if (!st) {
    box.append(h("p", { class: "muted", style: "margin:0 0 12px" }, t("progress.khatmLead")),
      h("div", { class: "controls" }, ...[7, 15, 30, 60].map(d =>
        h("button", { class: "btn", onclick: () => { P.startKhatm(d); render(); } }, `${t("progress.start")}: ${t("progress.days", { n: d })}`)),
        h("button", { class: "btn", onclick: () => { const d = +prompt(t("progress.customAsk"), "40"); if (d > 0) { P.startKhatm(d); render(); } } }, t("progress.custom"))),
      done ? h("p", { class: "tiny", style: "margin:12px 0 0" }, t("progress.completed", { n: done })) : null);
    return box;
  }
  const dayNo = st.days - st.daysLeft + 1;
  box.append(
    h("div", { class: "pr-big" }, `${Math.floor(st.pct * 10) / 10}%`),
    h("div", { class: "muted" }, t("progress.readOf", { read: fmt(st.read), total: fmt(P.TOTAL) })),
    h("div", { class: "progress show big" }, h("span", { style: `width:${st.pct}%` })),
    h("div", { class: "pr-stats" },
      h("span", { class: "chip dated" }, t("progress.today", { n: st.today })),
      h("span", { class: "chip" }, t("progress.target", { n: st.perDay })),
      h("span", { class: "chip" }, `${dayNo} / ${st.days}`),
      h("span", { class: "chip" }, t("progress.daysLeft", { n: st.daysLeft })),
      P.streak() ? h("span", { class: "chip hadith-chip" }, t("progress.streak", { n: P.streak() })) : null),
    surahMap(st.set),
    h("p", { class: "tiny", style: "margin:6px 0 12px" }, t("progress.surahMap")),
    h("div", { class: "controls" },
      h("label", { class: "tiny" }, t("progress.changeGoal"), " ",
        h("select", { class: "tafsir-select", style: "width:auto", onchange: e => { P.setKhatmDays(+e.target.value); render(); } },
          ...[...new Set([7, 15, 30, 40, 60, 90, st.days])].sort((a, b) => a - b).map(d =>
            h("option", { value: d, selected: d === st.days }, t("progress.days", { n: d }))))),
      h("button", { class: "btn", onclick: () => { if (confirm(t("progress.stopConfirm"))) { P.stopKhatm(); render(); } } }, t("progress.stop"))),
    done ? h("p", { class: "tiny", style: "margin:12px 0 0" }, t("progress.completed", { n: done })) : null);
  return box;
}
function surahMap(set) {
  const grid = h("div", { class: "pr-map", "aria-hidden": "true" });
  for (const c of chs) {
    let n = 0;
    for (let i = 0; i < c.ayahs; i++) if (set.has(OFFS[c.n] + i)) n++;
    const f = n / c.ayahs;
    grid.append(h("a", { href: `surah.html?n=${c.n}`, title: `${c.n}. ${c.name}: ${n}/${c.ayahs}`,
      style: `--f:${f}`, class: f >= 1 ? "full" : "" }));
  }
  return grid;
}

// ------------------------------------------------------------------ bookmarks + notes
async function snippet(key) {
  const [s, a] = key.split(":").map(Number);
  const tr = (await C.selectedTranslations())[0];
  const [sd, texts] = await Promise.all([C.surah(s), tr ? C.tr(tr.id, s) : null]);
  return { ar: sd.ayahs[a - 1]?.u || "", tr: texts?.[a - 1] || "", lang: tr?.lang };
}
function bookmarksCard() {
  const list = [...P.get().bookmarks].sort((a, b) => b.at - a.at);
  const box = h("section", { class: "card pr-card" }, h("h3", {}, `${t("progress.bookmarksTitle")} (${list.length})`));
  if (!list.length) { box.append(h("p", { class: "muted", style: "margin:0" }, t("progress.noBookmarks"))); return box; }
  for (const b of list) {
    const row = h("div", { class: "pr-item" },
      h("div", { class: "row-between" },
        h("a", { href: keyLink(b.key), class: "result-ref" }, h("span", { class: "ayah-key" }, b.key), ` ${surahName(b.key)}`),
        h("button", { class: "btn", onclick: () => { P.toggleBookmark(b.key); render(); } }, t("progress.remove"))));
    snippet(b.key).then(sn => row.append(
      h("div", { class: "pr-ar ar-uthmani", lang: "ar", dir: "rtl" }, sn.ar),
      sn.tr ? h("div", { class: sn.lang === "ur" ? "urdu" : "", dir: sn.lang === "ur" ? "rtl" : "ltr" }, sn.tr) : null));
    box.append(row);
  }
  return box;
}
function notesCard() {
  const notes = Object.entries(P.get().notes).sort((a, b) => b[1].at - a[1].at);
  const box = h("section", { class: "card pr-card" }, h("h3", {}, `${t("progress.notesTitle")} (${notes.length})`));
  if (!notes.length) { box.append(h("p", { class: "muted", style: "margin:0" }, t("progress.noNotes"))); return box; }
  for (const [key, n] of notes) {
    box.append(h("div", { class: "pr-item" },
      h("div", { class: "row-between" },
        h("a", { href: keyLink(key), class: "result-ref" }, h("span", { class: "ayah-key" }, key), ` ${surahName(key)}`),
        h("span", { class: "controls" },
          h("a", { class: "btn", href: keyLink(key) }, t("progress.edit")),
          h("button", { class: "btn", onclick: () => { P.setNote(key, ""); render(); } }, t("progress.remove")))),
      h("div", { class: "my-note", dir: "auto" }, n.text)));
  }
  return box;
}

// ------------------------------------------------------------------ backup
function backupCard() {
  const file = h("input", { type: "file", accept: "application/json,.json", class: "hidden", onchange: async e => {
    try { P.importJSON(await e.target.files[0].text()); C.toast(t("progress.imported")); render(); }
    catch { C.toast(t("progress.importFailed")); }
  } });
  return h("section", { class: "card pr-card" }, h("h3", {}, t("progress.backupTitle")),
    h("p", { class: "muted", style: "margin:0 0 12px" }, t("progress.backupLead")),
    h("div", { class: "controls" },
      h("button", { class: "btn", onclick: () => {
        const a = h("a", { href: URL.createObjectURL(new Blob([P.exportJSON()], { type: "application/json" })), download: `tadabbur-backup-${P.today()}.json` });
        document.body.append(a); a.click(); a.remove();
      } }, t("progress.export")),
      h("button", { class: "btn", onclick: () => file.click() }, t("progress.import")), file,
      h("button", { class: "btn", onclick: () => { if (confirm(t("progress.clearConfirm"))) { P.clearAll(); render(); } } }, t("progress.clear"))));
}

// ------------------------------------------------------------------ page
function render() {
  main.innerHTML = "";
  main.append(
    h("section", { class: "hero", style: "text-align:left;padding-bottom:0" },
      h("h1", { html: t("progress.titleHtml") }),
      h("p", { class: "lead", style: "margin:0" }, t("progress.lead"))),
    h("div", { class: "pr-grid" }, continueCard(), khatmCard()),
    h("div", { class: "pr-grid" }, bookmarksCard(), notesCard()),
    backupCard());
}
P.onChange(render);
render();
