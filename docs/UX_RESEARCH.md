# UI/UX review and research (2026-11-16)

Why this exists: before adding the UI/UX tasks to [ROADMAP.md](../ROADMAP.md) (Phase 5), we measured the live site and checked what research and the major platform guidelines say. Each roadmap task points back to a finding here.

## 1. Who we design for

- **Readers:** Urdu speakers in Pakistan who can recite Arabic but don't understand it, including older family members.
- **Devices:** mostly budget Android phones.
  - Transsion (Tecno and Infinix) held 44% of Pakistan's smartphone market in Q2 2025 ([Business Recorder](https://www.brecorder.com/news/40388277)).
  - An entry-level handset cost 44% of monthly income for the poorest fifth at the end of 2025 ([GSMA report](https://www.gsma.com/about-us/regions/asia-pacific/wp-content/uploads/2025/07/Unlocking-Pakistan-digital-future-FINAL.pdf); [Profit](https://profit.pakistantoday.com.pk/2026/05/15/high-smartphone-taxes-leave-pakistan-with-52-internet-usage-gap-despite-81-network-coverage)).
- **Connections:** the national average mobile download was 18.6 Mbps in Q4 2025 (PTA/Opensignal, via [TechJuice](https://www.techjuice.pk/?p=218115)), and many people are on prepaid data.
- **What this means:** design for slow phones, paid data and one-handed use first. Desktop comes second.

## 2. What we measured (audit at 375px phone width, 2026-11-16)

| Finding | Measured | Why it matters |
|---|---|---|
| Header menu on phones | Its content is 592px wide in a 293px space, so **6 of 9 links are off-screen** with no sign that you can scroll. | Navigation people can't see is navigation they don't use (§3.2). |
| Surah page start | The first ayah begins **1,620px down**, two full phone screens under the surah intro. | The main job of the page is reading; everything else should be one tap away (§3.3). |
| Ayah action row | **8 controls** per ayah, wrapping onto 2 lines on phones. Icon buttons are **28×33px**. | More choices take longer to decide (Hick's law). This is below the 44px comfortable target size (§3.1). |
| Al-Baqarah weight | **30,262 page elements**, about **2.7 MB** downloaded (1.7 MB data, 0.9 MB fonts), 286 ayahs drawn at once (481 screens tall). | On budget phones this makes scrolling and taps slow (§3.4). |
| Small text | Translator names at **11px**; much other text at 12px. | Hard to read for older eyes; translator names are the source citation, so they matter. |
| Revelation-order bars | Each bar is a link only **2px wide**. | Too small to tap; fine for hovering with a mouse, not for touch. |
| Home page | About 680 KB, 22 requests. No sideways scroll anywhere. | OK; fonts are most of it. |

What already works: there is no sideways scroll on any page, the reading view itself is clear, the IndoPak and Urdu text renders well, dark mode works, it works offline, and there are no console errors.

## 3. What the research and guidelines say

### 3.1 Touch targets
- **Minimum:** WCAG 2.2 (W3C standard since Oct 2023), SC 2.5.8, requires targets of at least **24×24 CSS px**, or enough space around them ([W3C: What's new in 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/); [Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- **Comfortable:** the enhanced level, SC 2.5.5, asks for **44×44 px**. Apple's guidelines use 44pt and Material Design uses 48dp.
- **Our rule:** **44px for anything you tap often**, and never under 24px.

### 3.2 Navigation on phones
- **Thumb reach:** Hoober watched over 1,300 people using phones ([UXmatters, 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)). 49% used one hand, and most tapped with a single thumb. The lower middle of the screen is the easiest area to reach ([A List Apart](https://alistapart.com/1-2-phone-grips-jpg/)). The exact numbers are from 2013 phones, but the direction still holds.
- **Hidden menus:** NN/g tested 179 people on phones and desktops. Navigation hidden behind a menu is found less often than navigation that is visible or partly visible ([NN/g: hamburger menus](https://www.nngroup.com/articles/hamburger-menus/); [method](https://www.nngroup.com/articles/hidden-navigation-methodology/)).
- **Material Design 3:** a bottom navigation bar is for **3–5 main destinations**; use a side rail on tablets and desktop ([SAP Fiori summary of M3](https://www.sap.com/design-system/fiori-design-android/v26-1/components/m3-standard-components/navigation-bar/usage)).
- **What we'll do:** a **bottom tab bar on phones** (Read, Search, Learn, My reading, More) and the top menu on desktop.

### 3.3 Show the main thing first, the rest on request
- **Progressive disclosure:** show the most important options first and reveal the rest when asked ([Nielsen](https://jakobnielsenphd.substack.com/p/progressive-disclosure); [The Decision Lab](https://thedecisionlab.com/reference-guide/design/progressive-disclosure)).
- **Hick's law:** decision time grows with the number of choices ([LogRocket summary](https://blog.logrocket.com/ux-design/using-hicks-law-help-users-make-decisions)).
- **But don't hide too much:** a feature people can't find frustrates them. So hidden actions get a clear label ("More"), not just an icon.
- **What we'll do:** a compact surah header with "About this surah" to expand it; per ayah, show play, tafsir and the hadith/similar badges, and put the rest in one "More" menu.

### 3.4 Speed
- **Google's "good" thresholds:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, measured at the 75th percentile of real visits ([web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)).
- **What we'll do:** draw long surahs in pieces as you scroll; load the Nastaliq font only when Urdu is on screen; trim the fonts to the characters we use; test on a slowed-down "budget phone" profile in CI.

### 3.5 Reading Urdu and Arabic
- **Urdu needs more space:** Nastaliq goes much further above and below the line than Latin script, so it needs extra line height ([W3C Urdu layout requirements](https://www.w3.org/TR/arab-ur-lreq/); [Web typography notes](https://docs.thottingal.in/web-typography)).
- **No Nastaliq study found:** we found no peer-reviewed reading-speed study for Nastaliq on screens. So we follow the W3C notes, keep the size and spacing settings the reader already has, and **test with real readers** (§3.6).
- **Line length:** for English, keep lines to about 45–90 characters ([UX Planet, informal](https://uxplanet.org/typographical-dilemmas-the-experiment-on-positive-online-reading-experience-78e2f1897109)).
- **Minimum size:** body text at least 16px and no text under 13px. Translator names and sources move from 11px to at least 13px.

### 3.6 Test with real people (free)
- NN/g's long-standing advice is that a few users per round (about 5) find most usability problems, so test in several small rounds ([NN/g](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)).
- **What we'll do:** 5 Urdu-speaking readers (family, friends, a masjid group), each on their own phone. Give them a small set of tasks, for example "find what ayah 2:255 means in Urdu" or "find which hadith quote this ayah". Watch, don't help, and note where they get stuck. Repeat after each big UX change.

### 3.7 Accessibility and respect for the reader
- **WCAG 2.2 AA** as the bar: contrast in both themes, visible keyboard focus, labels for screen readers, `lang="ar"` / `lang="ur"` on text, and respect for "reduce motion".
- **No tracking.** Reading progress already stays on the device. If we ever want usage numbers, they must be anonymous and opt-in.

## 4. Other languages (checked 2026-11-16)

- **What Quran.com has:** its public API lists **126 translations in 69 languages**, and 71 interface languages ([api/v4/resources/translations](https://api.quran.com/api/v4/resources/translations)).
- **Count by language, for our region and the original plan:**
  - Bengali 4, Turkish 5, Indonesian 3, Persian 2;
  - Hindi 1, Pashto 1, Sindhi 1, Gujarati 1;
  - Punjabi, Balochi and Kashmiri: **none**, marked "needs source".
- **Licences:** each translation has its own terms (many come from QuranEnc, King Fahd Complex or IslamHouse). Rule 6 applies: check each licence before bundling, or link instead.
- **Word-by-word:** Quran.com's word-by-word meanings exist only for some languages, so check per language before promising it.
- **Interface languages:** all interface text is already in `js/i18n/en.js`. After the Urdu interface (last, as decided), the same file can be translated into other languages. Right-to-left languages (Arabic, Persian, Pashto, Sindhi) reuse the Urdu right-to-left work.
