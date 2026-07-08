---
name: accommodation-findings
description: Known diffs, bugs, and false positives found during issue #20 Accommodation parity check (updated after re-verification run 2026-06-23)
metadata:
  type: project
---

## False positives in check-accommodation.js

**Double-slider in blockOrder detection**: The Slider island script adds `our-slider our-slider--first-slide` classes to hidden lightbox `lightbox__inner` elements at init. These match the `\bslider\b` regex in blockOrder extraction. FIX: exclude `.floors__lightboxes` children from blockOrder scan — implemented in check-accommodation.js.

**Slide count = 25**: extractStructure counted all `[data-behavior="slider-slide"]` including 15 hidden lightbox slides. Main slider has 10 slides, 10 nav dots — correct. Use `.slider [data-behavior="slider-slide"]` for main slider count.

**Live lightbox trigger not found**: `Discover()` in old Lightbox.ts removes `data-behavior="lightbox"` on init, so Playwright can't find it by that attribute on live. The `observeLiveLightboxUrl` test always fails with "trigger not found" — this is a harness false-positive, not a parity failure.

**Live lightbox-close element hidden**: When targeting `[data-behavior="lightbox-close"]`, Playwright may resolve to the one inside the hidden `floors__lightboxes` template (not visible). Always target `.our-lightbox__container [data-behavior="lightbox-close"]`.

**`floors__lightboxes` CSS class extra in local**: The rebuilt site uses a hidden `<div class="floors__lightboxes">` to hold lightbox templates (SSG, no XHR). This class does not exist on live. Not a bug — expected difference in implementation approach.

**Info block DOM order**: DOM order is index 0 = "Specifications details" (show_title=false, no images), index 1 = "Other Features" (show_title=true, has SVG images). Harness checks use this order.

## Bugs found (issue #20) — status after 2026-06-23 re-verification

### BUG-1: Floors block missing outer section wrapper — CONFIRMED FIXED
- FIX-3: Floors.astro now renders `.section > .section__inner > h4.section__title` wrapper.
- Verified: all three locales — "Schedule of availability" (en), "Disponibilités" (fr), "Beschikbaarheid" (nl) — present with correct wrapper.

### BUG-2: section__title tag h4 vs h1 (SW-5 known deviation) — OPEN / DEFERRED
- Live uses `<h1 class="section__title">`, rebuilt uses `<h4>`.
- Harness flags this: "BLOCKS: section__title tag mismatch — prod: ["h1"], local: ["h1","h4"]"
- SW-5: deferred project-wide. Not a regression. The `h1` mismatch note appears because the nav/header has an `h1` on both sides; the block titles differ.
- Pixel impact: contributes to ~1-3% desktop diff (SW-5 height delta), masked by known-acceptable-diffs.

### BUG-3: Second info block show_title incorrectly true — CONFIRMED FIXED
- FIX-4: "Specifications details" block now has no title (show_title=false) across all locales.
- "Other Features" retains its title (en/fr/nl). Verified.

### BUG-4: Gallery slider figcaptions missing — CONFIRMED FIXED
- FIX-5: All 10 gallery slides have `<figcaption class="slider__slide-figcaption">© Gianluca Di Fabio Architects</figcaption>`.
- Verified across all 3 locales.

### BUG-5: hreflang and canonical tags absent (SEO) — OPEN (parity holds)
- Both live and rebuilt lack hreflang/canonical on Accommodation. Parity holds — not a regression.
- Still to be addressed globally (not in scope of issue #20 specifically).

### BUG-6: Lightbox slider prev/next arrows non-functional — CONFIRMED FIXED (2026-06-23 re-verify)
- **Root cause (original)**: `BaseLayout.astro` `is:inline` script had an `initSlider` function that stripped `data-behavior="slider"` from lightbox templates before clone, leaving Discover() nothing to initialise.
- **Fix applied**: duplicate `is:inline` initSlider block REMOVED from `BaseLayout.astro`. `BaseLayout.astro` now only contains ScrollSpy code in its inline script. `Slider.ts` `Discover()` with `[hidden]` guard is the sole slider initialiser. `Floors.astro` calls `DiscoverSliders()` after cloning into the live DOM.
- **Verified 2026-06-23**: all 3 locales (en uid=22, fr uid=uid-9b68e793, nl uid=uid-c2579ab3) — 3 slides each.
  - Template `.lightbox__inner` retains `data-behavior="slider"` on page load (not stripped): PASS
  - Cloned `.lightbox__inner` after open: `data-behavior=null`, `our-slider` class present (Discover ran): PASS
  - Next arrow: `translate3d(0%,0,0)` → `translate3d(-100%,0,0)`, `our-slider__slide--current` moves to 2nd slide: PASS
  - Prev arrow: `translate3d(-100%,0,0)` → `translate3d(0%,0,0)`, 1st slide current again: PASS
  - Deep-link cold-load /en/accommodation/22: lightbox auto-opens, slider initialised, next arrow works: PASS

## Lightbox URL behaviour — PASS (confirmed re-verified 2026-06-23)

**Rebuilt (all 3 locales):**
- Open: appends `/{uid}` to current path → `/{locale}/accommodation/{uid}` ✓
- Close: strips suffix back to `/{locale}/accommodation` ✓
- popstate back: closes lightbox + restores base URL ✓
- popstate forward: re-opens lightbox + restores uid URL ✓

**Live (en observed):**
- Trigger removed from DOM by Discover() — test observes "not found" (harness false-positive)

## Deep-link cold-load — PASS (all 3 locales, re-verified 2026-06-23)

- `/en/accommodation/22`: HTTP 200, `data-autoopen-uid="22"`, lightbox auto-opens ✓
- `/fr/accommodation/uid-9b68e793`: HTTP 200, lightbox auto-opens ✓
- `/nl/accommodation/uid-c2579ab3`: HTTP 200, lightbox auto-opens ✓

## Non-localised fields — PASS

- Hero image: identical URL across en/fr/nl ✓
- Slider images: identical across en/fr/nl ✓
- Floor lightbox images: identical across en/fr/nl ✓

## Info SVG icons — CONFIRMED FIXED (FIX-6)

- "Other Features" block (index 1 in DOM): 3 SVG icons present with correct `.svg` srcs
- CDN serves as `image/svg+xml` ✓
- Icon filenames: `Icon_feature_extension_blue_copie_*.svg`, `Icon_feature_storage_blue_copie_*.svg`, `Icon_transport_car_blue_copie_*.svg`

## Pixel diff results (2026-06-23 re-verification)

| Locale | Desktop | Mobile | Threshold |
|--------|---------|--------|-----------|
| en | 1.08–1.36% | 3.23–3.26% | 5% |
| fr | 1.25–1.31% | 3.13–3.14% | 5% |
| nl | 1.07–1.48% | 3.57% | 5% |

All within threshold. All PASS.

Desktop diffs (1-1.5%): nav font rendering, cookie banner top stripe (SW-3), minor image load timing differences.
Mobile diffs (3-3.6%): cookie banner mask region (top stripe proportionally larger at 375px), responsive font rendering differences, hero text layout at mobile width. All attributable to SW-3 (cookie banner) + font anti-aliasing.

## Screenshots

All saved in `qa/screenshots/accommodation/`:
- `{locale}-desktop-prod.png`, `{locale}-desktop-local.png`, `{locale}-desktop-diff.png`
- `{locale}-mobile-prod.png`, `{locale}-mobile-local.png`, `{locale}-mobile-diff.png`
- `{locale}-desktop-lightbox-open.png` (lightbox open state)
- `{locale}-desktop-deeplink-{uid}.png` (cold-load deep-link)
- `{locale}-lightbox-nav.png` (lightbox at time of nav test attempt)
