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
| 1 | _(none yet)_ | | | | | proposed / approved / deferred / rejected | |

## Approved changes — handoff to parity-qa

Once a row is approved, summarise the visual delta here so parity-qa can mask/accept it:

- _(none yet)_
