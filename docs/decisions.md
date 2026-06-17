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

## 2026-06-17 — Strapi schema changes: clean rebuild when the admin won't update

After editing a schema JSON (e.g. an `enumeration`'s `enum` list), the Strapi admin can keep
showing the **old options** even after a server restart, a browser hard-refresh, and incognito.
The backend is correct (`src/`, compiled `dist/`, and the live `strapi_core_store_settings`
all agree) — the staleness lives in the compiled output / Vite admin caches and the admin's
**browser-side** schema cache.

Reliable reset for a TypeScript Strapi project:

1. Stop the dev server; confirm port 1337 is free.
2. `npm run clean` — removes `dist/`, `.strapi/`, `node_modules/.strapi`, `.cache`, `.vite`
   (all regenerated on next boot).
3. `npm run develop` (or `npm run dev:clean`, which chains both).
4. In the browser: DevTools → Application → **Clear site data** for `localhost:1337`, then
   close all admin tabs and reopen. A plain hard-refresh does **not** clear the admin's
   IndexedDB schema cache.

Verify the live enum without the admin UI by reading the internal store:
`sqlite3 cms/.tmp/data.db "SELECT value FROM strapi_core_store_settings WHERE key='strapi_content_types_schema';"`
(Strapi rewrites this from the in-memory schema on every boot.)

## 2026-06-11 — Backup Worker needs a directory owner

The content-backup Cron Worker (ADR 0004) fits none of the existing agent directories
(`scripts/` ETL, `cms/` Strapi, `web/` Astro, `qa/` harness). Proposal: a new top-level
`ops/` (or `infra/`) directory with its own owner. To be resolved before the backup Worker is
implemented; flagged here rather than silently parked in another agent's area.
