// Share an ayah as an image: draws a card on a <canvas> in the browser (no server).
// The Quran text and translations are drawn exactly as given; fonts shrink to fit and the
// card grows taller when needed, so text is never cut off.

const FONTS = {
  uthmani: '"Amiri Quran"',
  indopak: '"DigitalKhatt IndoPak"',
  urdu: '"Noto Nastaliq Urdu"',
  ui: '"Inter", system-ui, sans-serif',
  display: '"Fraunces", Georgia, serif',
};
const THEMES = {
  light: { bg1: "#fbf7ee", bg2: "#efe6d2", ink: "#1f1b14", ink2: "#5b5346", accent: "#0f6b5c", gold: "#b98a2e", frame: "#d8c8a4" },
  dark: { bg1: "#14231f", bg2: "#0d1714", ink: "#f0ead9", ink2: "#b9b09c", accent: "#57c2ad", gold: "#d9a84e", frame: "#2f4a42" },
};
export const FORMATS = { square: [1080, 1080], story: [1080, 1920] };

/** Make sure the fonts the card uses are loaded before drawing. */
export async function loadFonts(script) {
  const want = [`64px ${FONTS[script === "indopak" ? "indopak" : "uthmani"]}`, `40px ${FONTS.urdu}`, `32px ${FONTS.ui}`, `600 40px ${FONTS.display}`];
  await Promise.all(want.map(f => document.fonts.load(f, "بسم الله abc").catch(() => {})));
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (max..min) whose wrapped block fits `budget` px tall; at `min` it may exceed it
 *  (the card then grows taller rather than cutting text). Returns { size, lines, lh }. */
function fitBlock(ctx, text, font, { max, min, maxWidth, lineHeight, dir, budget }) {
  ctx.direction = dir;
  let best;
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `${size}px ${font}`;
    best = { size, lines: wrap(ctx, text, maxWidth), lh: size * lineHeight };
    if (best.lines.length * best.lh <= budget) return best;
  }
  return best;
}

/**
 * Draw the card.
 * @param {HTMLCanvasElement} canvas
 * @param {{arabic: string, script: "uthmani"|"indopak", translations: {text, lang, name}[], ref: string,
 *          surahAr: string, theme: "light"|"dark", format: "square"|"story", credit: string, brand: string}} o
 */
export function drawCard(canvas, o) {
  const T = THEMES[o.theme] || THEMES.light;
  const [W, baseH] = FORMATS[o.format] || FORMATS.square;
  const pad = 96, inner = W - pad * 2;
  const ctx = canvas.getContext("2d");
  canvas.width = W;

  // measure every block first, then size the canvas to fit (never cut the Quran text)
  const arFont = FONTS[o.script === "indopak" ? "indopak" : "uthmani"];
  const story = o.format === "story";
  const ar = fitBlock(ctx, o.arabic, arFont, { max: story ? 76 : 64, min: 30, maxWidth: inner,
    lineHeight: o.script === "indopak" ? 2.0 : 1.9, dir: "rtl", budget: story ? 820 : (o.translations.length ? 430 : 700) });
  const trs = o.translations.map(tr => {
    const ur = tr.lang === "ur";
    const b = fitBlock(ctx, tr.text, ur ? FONTS.urdu : FONTS.ui,
      { max: ur ? 40 : 36, min: ur ? 24 : 22, maxWidth: inner, lineHeight: ur ? 2.15 : 1.45, dir: ur ? "rtl" : "ltr",
        budget: (story ? 760 : 300) / Math.max(1, o.translations.length) });
    return { ...tr, ...b, ur, font: ur ? FONTS.urdu : FONTS.ui };
  });
  const head = 150, gapAr = 44, gapTr = 30, foot = 150;
  const content = ar.lines.length * ar.lh + trs.reduce((s, b) => s + b.lines.length * b.lh + 34 + gapTr, 0);
  const H = Math.max(baseH, head + gapAr + content + foot + 40);
  canvas.height = H;

  // background, frame, ornaments
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, T.bg1); g.addColorStop(1, T.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = T.frame; ctx.lineWidth = 4; roundRect(ctx, 36, 36, W - 72, H - 72, 28); ctx.stroke();
  ctx.lineWidth = 1.5; roundRect(ctx, 50, 50, W - 100, H - 100, 22); ctx.stroke();

  // header: surah name (Arabic) + reference
  ctx.textAlign = "center"; ctx.direction = "rtl"; ctx.fillStyle = T.accent;
  ctx.font = `44px ${FONTS.uthmani}`;
  ctx.fillText(o.surahAr, W / 2, 128);
  ctx.direction = "ltr"; ctx.fillStyle = T.ink2; ctx.font = `500 26px ${FONTS.ui}`;
  ctx.fillText(o.ref, W / 2, 168);

  // vertically centre the content in the space between header and footer
  let y = head + gapAr + Math.max(0, (H - head - gapAr - foot - content) / 2);

  // Arabic
  ctx.fillStyle = T.ink; ctx.direction = "rtl"; ctx.font = `${ar.size}px ${arFont}`;
  for (const line of ar.lines) { y += ar.lh; ctx.fillText(line, W / 2, y - ar.lh * 0.28); }

  // divider
  y += 18;
  ctx.fillStyle = T.gold;
  ctx.beginPath(); ctx.arc(W / 2, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(W / 2 - 120, y - 1, 100, 2); ctx.fillRect(W / 2 + 20, y - 1, 100, 2);
  y += 16;

  // translations
  for (const b of trs) {
    ctx.fillStyle = T.ink; ctx.direction = b.ur ? "rtl" : "ltr"; ctx.font = `${b.size}px ${b.font}`;
    for (const line of b.lines) { y += b.lh; ctx.fillText(line, W / 2, y - b.lh * (b.ur ? 0.32 : 0.25)); }
    ctx.direction = "ltr"; ctx.fillStyle = T.ink2; ctx.font = `italic 22px ${FONTS.ui}`;
    y += 34; ctx.fillText(`— ${b.name}`, W / 2, y - 6);
    y += gapTr;
  }

  // footer credit
  ctx.direction = "ltr"; ctx.fillStyle = T.accent; ctx.font = `600 30px ${FONTS.display}`;
  ctx.fillText(o.brand, W / 2, H - 96);
  ctx.fillStyle = T.ink2; ctx.font = `20px ${FONTS.ui}`;
  ctx.fillText(o.credit, W / 2, H - 64);
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export const toBlob = canvas => new Promise(res => canvas.toBlob(res, "image/png"));
