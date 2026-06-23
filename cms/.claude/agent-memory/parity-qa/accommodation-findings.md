---
name: accommodation-findings
description: Known diffs, bugs, and false positives found during issue #20 Accommodation parity check
metadata:
  type: project
---

## False positives in check-accommodation.js

**Double-slider in blockOrder detection**: The Slider island script adds `our-slider our-slider--first-slide` classes to hidden lightbox `lightbox__inner` elements at init. These match the `\bslider\b` regex in blockOrder extraction. Filter by `.slider` wrapper, not class-scan, or use `.slider[data-behavior="slider"]` outside `.floors__lightboxes`.

**Slide count = 25**: extractStructure counted all `[data-behavior="slider-slide"]` including 15 hidden lightbox slides. Main slider has 10 slides, 10 nav dots — correct. Use `.slider [data-behavior="slider-slide"]` for main slider count.

**Live lightbox trigger not found**: `Discover()` in old Lightbox.ts removes `data-behavior="lightbox"` on init, so Playwright can't find it by that attribute on live. Use `rect#22` click via `dispatchEvent(new MouseEvent('click', { bubbles: true }))` instead.

**Live lightbox-close element hidden**: When targeting `[data-behavior="lightbox-close"]`, Playwright may resolve to the one inside the hidden `floors__lightboxes` template (not visible). Always target `.our-lightbox__container [data-behavior="lightbox-close"]`.

## Bugs found (issue #20)

### BUG-1: Floors block missing outer section wrapper (STRUCTURAL)
- **Live**: `<article class="section section--bg-gray"><section class="section__inner"><h1 class="section__title">{title}</h1>...`
- **Rebuilt**: `<div class="floors section--bg-gray" data-behavior="floors">` — no `section` / `section__inner` wrapper, no `section__title` rendered
- **Impact**: "Schedule of availability" (EN), "Disponibilités" (FR), "Beschikbaarheid" (NL) titles absent. CSS transitions on `.section[data-spy-enter-viewport]` won't trigger. ~2% of visual diff.
- **Owner**: astro-builder — Floors.astro needs the outer `<div class="section ..."` + `<div class="section__inner">` + `<h4 class="section__title">` wrapper, same pattern as Paragraph/Slider/Info.

### BUG-2: section__title tag is h4 in rebuilt, h1 in live (STRUCTURAL)
- **Live**: `<h1 class="section__title">` for all block titles
- **Rebuilt**: `<h4 class="section__title">` in Paragraph.astro, Info.astro, Slider.astro
- **Impact**: ~40px per-section height difference cascades to large pixel diff (~12% overall). Heading hierarchy also differs.
- **Owner**: astro-builder — change `<h4>` to `<h1>` in all block components' section__title element.

### BUG-3: Second info block show_title incorrectly true (DATA)
- **Live**: Second `blocks.info` block (technical specs details) has no `section__title` shown
- **Rebuilt**: Shows "Specifications details" title — `show_title` flag set to true in Strapi migration
- **Affected locales**: en ("Specifications details"), nl ("Technische specificaties detail"), fr (not flagged — check)
- **Owner**: migration-engineer — fix ETL to set correct `show_title: false` for that info block.

### BUG-4: Gallery slider figcaptions missing (CONTENT)
- **Live**: Each of 10 gallery slides has `<figcaption class="slider__slide-figcaption">© Gianluca Di Fabio Architects</figcaption>`
- **Rebuilt**: figcaption is conditional on `slide.image.caption` which is null — alt text has the attribution but caption field is empty
- **Impact**: Copyright attribution text absent from gallery. Small visual diff per slide.
- **Owner**: migration-engineer — populate `caption` field from alternativeText (or source) in ETL for gallery slides.

### BUG-5: hreflang and canonical tags absent (SEO)
- Both live and rebuilt lack hreflang/canonical on Accommodation (live also absent — so parity holds for hreflang)
- Canonical is absent on both too
- **Status**: not a regression vs live, but should be added. Track in docs/decisions.md.

## Lightbox URL behaviour — PASS

**Rebuilt (all 3 locales):**
- Open: appends `/{uid}` to current path → `/{locale}/accommodation/{uid}` ✓
- Close: strips suffix back to `/{locale}/accommodation` ✓

**Live (en observed):**
- Open: `https://www.bastiontower.com/en/Accommodation` → `https://www.bastiontower.com/en/Accommodation/22` ✓
- Close: back to `https://www.bastiontower.com/en/Accommodation` ✓

**Behaviour matches.** The deep-link mechanism in Floors.astro correctly mirrors HistoryManager.ChangeState.

## Deep-link cold-load — PASS (en)

- `/en/accommodation/22`: HTTP 200, `data-autoopen-uid="22"`, lightbox auto-opens ✓
- `/fr/accommodation/uid-9b68e793`: HTTP 200, lightbox auto-opens ✓
- `/nl/accommodation/uid-c2579ab3`: HTTP 200, lightbox auto-opens ✓
- Note: fr/nl use ETL-generated `uid-*` style UIDs, not integer UIDs like en. This is expected if migrated differently.

## Non-localised fields — PASS

- Hero image: identical URL across en/fr/nl ✓
- Slider images: identical across en/fr/nl ✓
- Floor lightbox images: identical across en/fr/nl (15 images each) ✓

## Screenshots

All saved in `qa/screenshots/accommodation/`:
- `{locale}-desktop-prod.png`, `{locale}-desktop-local.png`, `{locale}-desktop-diff.png`
- `{locale}-mobile-prod.png`, `{locale}-mobile-local.png`, `{locale}-mobile-diff.png`
- `{locale}-desktop-lightbox-open.png`, `{locale}-desktop-deeplink-{uid}.png`
