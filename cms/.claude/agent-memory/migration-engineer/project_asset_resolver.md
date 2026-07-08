---
name: project-asset-resolver
description: Asset resolver implementation details — identity key, dedup strategy, manifest path, uploadMedia altText extension
metadata:
  type: project
---

Issue #31 implemented the asset resolver. Issue #20 (BUG-4) extended it with caption backfill.

**Identity key:** `FileRef.Id` (string) — used as manifest key and within-run dedup key.

**Manifest path:** `./scripts/.asset-manifest.json` (relative to repo root; gitignored; created on first save).

**Cross-run idempotency:** `loadManifest` → `resolveAssets` checks `manifest[Id]` before any upload; hit = reuse with no network call.

**Within-run dedup:** `Map<Id, Promise<number>>` (`pendingById`) prevents double-upload when same Id appears for en/fr/nl refs in a single call.

**`uploadMedia` extension (BUG-4):** Sets both `alternativeText` and `caption` to the same `altText` value in `fileInfo`. Legacy `_Slider.cshtml:28,32` uses one `Image.Legend` for both the `alt` attribute and `<figcaption>`, so the two fields must match.

**Caption backfill (BUG-4):** `resolveAssets` accepts an optional `updateInfo` injectable (`(strapiId, fileInfo) => Promise`). On a manifest hit, if `altText` is non-empty and the file's `caption` is null, calls `updateInfo` to patch the existing file. This makes re-runs idempotent for caption even on images uploaded before the field was added.

**`updateMediaInfo` in strapi.js:** `POST /api/upload?id=<strapiId>` with multipart `fileInfo` field. Confirmed working on Strapi v5 local instance.

**`showTitle ?? false` for PanelInfo (BUG-3):** MongoDB.Driver omits C# bool fields serialised at their default value (false). A missing `ShowTitle` means `false`, not `true`. Only PanelInfo exhibits this in Accommodation data — all other panel types store `ShowTitle: true` explicitly. `mapInfo()` in `blocks.js` uses `?? false`. Other mappers (`mapParagraph`, `mapSlider`, `mapFloors`, `mapBuilding`, `mapPartners`) remain `?? true` as their data confirms explicit storage.

**Why:** Non-localised media fields (image, video) must end up identical across all locale variants; dedup is load-bearing for idempotent re-runs. Caption is required by Slider.astro for `<figcaption>`.

**How to apply:** When building migrate-*.js scripts that handle images, call `loadManifest` before `resolveAssets` and `saveManifest` after. Wire `uploadMedia` as the `upload` injectable and `updateMediaInfo` as the `updateInfo` injectable. Pass `updateInfo` through any intermediate mapPanel-style functions.
