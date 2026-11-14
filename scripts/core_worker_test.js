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

  check("i18n plural", t("common.ayahs", { n: 1 }) === "1 ayah" && t("common.ayahs", { n: 2 }) === "2 ayahs");
  check("i18n missing key is visible", t("no.such.key") === "⟦no.such.key⟧");
} catch (e) {
  check("no exception", false, e && e.stack || e);
}
postMessage(results);
