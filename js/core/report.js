// Tadabbur core: "Report an issue" links. No DOM.
// Builds a link to the GitHub issue form .github/ISSUE_TEMPLATE/content_report.yml with
// its fields already filled in, so a reader only has to describe the problem.

export const REPO = "iammuhammadnoumankhan/tadabbur";

/** Must match the dropdown options in content_report.yml exactly (checked by scripts/smoke_test.py). */
export const KINDS = Object.freeze({
  quran: "Quran text (Arabic)",
  translation: "Translation",
  word: "Word-by-word meaning",
  tafsir: "Tafsir",
  hadith: "Hadith",
  intro: "Surah introduction",
  seerah: "Seerah timeline",
  prophets: "Prophets",
  other: "Something else",
});

/**
 * @param {{kind: keyof KINDS, reference?: string, source?: string, page?: string, title?: string}} r
 * @returns {string} URL of a pre-filled GitHub issue form
 */
export function reportUrl({ kind = "other", reference = "", source = "", page = "", title = "" } = {}) {
  const p = new URLSearchParams({
    template: "content_report.yml",
    title: `[Content] ${title || [KINDS[kind] || KINDS.other, reference].filter(Boolean).join(" · ")}`,
    kind: KINDS[kind] || KINDS.other,
    reference,
    source,
    page,
  });
  return `https://github.com/${REPO}/issues/new?${p}`;
}
