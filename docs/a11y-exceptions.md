# A11y exceptions — Tier 2 approval queue

Tier 2 accessibility findings require **human approval before implementation**, because each
is a deliberate, logged deviation from pixel parity. a11y-auditor documents candidates here
(via the main conversation — the auditor is read-only); the human approves or defers; once
approved, parity-qa is told so it can adjust its baseline / known-acceptable-diffs.

Tier 1 (invisible attribute fixes) are NOT logged here — astro-builder applies them as
routine work. Tier 3 (pre-existing faults on the old site) live in the auditor's memory and
are never reported again.

Baseline standard: **no regressions + invisible wins.** No stated compliance driver assumed.

## Queue

| # | Component / page | WCAG criterion | Issue | Proposed change | Parity impact | Status | Approved by / date |
|---|---|---|---|---|---|---|---|
| 1 | Slider.astro (prev/next controls) | 2.1.1 (A) | Prev/next `<a>` have no `href`/`role`/`tabindex` — not keyboard-operable (pre-existing, T3-009) | Convert to `<button>` or add `role="button" tabindex="0"` + Enter/Space `keydown` in Slider.ts | `<button>` changes element type; `tabindex` on `<a>` is invisible | proposed | |
| 2 | Slider.astro (nav dots) | 2.1.1 / 4.1.2 (A/AA) | Nav-dot `<a>` not focusable, no accessible name (pre-existing, T3-010) | `role="button" tabindex="0"` + `aria-label="Slide N"`, or `<button>`; keydown in Slider.ts | `aria-label`/`tabindex` invisible; `<button>` changes element type | proposed | |
| 3 | Slider.astro / Slider.ts | 4.1.3 (AA) | No live region — slide changes not announced (pre-existing, T3-011) | `aria-live="polite" aria-atomic="true"` on `slider__slides`, or sr-only status div updated in `_Go` | invisible / visually-hidden | proposed | |
| 4 | Slider.ts (autoplay) | 2.2.2 (A) | 4000ms autoplay, no pause on hover/focus (pre-existing, T3-012) | (a) `mouseenter`/`focus`→Pause, `mouseleave`/`blur`→Play in Discover() [JS-only]; or (b) visible pause button | (a) invisible; (b) adds a button | proposed | |
| 5 | Info.astro:30 + Paragraph.astro:27, ParagraphImage.astro:29, Partners.astro:28, Slider.astro:39 (cross-cutting) | 1.3.1 (A), 2.4.6 (AA) | Section title is `<h4>` with no `<h2>`/`<h3>` ancestor — skipped heading level (old site used `<h1>`, also wrong). Surfaced auditing #14. | `<h4 class="section__title">` → `<h2 class="section__title">` in all five files | None — `.section__title` styled by class only | proposed | |

## Approved changes — handoff to parity-qa

Once a row is approved, summarise the visual delta here so parity-qa can mask/accept it:

- _(none yet)_
