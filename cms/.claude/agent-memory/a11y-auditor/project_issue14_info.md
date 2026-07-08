---
name: project_issue14_info
description: A11y audit findings for issue #14 — Info.astro (blocks.info) static component audit
metadata:
  type: project
---

Audited 2026-06-22 against WCAG 2.2 AA.

**Why:** Issue #14 introduces Info.astro, the blocks.info block — static audit before page wire-up.

**How to apply:** Tier 1 items for astro-builder application. Tier 2 items for docs/a11y-exceptions.md queue. Tier 3 items catalogued in [[tier3_preexisting]] — never re-report.

---

## Key facts established by this audit

- `_Section.cshtml` (old site) rendered ALL block section titles as `<h1 class="section__title">`.
- The rebuild uses `<h4 class="section__title">` consistently across ALL blocks (Paragraph, ParagraphImage, Info, Partners, Slider). Floors.astro uses `<h1>`. This is a cross-cutting astro-builder decision, not an Info-specific issue.
- `.section__title` is styled by class only; `h1` vs `h4` has zero visual/rendering difference (UA defaults overridden by LESS).
- `_Info.cshtml` old alt: `alt="@(item.Image.Legend ?? "")"` — empty-string fallback. Rebuild: `alt={image.alternativeText ?? ""}`. Pattern is identical. No regression.
- Column items have no list semantics in either old or new — logged as T3-013.
- Outer block wrapper: old site used `<article>` (from `_Section.cshtml`); rebuild uses `<div>`. Cross-cutting pattern across all blocks. Logged as T3-014.

## T1 findings (apply immediately)

### T1-INFO-01 — Column images with empty alt need `role="presentation"` consideration
**NOT a Tier 1 fix — see note below.** `alt=""` is the correct approach for decorative images per WCAG 1.1.1. The rebuild already does this correctly (`alt={image.alternativeText ?? ""}`). If Strapi has no alt text, the image is treated as decorative. If editors supply meaningful alt text, it flows through. **No action required — pattern is correct.**

No other Tier 1 wins identified for Info.astro specifically. The component has no icon links, no interactive controls, no form elements, no `aria-*` gaps.

## T2 findings (queue for human approval in docs/a11y-exceptions.md)

### T2-INFO-01 — Heading level `<h4>` vs old site `<h1>` (cross-cutting)
- **Severity:** Serious
- **File:** `web/src/components/blocks/Info.astro` line 30 (and Paragraph.astro:27, ParagraphImage.astro:29, Partners.astro:28, Slider.astro:39)
- **Issue:** Old site rendered all section titles as `<h1>` (via `_Section.cshtml` line 31). Rebuild uses `<h4>`. Visually identical (class-driven styling). Semantically: `<h4>` implies three ancestor heading levels exist above it; in practice these block sections have no `<h2>` or `<h3>` ancestors (Hero title is not a heading element). This creates a skipped-heading-level violation (WCAG 1.3.1 / 2.4.6 AA). `<h2>` would be the semantically correct level for top-level page section headings.
- **WCAG:** 1.3.1 (A), 2.4.6 (AA)
- **Exact change needed:** Change `<h4 class="section__title">` to `<h2 class="section__title">` across all affected blocks (Info, Paragraph, ParagraphImage, Partners, Slider). Floors.astro already uses `<h1>` which is also wrong but separately queued if needed.
- **Parity impact:** Zero visual change (class-driven styling). Pixel parity unaffected. But it IS a DOM structure change, hence Tier 2.
- **Note:** This is cross-cutting — a single approval covers all five block components.

## T3 findings (pre-existing, logged in [[tier3_preexisting]])

- T3-013: Info column row has no list semantics — pre-existing in `_Info.cshtml`.
- T3-014: Outer block `<article>` → `<div>` cross-cutting rebuild decision — logged, not Info-specific.
- No other pre-existing issues specific to Info block.

## Notable positive finding

`alt={image.alternativeText ?? ""}` — correct decorative fallback. Editors who supply meaningful alt text in Strapi get it; images with no Strapi alt text are silently decorative. No action needed.

Rich-text `set:html` in `.info__text`: heading hierarchy inside author-controlled HTML is content-level, not component-level. Not auditable statically.
