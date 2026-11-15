// Tadabbur core: reading progress. No DOM.
// Everything stays on the device (same storage adapter as settings), in a small versioned
// shape that can later sync to an account without changes:
//
// { v: 1,
//   last:      { key: "2:255", at, where: "reader" | "mushaf", mushaf?, page? } | null,
//   bookmarks: [{ key, at }],
//   notes:     { "2:255": { text, at } },
//   khatm:     { start: "YYYY-MM-DD", days: 30, read: "<base64 bitset of 6,236 ayahs>" } | null,
//   done:      [{ start, end }],            // finished khatms
//   log:       { "YYYY-MM-DD": ayahsReadThatDay } }

import * as settings from "./settings.js";

const KEY = "tadabbur.progress";
export const TOTAL = 6236;
const EMPTY = () => ({ v: 1, last: null, bookmarks: [], notes: {}, khatm: null, done: [], log: {} });
const listeners = new Set();
let state = read();

function read() {
  try {
    const s = JSON.parse(settings.storageAdapter()?.getItem(KEY) || "null");
    return s && s.v === 1 ? { ...EMPTY(), ...s } : EMPTY();
  } catch {
    return EMPTY();
  }
}
function save(patch) {
  state = { ...state, ...patch };
  try { settings.storageAdapter()?.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  listeners.forEach(fn => fn(state, patch));
}
export const get = () => state;
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
/** Re-read after the app switches storage (settings.configureStorage). */
export const reload = () => { state = read(); listeners.forEach(fn => fn(state, {})); };

// ---------------------------------------------------------------- dates (local calendar day)
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayDiff = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);

// ---------------------------------------------------------------- bitset of ayahs (index 0..6235)
export function encodeBits(set) {
  const bytes = new Uint8Array(Math.ceil(TOTAL / 8));
  for (const i of set) bytes[i >> 3] |= 1 << (i & 7);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function decodeBits(b64) {
  const set = new Set();
  if (!b64) return set;
  const bin = atob(b64);
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    for (let k = 0; k < 8; k++) if (b & (1 << k)) set.add(i * 8 + k);
  }
  return set;
}

// ---------------------------------------------------------------- last read
export function setLast(key, where = "reader", extra = {}) {
  if (state.last?.key === key && state.last?.where === where) return;
  save({ last: { key, where, at: Date.now(), ...extra } });
}

// ---------------------------------------------------------------- bookmarks + notes
export const isBookmarked = key => state.bookmarks.some(b => b.key === key);
export function toggleBookmark(key) {
  const on = isBookmarked(key);
  save({ bookmarks: on ? state.bookmarks.filter(b => b.key !== key) : [...state.bookmarks, { key, at: Date.now() }] });
  return !on;
}
export const note = key => state.notes[key]?.text || "";
export function setNote(key, text) {
  const notes = { ...state.notes };
  if (text && text.trim()) notes[key] = { text: text.trim(), at: Date.now() };
  else delete notes[key];
  save({ notes });
}

// ---------------------------------------------------------------- khatm (reading the whole Quran)
export function startKhatm(days = 30) {
  save({ khatm: { start: today(), days: Math.max(1, Math.round(days)), read: "" } });
}
export function setKhatmDays(days) {
  if (state.khatm) save({ khatm: { ...state.khatm, days: Math.max(1, Math.round(days)) } });
}
export function stopKhatm() { save({ khatm: null }); }

/** Mark ayahs (global indexes) as read: counts toward today's log and the current khatm. */
export function markRead(indexes) {
  const k = state.khatm;
  const set = k ? decodeBits(k.read) : null;
  let fresh = 0;
  for (const i of indexes) {
    if (i < 0 || i >= TOTAL) continue;
    if (set) { if (!set.has(i)) { set.add(i); fresh++; } }
  }
  if (!k) return 0;
  const log = { ...state.log };
  if (fresh) log[today()] = (log[today()] || 0) + fresh;
  const patch = { log, khatm: { ...k, read: encodeBits(set) } };
  if (set.size >= TOTAL) {                         // khatm complete
    patch.done = [...state.done, { start: k.start, end: today() }];
    patch.khatm = null;
  }
  if (fresh) save(patch);
  return fresh;
}

/** Numbers for the khatm card. */
export function khatmStatus(now = today()) {
  const k = state.khatm;
  if (!k) return null;
  const read = decodeBits(k.read);
  const elapsed = Math.max(0, dayDiff(k.start, now));
  const daysLeft = Math.max(1, k.days - elapsed);
  const remaining = TOTAL - read.size;
  return {
    start: k.start, days: k.days, read: read.size, remaining, pct: (read.size / TOTAL) * 100,
    daysLeft, perDay: Math.ceil(remaining / daysLeft), today: state.log[now] || 0, set: read,
  };
}

/** Consecutive days (ending today or yesterday) with at least one ayah read. */
export function streak(now = today()) {
  let n = 0;
  let d = new Date(now + "T12:00");
  if (!state.log[now]) d.setDate(d.getDate() - 1);
  while (state.log[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------------------------------------------------------------- backup
export const exportJSON = () => JSON.stringify({ app: "tadabbur", ...state }, null, 1);
export function importJSON(text) {
  const d = JSON.parse(text);
  if (d.app !== "tadabbur" || d.v !== 1) throw new Error("not a Tadabbur backup");
  const { app, ...rest } = d;                      // eslint-disable-line no-unused-vars
  save({ ...EMPTY(), ...rest });
}
export function clearAll() { save(EMPTY()); }
