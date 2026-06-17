---
name: credits-findings
description: Bugs and diffs found on the Credits page (issue #11) parity check, 2026-06-17
metadata:
  type: project
---

Run date: 2026-06-17. All three locales (en/fr/nl) checked.

## BUG 1 — Wrong background_color on content section (VISUAL, all locales)

- Production: `<div class="section">` — no background modifier, renders white
- Local:      `<div class="section section--bg-gray">` — gray background

Root cause: Strapi `background_color` field is set to `Gray` in the migrated Credits entry. Production has no background color (White/default). The `bgClass` map in `credits.astro` correctly maps `Gray → section--bg-gray`, but the migration set the wrong value.

**Who fixes:** migration-engineer (re-run migrate-credits.js with correct background_color = White, or clear the field) OR content-architect (verify the Strapi Credits entry background_color field value).

**Visual impact:** ~40% pixel diff across all locales and both viewports. The entire content area has a gray background instead of white.

## BUG 2 — Nav links not localised on fr/nl (CONTENT, fr and nl)

- Production fr: nav shows "Bâtiment", "Aménagement", "Services", "Situation"
- Local fr/nl: nav shows "Building", "Accommodation", "Services", "Location" (English)

Root cause: nav/menu component is rendering English labels regardless of locale.

**Who fixes:** astro-builder.

## BUG 3 — Cookie consent banner (warnning) absent on local (CSS CLASSES, all locales)

- Production: has `.warnning__btn-text` and `.warnning__text` classes (cookie consent banner)
- Local: these classes are absent

This is a known feature gap (cookie banner not implemented yet). NOT a parity regression for the Credits page specifically — the banner is a site-wide component. Flagged for astro-builder.

## BUG 4 — Missing `og:title` meta tag (META, all locales)

- Production: `<meta property="og:title" content="Credits">` present
- Local: og:title absent

**Who fixes:** astro-builder (add og:title to BaseLayout or page head).

## PASS items

- `<title>` matches on all locales (en: "Credits", fr: "Crédits", nl: "Credits")
- `<meta name="description">` matches on all locales — exact same text
- Heading structure matches: h4.section__title for credits title, h1 for Contact — identical
- Section inner classes match: `section__inner section__inner--terms`
- paragraph / paragraph__content wrapper classes present on both
- show_title: Credits title renders as h4 on both (show_title=true working)
- Rich-text body content identical across all locales (content round-trip OK)
- Contact section (section--bg-green) identical on both
- hreflang: absent on both prod and local (production itself has no hreflang tags — not a local regression)
- /en/credits, /fr/credits, /nl/credits all return HTTP 200

## Known acceptable diffs to register

- Cookie banner (warnning component) — site-wide, not Credits-specific. Pixel impact: top ~40px
- macOS floating toolbar appears in some local screenshots (OS-level, mask in future runs)
