---
name: work-issue
description: >
  Drive a single GitHub issue through the full agent pipeline for the bastiontower.com
  modernisation. Invoke with "work issue <N>" (e.g. "work issue 12"). Fetches the issue,
  enforces its dependency gate, dispatches each section to the right specialist agent,
  verifies against the acceptance criteria, and opens a PR that closes the issue. Use only
  when the user explicitly asks to work/start/run a numbered issue.
---

# work-issue

You are the conductor for one GitHub issue. Subagents cannot spawn subagents, so YOU (the
main session) own this sequence. Work it top to bottom; stop at any gate that fails.

## 0. Load context

Read `docs/CONTEXT.md`, `docs/model-mapping.md`, and `docs/url-inventory.md` if not already
in context. These are the shared vocabulary and contract every step depends on.

## 1. Fetch & parse the issue

Run `gh issue view <N> --json title,body,labels,number` (and `gh issue view <N>` for the
rendered body). Extract:
- the **What to build** sections (Strapi single-type / ETL / Astro page / fixes),
- the **Acceptance criteria** checklist,
- the **Blocked by** list,
- any one-off cross-cutting tasks (e.g. the hero pattern, the language-switcher fix).

## 2. Dependency gate (HARD)

For every issue in **Blocked by**, run `gh issue view <id> --json state` and confirm it is
CLOSED. If any blocker is open, STOP and report which — do not start work. The dependency
graph is the gate that stops building a page before its blocks exist.

## 3. Branch

Create a working branch: `issue-<N>-<short-slug>` off `main`.

## 4. Dispatch by section

Map the issue's sections onto the specialist agents and invoke them in this order, passing
each only what it needs (subagents start fresh — include file paths, the issue's field
spec, and relevant decisions in the delegation prompt):

1. **content-architect** — Strapi single-type / components / dynamic zone / i18n / CKE5.
   It validates the issue's field spec against the C# source in `old/` and records the
   field-level mapping in `docs/model-mapping.md`. **Gate:** mapping rows exist for every
   field before anything downstream starts. If the issue spec and the C# source disagree,
   STOP and surface it to the human.
2. **migration-engineer** — `scripts/migrate-<page>.js` against the mapping doc (idempotent,
   en→fr→nl, shared `scripts/lib/`). Run it; collect the per-locale record-count / anomaly
   report.
3. **astro-builder** — the Astro page + block components in `web/` against the now-populated
   Strapi data; port any interactive TS; apply one-off fixes named in the issue (hero,
   lang switcher).

## 5. Verify (parallel — both read-only on product code)

- **parity-qa** — run the harness scoped to THIS issue's acceptance criteria (URL presence,
  locale variants, non-localised fields identical across locales, meta/hreflang, CKE5
  round-trip, pixel diff at both viewports). Produce the per-criterion pass/fail report and
  the screenshot gallery.
- **a11y-auditor** — tiered audit of the new/changed components.

## 6. Close the loop

Route findings back to the responsible agent (resume the same subagent where its prior
context helps) → fix → re-verify. Tier 2 a11y items go into `docs/a11y-exceptions.md` for
human approval, NOT applied automatically. Repeat until every acceptance criterion passes.

## 7. PR

Open a PR with `gh pr create`:
- title references the issue,
- body includes `Closes #<N>` and the acceptance criteria as a ticked checklist,
- post the parity report (and link/attach the screenshot gallery) as a comment.

Mark the PR ready only after the harness is green. The human is the merge gate — do not
merge.

## Notes

- `gh` must be authenticated with a fine-grained token scoped to this repo only.
- Cloudflare Pages preview deploys are on; point parity-qa at the preview URL for the PR
  evidence so verification runs against a real deployment, not just a local build.
- The old CMS is the source of truth until cutover; nobody edits in Strapi except to test.
- One issue ≈ one conversation, to keep the conductor's context clean.
