---
name: tier3_preexisting
description: Pre-existing a11y issues on the old site — logged once, never re-reported per Tier 3 remit
metadata:
  type: project
---

These faults exist in the legacy markup and are therefore out of scope for this rebuild phase.
They are catalogued here so the auditor never re-raises them.

**Why:** Tier 3 remit — pre-existing conditions inherited from old site. Reporting them again creates noise without actionable parity signal.

**How to apply:** When an issue is also present in the equivalent old/ file, classify it Tier 3, log here, stay silent in future reports.

---

## T3-001 — SVG logo has no accessible name
- File: `old/Views/Shared/_Layout.cshtml` line 104 / `web/src/components/SiteHeader.astro` line 73
- Issue: `<a class="menu__logo--link">` wraps a bare `<svg>` with no `title`, `aria-label`, or `aria-labelledby`.
- WCAG: 2.4.6 / 4.1.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-002 — Mobile burger-menu toggle has no accessible name
- File: `old/Views/Shared/_Layout.cshtml` line 154 / `web/src/components/SiteHeader.astro` line 120
- Issue: `<a class="menu__mobile-toggler icon icon--burguer">` — icon-only link, no label.
- WCAG: 4.1.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-003 — Mobile close button has no accessible name
- File: `old/Views/Shared/_Layout.cshtml` line 57 / `web/src/components/SiteHeader.astro` line 30
- Issue: `<a class="menu__link-close icon icon--close">` — icon-only link, no label.
- WCAG: 4.1.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-004 — Hero scroll-down button has no accessible name
- File: `old/Views/Shared/Blocks/_Hero.cshtml` line 34 / `web/src/components/Hero.astro` line 36
- Issue: `<a class="icon icon--arrow-circle-bottom hero__button" href="#content">` — icon-only, no label.
- WCAG: 4.1.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-005 — Contact scroll-to-top button has no accessible name
- File: `old/Views/Shared/_Layout.cshtml` line 181 / `web/src/layouts/BaseLayout.astro` line 45
- Issue: `<a class="icon icon--arrow-circle-top contact__button...">` — icon-only, no label.
- WCAG: 4.1.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-006 — Duplicate `<nav>` without distinguishing labels
- File: `old/Views/Shared/_Layout.cshtml` lines 56 & 93 / `web/src/components/SiteHeader.astro` lines 29 & 63
- Issue: Two `<nav>` landmarks (mobile + desktop) with no `aria-label` to distinguish them. Screen readers list duplicate "navigation" regions.
- WCAG: 1.3.6 / 2.4.1 (AA)
- Status: pre-existing on old site — T3, out of scope this phase.

## T3-007 — `<video>` has no captions or description
- File: `old/Views/Shared/Blocks/_Hero.cshtml` line 21 / `web/src/components/Hero.astro` line 25
- Issue: Hero video element has no `<track kind="captions">` and no text alternative beyond the figcaption title text.
- WCAG: 1.2.2 (AA)
- Status: pre-existing on old site — T3, out of scope this phase. (Home page only; building page passes `video={null}`.)

## T3-008 — Hero image `alt` was hardcoded "Alternate Text" in old site
- File: `old/Views/Shared/Blocks/_Hero.cshtml` line 15
- Issue: Old markup had `alt="Alternate Text"` — meaningless placeholder.
- WCAG: 1.1.1 (A)
- Status: Rebuild IMPROVES on this (uses Strapi `alternativeText`, falls back to empty string for decorative). Not a regression — see T1 note in issue 12 findings.

## T3-009 — Slider prev/next controls are `<a>` without `href` (not keyboard focusable)
- File: `old/Views/Shared/Blocks/_Slider.cshtml` lines 51–54 / `web/src/components/blocks/Slider.astro` lines 73–80
- Issue: `<a class="icon icon--arrow-circle-left slider__control slider__control--previous">` and matching `--next` have no `href`, no `role`, no `tabindex`. They are not in the tab order and are not operable by keyboard.
- WCAG: 2.1.1 (A)
- Status: pre-existing on old site — exact same markup in `_Slider.cshtml` lines 51–54. T3, out of scope this phase. See T2-SL-003 for the Tier 2 queue item.

## T3-010 — Slider nav-dot items are `<a>` without `href` (not keyboard focusable)
- File: `old/Views/Shared/Blocks/_Slider.cshtml` lines 55–60 / `web/src/components/blocks/Slider.astro` lines 82–89
- Issue: `<a class="slider__nav-item">` dots have no `href`, no `role`, no `tabindex`, no label. Not focusable, no accessible name.
- WCAG: 2.1.1 / 4.1.2 (A / AA)
- Status: pre-existing on old site — exact same pattern. T3, out of scope this phase. See T2-SL-004 for the Tier 2 queue item.

## T3-011 — Slider has no `role="region"` / `aria-label` landmark and no live region for slide changes
- File: `old/Views/Shared/Blocks/_Slider.cshtml` / `web/src/components/blocks/Slider.astro`
- Issue: The slider has no landmark region and no `aria-live` region; screen readers receive no announcement when slides advance automatically.
- WCAG: 4.1.3 (AA)
- Status: pre-existing on old site — T3, out of scope this phase. See T2-SL-005 for the Tier 2 queue item.

## T3-012 — Autoplay has no pause mechanism
- File: `old/Scripts/Slider.ts` / `web/src/scripts/Slider.ts`
- Issue: `stopOnInteract=true` stops the interval after a user-initiated slide change, but there is no hover-pause, focus-pause, or explicit pause button. WCAG 2.2.2 requires a pause/stop/hide mechanism for auto-advancing content.
- WCAG: 2.2.2 (A)
- Status: pre-existing on old site — old `Slider.ts` has identical logic, no hover/focus pause. T3, out of scope this phase. See T2-SL-006 for the Tier 2 queue item.

## T3-013 — Info block column row has no list semantics
- File: `old/Views/Shared/Blocks/_Info.cshtml` lines 9–20 / `web/src/components/blocks/Info.astro` lines 33–45
- Issue: The `.info__inner` row of `.info__item` columns is a plain `<div>` group; items are not marked up as a list. For purely visual column layouts this is a common, accepted pattern; however it means columns have no semantic grouping announcement for screen readers.
- WCAG: 1.3.1 (A) — borderline; only a concern if columns are semantically equivalent list-like items
- Status: Identical pattern in old `_Info.cshtml`. T3, out of scope this phase.

## T3-014 — Info block section outer uses `<div>` not `<article>` or `<section>`
- File: `old/Views/Shared/Blocks/_Section.cshtml` line 22 uses `<article>` / `web/src/components/blocks/Info.astro` line 28 uses `<div>`
- Issue: Old site rendered the outer block wrapper as `<article class="section">`. Rebuild uses `<div class="section">`. Loss of landmark semantics (minor — `<article>` as block wrapper is unusual and not a strong landmark).
- WCAG: 1.3.1 (A) — minor
- Status: The difference is in the outer wrapper, not the Info block itself. The old `_Info.cshtml` did not own that wrapper; `_Section.cshtml` did. This is a cross-cutting pattern across all rebuilt blocks (Paragraph, Slider, etc. all use `<div>`). T3-level: not unique to Info, pre-existing architectural choice across rebuild. Out of scope this phase.
