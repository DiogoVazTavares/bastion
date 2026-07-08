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

---

## SW-5 — Section title heading level is `<h4>`, old site uses `<h1>`

**Discovered:** Accommodation parity check (2026-06-23, issue #20)
**Owner:** astro-builder (component markup) + a11y-auditor (queue item #5)
**Affected:** All blocks with a `section__title`, all pages — `Paragraph.astro`,
`ParagraphImage.astro`, `Building.astro`, `Partners.astro`, `Slider.astro`, `Info.astro`,
`Floors.astro`.

`old/Views/Shared/Blocks/_Section.cshtml:31` renders the section title as
`<h1 class="section__title">`. All rebuilt components use `<h4 class="section__title">`. This
causes a cascading vertical-height pixel diff on every multi-block page (≈12% desktop on
Accommodation).

Deliberately **kept as `<h4>` for now** (decision 2026-06-23) rather than fixed per-page,
because: (a) it is shared markup across already-merged pages (Building), and (b) it overlaps
a11y queue item #5 in `docs/a11y-exceptions.md`, which proposes `<h4>`→`<h2>` (a different
target than parity's `<h1>`). Resolve the parity-vs-a11y target once, project-wide, and apply
to all components together. Until then, parity-qa should treat the section-title height delta
as a known accepted diff on multi-block pages.
