# ADR 0004 — Content backup via scheduled REST pull to R2 (no DB dump)

**Date:** 2026-06-11
**Status:** Accepted

## Context

The chosen Strapi Cloud plan includes **no backups**. Strapi Cloud also does not expose
external database credentials, so `pg_dump` from outside is not possible. A backup strategy
is needed for the Strapi content.

Two framing facts shrink the problem:

1. **Schema/config is already in git** (`cms/`: single-types, components, dynamic zones,
   plugin config). Only **content rows** need backing up, not configuration.
2. **The old CMS is source of truth until cutover, and the full ETL re-runs before cutover.**
   So *before* cutover the Strapi DB is disposable — it can be rebuilt from MongoDB (still
   live) and R2 (assets idempotent via the manifest). Backups only protect **post-cutover
   editor changes**, which exist nowhere else. Agreed RPO: **24h**.

Mechanisms evaluated:

- **External REST pull.** A Cloudflare Cron Worker calls the Strapi REST API for every
  single-type, all locales, draft + published, serializes to JSON, writes to R2. Vendor-
  neutral, ~100 lines, human-readable/diff-able, trivial restore (re-`PUT` via API).
- **Internal `strapi export` tarball.** A scheduled task inside Strapi exports config +
  content + media metadata. More complete, but config is already in git (redundant), and it
  adds more code inside `cms/`.
- **`pg_dump`.** Not available — Strapi Cloud does not expose the database externally.

## Decision

Back up content with a **Cloudflare Cron Trigger → Worker → Strapi REST pull → JSON → R2**
(separate bucket from media). Capture **all locales** and **both draft and published** states.
Restore is re-`PUT` of the JSON through the API.

## Rationale

The content model is small and flat (single-types). A daily JSON dump is a complete,
auditable, restorable content backup, and keeping everything in the Cloudflare/R2 ecosystem
reuses the existing API token and avoids a second vendor. Deliberately **not** dumping the DB
is the surprising part worth recording: it's both impossible (no external DB access) and
unnecessary (schema in git, content in JSON).

## Consequences

- **Retention:** every daily backup kept for **120 days** in a dedicated R2 bucket.
- **Failure visibility (a silent backup is worse than none):**
  - In-Worker failure (Strapi unreachable, token expired, R2 write rejected) → **email via
    Resend** (Workers can't SMTP; MailChannels' free Workers email ended in 2024).
  - **Dead-man's-switch** via **healthchecks.io** to catch "the Worker never ran at all,"
    which an in-Worker handler cannot — emails natively when the daily ping is late (~30h).
  - Worker writes a `last-success` timestamp to R2 on success.
- **Restore drill:** one documented, executed restore (into a throwaway Strapi or a test
  locale) before cutover — proving the backup round-trips, not assuming it.
- The API token used by the Worker must be scoped to read draft + published across all locales.
- **Ownership:** the backup Worker belongs to no current agent's directory (`scripts/`,
  `cms/`, `web/`, `qa/`). It needs an explicit home and owner (e.g. a new `ops/` directory)
  before implementation — see docs/decisions.md.
