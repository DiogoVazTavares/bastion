# bastion — Claude Code project conventions

Modernisation of bastiontower.com: legacy our.cms (.NET Core 1.1) + 3× MongoDB → **Strapi
Cloud (CMS) + Astro SSG on Cloudflare Pages**. This is a **parity rebuild** — design,
content, structure, URLs, and the editing experience all stay the same. The fragile
infrastructure underneath is replaced.

Read `docs/CONTEXT.md` for the glossary (blocks, page slice, sub-slice, locales, ETL).

Be extremely concise. Sacrifice grammar for the sake of concision.

## Prime directives

1. **The model must not change.** The legacy C# model under `old/` is the source of truth.
   Strapi mirrors it as close to 1:1 as physically possible. Deviations are allowed only
   where Strapi cannot represent the C# structure, and every one is logged in
   `docs/model-mapping.md`.
2. **Pixel parity.** Markup and class names are reproduced exactly; the legacy LESS is
   lifted as source and not edited. Styling deviations are bugs.
3. **`old/` is immutable.** It holds the C#, LESS, and TS ground truth. Nobody writes there.

## Directory ownership

| Directory | Owner | Notes |
|---|---|---|
| `cms/` | content-architect | Strapi schemas, components, CKE5 config |
| `scripts/` | migration-engineer | Mongo → Strapi ETL; shared code in `scripts/lib/` |
| `web/` | astro-builder | Astro site; lifted LESS; ported TS widgets |
| `qa/` | parity-qa | verification harness |
| `old/` | nobody (read-only) | legacy C# / LESS / TS — the mapping source of truth |
| `docs/` | content-architect maintains `model-mapping.md`; all read | shared contract & vocab |
| `.claude/` | human | agents, skill, hooks |

Boundaries are enforced by `scripts/claude-hooks/enforce-paths.sh` (a `PreToolUse` hook in
each writer agent). Cross-cutting notes go in `docs/decisions.md` (writable by all). If work
seems to belong to another agent's area, STOP and report — never work around the boundary,
because silent cross-directory edits cause contract drift.

## The agents

- **content-architect** (opus) — Strapi model; owns `docs/model-mapping.md`.
- **migration-engineer** (sonnet) — idempotent ETL; runs against live systems on `default`
  permission mode.
- **astro-builder** (sonnet) — Astro pages/blocks; exact markup; ported vanilla-TS widgets.
- **parity-qa** (sonnet) — Playwright + pixelmatch harness; read-only on product code.
- **a11y-auditor** (sonnet) — WCAG 2.2 AA, three-tier remit; read-only on product code.

All five use `memory: project` (`.claude/agent-memory/<agent>/`). **No credentials, no
client PII, ever go in memory, prompts, issue comments, or PRs.**

## Content model facts (see docs/CONTEXT.md + docs/model-mapping.md)

- Pages are Strapi **single-types**. Multi-block pages (Building, Accommodation, Services,
  Location, Home) carry a `blocks` **dynamic zone**; Terms and Credits are flat.
- **Hero** = page-level fields (`title`, `hero`, `image`, `video` Home-only); `image`/`video`
  are NOT localised. Meta fields (`browser_title`, `google_description`, `footer_title`) live
  on the single-type, localised.
- C# inheritance **flattens** into Strapi components (shared base fields copied in).
- Polymorphic sub-lists use a **`kind` enum** repeatable component (`slider-slide`,
  `service-checker`) to preserve mixed-type ordering — forced deviations, logged.

## i18n & URLs

- Locales: `en` (default), `fr`, `nl`, all in one Strapi entry via i18n fields.
- Slugs are **translated per locale**; routes come from a localised `slug` field. Site
  renders at `/en`, `/fr`, `/nl`.
- The build output must exactly match `docs/url-inventory.md`. Unreproducible old URLs
  become explicit 301s in Cloudflare Pages `_redirects`, logged in `docs/decisions.md`.

## Migration rules

- ETL is **idempotent** (re-runnable; last-run-wins). Document the identity key per
  page/block. Media de-duplicates.
- Write order **en → fr → nl** (default locale must exist first).
- **Mongo access is read-only** (dedicated read-only user). Strapi uses a **scoped API
  token** (content write, no admin). Secrets in `.env` (gitignored), read via
  `validateEnv()`.
- **Old CMS is the source of truth until cutover.** Don't edit content in Strapi except to
  test; the full ETL re-runs shortly before DNS cutover.

## Rich text / CKE5

CKE5 silently strips markup it isn't configured for. Flow: migration-engineer inventories
the HTML actually present → content-architect configures CKE5 General HTML Support to cover
exactly that → parity-qa runs a round-trip test. Garbage markup is handled by a short,
explicit, documented normalization whitelist in the ETL (visual parity, not byte parity).

## A11y remit

"No regressions + invisible wins." Tier 1 (invisible attributes) applied freely; Tier 2
(structural/visual) only via the `docs/a11y-exceptions.md` approval queue; Tier 3
(pre-existing on old site) logged once and ignored. No stated compliance driver assumed.

## Workflow

Work is driven by GitHub issues (one per page/block, with `Blocked by` dependencies and a
`ready-for-agent` label). Invoke the **`work-issue`** skill: "work issue 12". It gates on
dependencies, dispatches to the agents in order, verifies against the acceptance criteria,
and opens a **PR per issue** (`Closes #N`, criteria checklist, parity evidence). The human
is the merge gate. Verification runs against Cloudflare Pages **preview deploys**.


While talking to me, be extremely concise. Sacrifice grammar for the sake of concision.
