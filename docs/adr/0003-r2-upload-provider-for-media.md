# ADR 0003 — Media assets hosted in Cloudflare R2 via Strapi upload provider

**Date:** 2026-06-11
**Status:** Accepted

## Context

The legacy CMS stores media as files on the old server, referenced from MongoDB by
`FileRef.Src` (an absolute URL). The migration must move these bytes somewhere durable and
rewrite every reference — both the structured `PictureRef` fields and the inline `<img src>`
/ `<a href>` URLs embedded in rich-text bodies — to point at the new location.

Two hosting options were evaluated:

- **Strapi Cloud default media storage.** Zero extra config. But media URLs live on the
  Strapi Cloud media domain, the public site becomes permanently coupled to the CMS vendor's
  domain (the rewritten rich-text HTML bakes that domain in), asset bandwidth is billed by
  Strapi Cloud, and — critically — the chosen Strapi Cloud plan provides **no backups** of
  that storage.
- **Cloudflare R2 via the S3-compatible upload provider.** Media URLs live on a domain we
  control; egress to Cloudflare Pages is free; R2 object versioning serves as the asset
  backup; the asset domain is decoupled from the CMS vendor.

## Decision

Configure Strapi with `@strapi/provider-upload-aws-s3` pointed at a Cloudflare **R2** bucket.
The ETL still uploads through Strapi's `/api/upload` (so the media library stays in sync);
Strapi writes the bytes to R2. Rewritten asset URLs in content and rich-text point at the
R2-backed media domain.

## Rationale

R2 collapses three problems into one decision: asset hosting domain (ours, not the vendor's),
bandwidth cost (free egress to Cloudflare), and asset backup (R2 versioning). The rich-text
URL rewrite bakes the media domain into stored content, so this choice is expensive to
reverse later — making "our own domain" the safe long-term default over the CMS vendor's.

## Consequences

- `cms/` adds the S3 provider dependency and `config/plugins` upload config (content-architect).
  R2 credentials live in `.env` / Strapi Cloud env, never in git.
- The ETL's HTML normalization must rewrite legacy `<img src>` / `<a href>` URLs to the R2
  media URL, via the same upload path as structured fields (migration-engineer).
- Enable **R2 object versioning** on the media bucket; expire noncurrent versions after
  ~120 days. Versioning protects against overwrite/accidental delete, **not** whole-bucket or
  account loss — accepted for a low-criticality brochure site.
- The public site depends on the R2-backed media domain at runtime.
- **Portability:** the public media URL (`CDN_URL` / provider `baseUrl`) is always an R2
  **custom domain**, never the raw `r2.dev` URL — this decouples baked-in content URLs from
  the specific bucket/account/CF project, so recreating the project elsewhere is a DNS
  re-point plus an idempotent ETL re-run. Domain choice resolved in docs/decisions.md.
