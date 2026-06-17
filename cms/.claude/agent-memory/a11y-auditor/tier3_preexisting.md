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
