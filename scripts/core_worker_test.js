// Runs inside a Web Worker (no `document`, no `window`), started by scripts/smoke_test.py.
// Proves js/core/ works without the DOM, the same way a mobile/desktop app would use it.
import * as core from "../js/core/index.js";
import { t } from "../js/i18n/index.js";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });

try {
  check("no DOM in worker", typeof document === "undefined");

  // like an app: tell the core where the data lives
  core.configure({ base: new URL("../", import.meta.url).href });

  // settings with an app-style storage adapter
  const mem = new Map();
  core.settings.configureStorage({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
  core.settings.set({ script: "uthmani" });
  check("settings use the adapter", JSON.parse(mem.get("tadabbur.settings")).script === "uthmani");

  const m = await core.checkSchema();
  check("schema matches", m.schema === core.SCHEMA, m.schema);

  const chs = await core.chapters();
  check("114 chapters", chs.length === 114, chs.length);
  const { keys } = core.ayahIndex(chs);
  check("6,236 ayah keys", keys.length === 6236, keys.length);

  const s1 = await core.surah(1);
  check("Al-Fatihah has 7 ayahs", s1.ayahs.length === 7, s1.ayahs.length);
  check("scriptText is null for Uthmani", (await core.scriptText(1)) === null);

  const sel = await core.selectedTranslations();
  check("default translations resolve", sel.length >= 1, sel.map(x => x.id));

  const se = core.searchEngine;
  check("parseRef 2:255", JSON.stringify(se.parseRef("2:255", chs)) === "[2,255]");
  check("parseRef Baqarah 255", JSON.stringify(se.parseRef("Baqarah 255", chs)) === "[2,255]");
  check("parseRef rejects 1:8", se.parseRef("1:8", chs) === null);
  check("harakat ignored", se.normText("رَحْمَة") === se.normText("رحمة"));

  const r = await se.search("صبر", { translations: sel });
  check("search صبر finds ayahs", r.hits.length > 50, r.hits.length);
  check("search covers Arabic + Urdu", r.fields.includes("ar"), r.fields);
  const r2 = await se.search("Yusuf", { translations: sel });
  check("search Yusuf finds surah + prophet", r2.surahs.some(c => c.n === 12) && r2.prophets.some(p => p.id === "yusuf"));

  // reading progress (same app-style storage adapter)
  const P = core.progress;
  P.reload();
  check("progress starts empty", !P.get().last && P.get().bookmarks.length === 0);
  const bits = P.decodeBits(P.encodeBits(new Set([0, 7, 255, 6235])));
  check("ayah bitset round-trips", [...bits].sort((a, b) => a - b).join() === "0,7,255,6235", [...bits]);
  P.startKhatm(30);
  P.markRead([0, 1, 2, 3, 4, 5, 6]);
  P.markRead([0, 1]);                               // already read: not counted twice
  const ks = P.khatmStatus();
  check("khatm counts each ayah once", ks.read === 7 && ks.today === 7, `${ks.read}/${ks.today}`);
  check("daily target = remaining / days", ks.perDay === Math.ceil((6236 - 7) / 30), ks.perDay);
  check("bookmark toggles", P.toggleBookmark("2:255") === true && P.isBookmarked("2:255") && P.toggleBookmark("2:255") === false);
  P.setNote("1:1", "note"); P.setLast("1:7");
  const backup = P.exportJSON();
  P.clearAll();
  P.importJSON(backup);
  check("backup restores notes, last place and khatm", P.note("1:1") === "note" && P.get().last.key === "1:7" && P.khatmStatus().read === 7);
  check("progress saved through the adapter", JSON.parse(mem.get("tadabbur.progress")).notes["1:1"].text === "note");

  check("i18n plural", t("common.ayahs", { n: 1 }) === "1 ayah" && t("common.ayahs", { n: 2 }) === "2 ayahs");
  check("i18n missing key is visible", t("no.such.key") === "⟦no.such.key⟧");
} catch (e) {
  check("no exception", false, e && e.stack || e);
}
postMessage(results);
