---
name: known-acceptable-diffs
description: Pixel diff patterns that are noise, not bugs — suppress in future runs
metadata:
  type: project
---

## Cookie consent banner (warnning component)

- Classes: `.warnning__btn-text`, `.warnning__text`, `.warning`, `.warning__inner`, `.warnning__btn`
- Banner appears at top of every prod page; not yet implemented on local
- Pixel impact: top ~40px, full-width stripe on desktop. Approximately 3-5% of total pixels depending on page height.
- Mask region: y=0 to y=50, full width, all pages, until cookie banner is implemented
- Per-page threshold bump: not needed if masked

## macOS floating toolbar (Astro dev mode)

- A system-level floating toolbar (magnifier/accessibility bar) appears in some local screenshots
- This is an OS artefact, not page content
- Impact: small rectangle, mid-screen, ~1% pixels
- Mask if it recurs; or disable system accessibility features during capture runs
