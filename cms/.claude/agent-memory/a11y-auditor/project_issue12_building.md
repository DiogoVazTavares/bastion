---
name: project_issue12_building
description: A11y audit findings for issue #12 — Building page wire-up (Hero, building.astro, SiteHeader, BaseLayout)
metadata:
  type: project
---

Audited 2026-06-17 against WCAG 2.2 AA.

**Why:** Issue #12 wires up the Building page: new Hero component, new building.astro page, modified SiteHeader (lang switcher fix), modified BaseLayout (currentSlug prop).

**How to apply:** Tier 1 items passed to astro-builder for immediate application. Tier 2 items documented for human approval queue. Tier 3 items logged in [[tier3_preexisting]] — never re-report.

---

## T1 findings (apply immediately)

- T1-BUILD-01: `web/src/components/Hero.astro` line 36 — hero scroll button needs `aria-label="Scroll to content"`. T3-004 covers the old site, BUT this is NEW code — the rebuild can add the label invisibly. Invisible win.
- T1-BUILD-02: `web/src/components/SiteHeader.astro` line 73 — SVG logo link needs `aria-label="Bastion Tower — home"`. T3-001 covers old site. Invisible win on new code.
- T1-BUILD-03: `web/src/components/SiteHeader.astro` line 120 — mobile burger toggle needs `aria-label="Open menu"`. T3-002 covers old site. Invisible win.
- T1-BUILD-04: `web/src/components/SiteHeader.astro` line 30 — mobile close link needs `aria-label="Close menu"`. T3-003 covers old site. Invisible win.
- T1-BUILD-05: `web/src/layouts/BaseLayout.astro` line 45 — scroll-to-top button needs `aria-label="Scroll to top"`. T3-005 covers old site. Invisible win.
- T1-BUILD-06: `web/src/components/SiteHeader.astro` lines 29 & 63 — mobile and desktop `<nav>` need `aria-label="Mobile navigation"` and `aria-label="Main navigation"` respectively. T3-006 covers old site. Invisible win.
- T1-BUILD-07: `web/src/pages/[locale]/building.astro` line 36 — `<a name="content" id="content">` is an empty anchor used as a skip target. Should be a non-interactive element: replace with `<div id="content" tabindex="-1"></div>` — invisible, parity-safe. (Old site used the same `<a name="content">` pattern — T3 for that; but the rebuild has latitude to use `<div>` instead.)
  - Note: This is borderline T1/T2. The change is invisible (no rendered output), but it changes the element type. Flag for astro-builder to confirm acceptable.

## T2 findings (queue for human approval)

None identified for this issue. All structural patterns are direct parity reproductions of legacy markup.

## T3 findings (pre-existing, logged, never re-report)

See [[tier3_preexisting]]:
- T3-001 (SVG logo no label)
- T3-002 (burger toggle no label)
- T3-003 (mobile close no label)
- T3-004 (hero scroll button no label)
- T3-005 (scroll-to-top no label)
- T3-006 (duplicate nav no labels)
- T3-007 (video no captions — not applicable to building page, video=null)
- T3-008 (hero alt text was "Alternate Text") — IMPROVED by rebuild, not a regression.

## Notable positive finding

`web/src/components/Hero.astro` line 21: `alt={image.alternativeText ?? ''}` — correctly uses empty string fallback, treating the hero image as decorative when no alt text is provided. This is an improvement over the old site's hardcoded "Alternate Text" (T3-008). No action needed.

`web/src/layouts/BaseLayout.astro` line 24: `<html lang={locale}>` — correctly set per locale. Matches old site behaviour.
