---
name: project_issue20_accommodation
description: A11y audit findings for issue #20 — Accommodation page (Floors.astro lightbox, deep-link auto-open, page wire-up)
metadata:
  type: project
---

Audited 2026-06-23 against WCAG 2.2 AA.

**Why:** Issue #20 wires up the Accommodation page and introduces: Floors.astro lightbox
(embedded fragment, no XHR), deep-link static pages `[uid].astro`, `autoOpenUid` prop,
history.pushState/replaceState on open/close.

**How to apply:** Tier 1 items for astro-builder application. Tier 2 items for
docs/a11y-exceptions.md queue. Tier 3 items in [[tier3_preexisting]] — never re-report.

---

## Key facts

- Old `_Lightbox.cshtml` + `Lightbox.ts`: no `role="dialog"`, no `aria-modal`, no focus
  management (no `focus()` call on open, no focus return on close, no focus trap). The
  rebuild reproduces this exactly.
- Old `_Floors.cshtml` SVG `<rect>` triggers: no `tabindex`, no `role`, no `aria-label` —
  keyboard-inoperable. Old mobile items `floors__floor-mobile-item` are `<div>` with no
  `tabindex`/`role` — also keyboard-inoperable.
- The rebuild Floors.astro reproduces both patterns exactly (no tabindex/role on either rect
  or mobile div).
- No `aria-modal` or `role="dialog"` in either old or new lightbox container (div injected
  by JS into `document.body`).
- `closeLightbox()` in new code: no `history.replaceState` guard on the `.` path — only
  replaces state if `history.state?.lightboxUid` is set. Correct.
- Auto-open on cold load fires in `init()` via `data-autoopen-uid` attribute — no
  announcement to screen readers on page load (same as old site's URL-suffix auto-open).
- Deep-link pages `[uid].astro` render identical markup to `accommodation.astro` plus pass
  `autoOpenUid` — no extra accessibility concerns vs the base page.
- The `<div class="floors__lightboxes" hidden aria-hidden="true">` correctly hides the
  fragment store from all users (AT + visual) until the lightbox opens.
- `#content` skip target on accommodation pages is `<div id="content" tabindex="-1">` —
  correct pattern per T1-BUILD-07 resolution.

## T1 findings (apply immediately — astro-builder)

### T1-FL-01 — Lightbox close button has no accessible name
- File: `web/src/components/blocks/Floors.astro` line 190
- Element: `<a class="icon icon--close-circle lightbox__close" data-behavior="lightbox-close" />`
- Fix: add `aria-label="Close lightbox"`
- WCAG: 4.1.2 (AA)
- Old site: `_Lightbox.cshtml` line 32 — identical `<a class="icon icon--close-circle lightbox__close">` with no label. This IS a Tier 3 pre-existing issue in terms of the static template. However the rebuild has latitude to add `aria-label` as an additive-only attribute with zero rendering impact — treat as T1 invisible win, not T3.
- Note: The lightbox container div is created dynamically by JS cloning the fragment. The `aria-label` on the close element will clone through correctly.

### T1-FL-02 — Lightbox prev/next controls have no accessible names
- File: `web/src/components/blocks/Floors.astro` lines 195-203
- Elements: `<a class="icon icon--arrow-circle-left lightbox__control lightbox__control--previous">` and `--next`
- Fix: add `aria-label="Previous image"` and `aria-label="Next image"` respectively
- WCAG: 4.1.2 (AA)
- Old site: same markup, no labels — pre-existing. But additive aria-label is invisible win.

## T2 findings (queue — human approval required)

### T2-FL-01 — Lightbox container has no role="dialog" / aria-modal
- Severity: Serious
- File: `web/src/components/blocks/Floors.astro` — openLightbox() (lines 272-306)
- Issue: The div created by `openLightbox()` and injected into `<body>` has no `role="dialog"`,
  `aria-modal="true"`, or `aria-label`. Screen readers do not announce it as a dialog and
  do not constrain virtual reading cursor to its contents. Users can navigate past it.
- WCAG: 4.1.2 (AA) — name, role, value
- Exact change needed: In `openLightbox()` set `container.setAttribute('role', 'dialog')`,
  `container.setAttribute('aria-modal', 'true')`, and
  `container.setAttribute('aria-label', source.querySelector('.lightbox__inner')?.getAttribute('data-lightbox-title') ?? 'Gallery')`. Alternatively add these attributes to the static `<div class="our-lightbox__container">` template or set them in JS after clone.
- Parity impact: None — purely additive ARIA attributes, zero rendering change. Would
  normally be T1, BUT requires structural JS change (not just a static attribute), so T2
  for human review.
- Old site: `Lightbox.ts` _Init() creates the container div with no role/aria-modal —
  pre-existing pattern. Rebuild is an opportunity for an invisible win.

### T2-FL-02 — Focus not moved into lightbox on open; not returned on close
- Severity: Serious
- File: `web/src/components/blocks/Floors.astro` — openLightbox() / closeLightbox() (lines 260-306)
- Issue: When the lightbox opens, focus stays on the triggering element (SVG rect or mobile
  div). When it closes, focus is not explicitly returned. No focus trap inside the lightbox.
  WCAG 2.4.3 requires focus to move to the dialog; WCAG 2.1.2 requires focus not to be
  trapped except intentionally within a dialog (i.e. a proper trap is needed).
- WCAG: 2.4.3 (AA), 2.1.2 (A), 2.1.1 (A) — close button unreachable by keyboard at all
- Exact change needed: On open — store `document.activeElement`, call `.focus()` on the
  close button or first focusable element in container. Add focus trap (Tab cycles within
  container). On close — return focus to the stored element.
- Parity impact: JS-only change, zero visual/rendering impact. BUT requires JS restructuring.
- Old site: `Lightbox.ts` has no focus management at all — pre-existing. However because
  the old site's triggers (SVG rect, mobile div) are themselves keyboard-inaccessible (T2-FL-03),
  the focus issue could never be reached by keyboard anyway. The rebuild inherits both.

### T2-FL-03 — SVG rect triggers are keyboard-inaccessible; mobile div triggers too
- Severity: Serious
- File: `web/src/components/blocks/Floors.astro` lines 111-125 (SVG rect), 133-150 (mobile div)
- Issue: SVG `<rect>` elements and `.floors__floor-mobile-item` divs have click listeners
  wired in JS but no `tabindex`, `role`, or keyboard event handler (`keydown` Enter/Space).
  Neither is focusable or operable by keyboard.
- WCAG: 2.1.1 (A)
- Exact change needed: Add `tabindex="0"` + `role="button"` + `aria-label` (the floor label
  text) to each `<rect>` and mobile `<div>`. Add `keydown` Enter/Space handler in init().
- Parity impact: `tabindex`/`role`/`aria-label` are additive. For SVG `<rect>`, these are
  valid SVG attributes. Floor label text is already available as `floor.text`.
- Old site: `_Floors.cshtml` line 96 — `<rect>` with no tabindex/role. Line 567 — mobile
  `<div>` with no tabindex/role. Exact same pattern. Pre-existing. This is therefore T3
  for reporting purposes, BUT separately documented here as T2 because the JS-only fix
  is available and invisible.
- Decision note: Because old site has the same fault, this is technically T3. Logging as
  T2 entry in exceptions queue so the human can choose whether to take the invisible-win JS
  fix. Not re-reporting as a live issue — logging once.

## T3 findings added to [[tier3_preexisting]] this audit

- T3-015: Lightbox close `<a>` has no accessible name — pre-existing in `_Lightbox.cshtml`.
  T1-FL-01 is the invisible-win opportunity on new code.
- T3-016: Lightbox prev/next `<a>` controls have no accessible names — pre-existing.
  T1-FL-02 is the invisible-win opportunity.
- T3-017: Lightbox has no role/aria-modal — pre-existing in `Lightbox.ts _Init()`. T2-FL-01.
- T3-018: No focus management on lightbox open/close — pre-existing. T2-FL-02.
- T3-019: SVG rect and mobile div triggers keyboard-inaccessible — pre-existing in
  `_Floors.cshtml` lines 96 & 567. T2-FL-03.

## Screen reader / deep-link announcement

The deep-link auto-open fires synchronously in `init()` before the browser announces the
page to the screen reader. Because the page has fully loaded by the time a screen reader
user navigates it, the lightbox will be open but unannounced (no `aria-live` region, no
`role="dialog"`). This compounds T2-FL-01: once role/aria-modal is added, the SR will
announce the dialog on page load. Currently the deep-link experience for SR users is
effectively a silent open — same as the old site's URL-suffix auto-open.

## Notable positives

- `alt={image.alternativeText ?? ""}` on lightbox slide images — correct decorative fallback,
  same pattern validated in issues 12/13/14.
- `<div class="floors__lightboxes" hidden aria-hidden="true">` — both `hidden` and
  `aria-hidden="true"` used together correctly hide the fragment store from all users.
- `data-slider-autoplay="false"` on the lightbox slider — no autoplay concern inside the
  lightbox (T3-012 does not apply here).
- Escape key handler added in `init()` (new in rebuild vs old Lightbox.ts) — improvements
  over old site even without structural changes.
- `<div id="content" tabindex="-1">` skip target — correct per T1-BUILD-07.
