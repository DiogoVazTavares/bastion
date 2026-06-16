---
name: project-asset-resolver
description: Asset resolver implementation details — identity key, dedup strategy, manifest path, uploadMedia altText extension
metadata:
  type: project
---

Issue #31 implemented the asset resolver (branch `issue-31-asset-resolver`).

**Identity key:** `FileRef.Id` (string) — used as manifest key and within-run dedup key.

**Manifest path:** `./scripts/.asset-manifest.json` (relative to repo root; gitignored; created on first save).

**Cross-run idempotency:** `loadManifest` → `resolveAssets` checks `manifest[Id]` before any upload; hit = reuse with no network call.

**Within-run dedup:** `Map<Id, Promise<number>>` (`pendingById`) prevents double-upload when same Id appears for en/fr/nl refs in a single call.

**`uploadMedia` extension:** Added optional 4th param `altText`; when provided, appends `fileInfo` JSON to the FormData so Strapi sets `alternativeText` and `name` on the media record.

**Why:** Non-localised media fields (image, video) must end up identical across all locale variants; dedup is load-bearing for idempotent re-runs.

**How to apply:** When building migrate-*.js scripts that handle images, call `loadManifest` before `resolveAssets` and `saveManifest` after. Wire `uploadMedia` as the `upload` injectable.
