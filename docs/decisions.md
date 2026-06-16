# Cross-cutting decisions

Short, cross-directory notes that don't warrant a full ADR. Writable by all agents.
For architectural decisions with lasting trade-offs, see `docs/adr/`.

---

## 2026-06-11 — Asset migration: fetch from live old site, dedup via manifest

The ETL migrates media by fetching bytes directly from `FileRef.Src` (absolute URL) on the
**still-live** legacy server, then uploading through Strapi `/api/upload` (which writes to R2
— see ADR 0003).

- **Identity / dedup key:** `FileRef.Id` is stable and identical across the three locale DBs.
- **Manifest:** `scripts/.asset-manifest.json` maps `FileRef.Id` → Strapi media id. Committed,
  so it survives across the per-page ETL scripts and across re-runs (idempotency).
- **Self-healing:** before trusting a manifest hit, the ETL verifies the media id still exists
  in Strapi (`GET /api/upload/files/:id`); if gone (e.g. media library wiped on a test
  instance), it re-uploads and rewrites the manifest entry.
- **Rich-text rewrite:** HTML normalization scans `<img src>` and `<a href>` for legacy-server
  URLs, uploads each via the same manifest path, and rewrites to the R2 media URL. One physical
  file = one upload regardless of how many fields/HTML bodies reference it.
- **Dependency:** the legacy server must stay live and serving `Src` URLs until migration is
  tested. (Confirmed: it will.)

## 2026-06-11 — Media public URL: always a custom domain; final is media.bastiontower.com

Resolves the ADR 0003 open decision on the media domain (`CDN_URL` / provider `baseUrl`).

- The public media URL baked into migrated content (media relations + rewritten rich-text
  `<img src>`/`<a href>`) is **always a Cloudflare R2 custom domain, never the raw `r2.dev`
  URL** — the raw URL ties content to a specific bucket/account.
- Current work is a **spike in a temporary repo/CF project** using a temporary custom domain.
- At the move to the final repo + CF project, `CDN_URL` becomes `https://media.bastiontower.com`
  (R2 custom domain; requires the `bastiontower.com` zone on Cloudflare) and **all migrations
  re-run**. Safe because the ETL is idempotent and the old site stays live.
- **Gotcha:** `scripts/.asset-manifest.json` maps `FileRef.Id` → Strapi *media id*, which is
  instance-specific. The final project is a new Strapi instance, so **start it with a fresh
  (empty) manifest**. The self-healing `verify` step tolerates a stale manifest (every hit
  misses → re-upload), but starting clean avoids a confusing first run.

## 2026-06-11 — Backup Worker needs a directory owner

The content-backup Cron Worker (ADR 0004) fits none of the existing agent directories
(`scripts/` ETL, `cms/` Strapi, `web/` Astro, `qa/` harness). Proposal: a new top-level
`ops/` (or `infra/`) directory with its own owner. To be resolved before the backup Worker is
implemented; flagged here rather than silently parked in another agent's area.
