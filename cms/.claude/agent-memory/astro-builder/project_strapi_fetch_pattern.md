---
name: project_strapi_fetch_pattern
description: Shared types (BgColor, MediaRef) and fetch function conventions in strapi.ts
metadata:
  type: project
---

Shared types live at the top of strapi.ts (added after CreditsData): `BgColor`, `MediaRef`, `BuildingItemData`.

Dynamic-zone blocks are typed as discriminated unions on `__component`.

Populate param uses explicit field list: `populate=image,blocks.image,blocks.items.big_image,blocks.items.small_image,blocks.images` — prefer this over `populate=deep` to avoid over-fetching.

**Why:** Keeps the fetch surface minimal; explicit populate is Strapi v5 best practice.
**How to apply:** Reuse `BgColor` and `MediaRef` in every future page's block types. Add new shared types to strapi.ts if used by 2+ pages.
