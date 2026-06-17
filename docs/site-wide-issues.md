# Site-wide issues

Known gaps that affect all pages (or most pages), discovered during parity checks. These are
tracked here rather than as individual issue bugs to avoid duplicate reports per page.

---

## SW-1 — Nav labels not localised on fr/nl

**Discovered:** Credits parity check (2026-06-17)
**Owner:** astro-builder
**Affected:** All pages, fr and nl locales

Production fr: nav shows localised labels ("Bâtiment", "Aménagement", "Services", "Situation").
Local fr/nl: nav shows English labels ("Building", "Accommodation", "Services", "Location").

`SiteHeader.astro` is not consuming the localised nav label data for each locale.

---

## SW-2 — Missing `og:title` (and other OG) meta tags

**Discovered:** Credits parity check (2026-06-17)
**Owner:** astro-builder
**Affected:** All pages, all locales

Production emits `<meta property="og:title" content="...">` on all pages.
`BaseLayout.astro` does not emit any Open Graph meta tags.

Fix: add `og:title`, `og:description`, `og:locale` (at minimum) to `BaseLayout.astro`'s `<head>`.

---

## SW-4 — Rename CSS class `section--bg-green` → `section--bg-blue`

**Discovered:** credits parity check (2026-06-17)
**Owner:** astro-builder (LESS + Astro components) + content-architect (Strapi enum default label)
**Affected:** All pages and blocks that use `background_color: Blue`

`@color-primary` is `#153d86` (navy blue). The CSS class has always been misnamed `section--bg-green`
(matching the C# enum name `Green`) while the Description attribute in C# was "Blue" and the
actual rendered color is blue.

The Strapi enum now correctly uses `"Blue"`. The bgClass maps in all Astro components already
map `Blue → 'section--bg-green'` as a bridging measure. Once the class is renamed in the LESS:

1. Update all `bgClass` maps: `Blue: 'section--bg-blue'`
2. Rename the class in `@section.less`, `@checkers.less`, and any other LESS that references it
3. Also rename `checkers__checker--bg-green` → `checkers__checker--bg-blue` in `@checkers.less`

---

## SW-3 — Cookie consent banner absent

**Discovered:** Credits parity check (2026-06-17)
**Owner:** astro-builder
**Affected:** All pages, all locales

Production has a cookie consent banner (`.warnning__btn-text` / `.warnning__text` classes — top
stripe). Not yet implemented locally.

**QA note:** the parity harness should mask the banner region (~40px top) when pixel-diffing
until this is built, to avoid false-positive diffs on every page.
