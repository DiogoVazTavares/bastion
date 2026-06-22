---
name: project_slider_conventions
description: Slider block port conventions — hammerjs, no style block, Discover() pattern, hydration decision
metadata:
  type: project
---

Block component `blocks.slider` lives at `web/src/components/blocks/Slider.astro`.
The TS port is at `web/src/scripts/Slider.ts`.

Key conventions:
- `hammerjs` 2.0.8 is a runtime dep; `@types/hammerjs` 2.0.46 is a devDep. Installed via pnpm.
- `Modernizr.prefixed()` dropped; `ApplyTransform` always uses `translate3d` (baseline).
- The `observeDOM` / MutationObserver re-scan from the original is dropped — Astro handles lifecycle.
- `<script>` in the component imports `{ Discover }` from `../../scripts/Slider` and calls it.
- No `<style>` block in the component — `@slider.less` and `@our-slider.less` are already in the global platform pipeline (`@base.less` → `components.less` → `index.less`).
- `background_color` maps to `sectionClass` using the same `bgClass` record as Partners/Paragraph blocks.
- Spike harness at `web/src/pages/_slider-spike.astro` — remove before PR.

**Why:** Approved decision: Version 1 direct port, `client:visible` hydration (slider below fold).

**How to apply:** When wiring up the slider on page templates, import `Slider.astro` and pass the `blocks.slider` DZ item fields directly. The `<script>` runs `Discover()` which scans `[data-behavior='slider']` within the component's DOM.
