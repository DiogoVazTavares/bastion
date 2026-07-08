---
name: project-building-schema-blocker
description: Building page migration blocked: blocks dynamic zone must be localized:true to prevent i18n sync clobbering published items
metadata:
  type: project
---

The Building page migration (`scripts/migrate-building.js`) has a **remaining schema blocker**
after the earlier `big_image/small_image` fix.

## Blocker 1 — RESOLVED: building-item image fields were localized:false

Content-architect has set `big_image` and `small_image` on `building-item.json` to
`localized: true`. This fix is in place.

## Blocker 2 — ACTIVE: `blocks` dynamic zone not marked localized:true

**Symptom:** After a full en→fr→nl migration run, en and fr published have 0 building items;
only nl (last-written locale) retains its items.

**Root cause (traced in Strapi 5.48.0 source + SQLite DB):**
The `blocks` dynamiczone on `building` schema has no
`"pluginOptions": { "i18n": { "localized": true } }`.
Strapi i18n treats it as **non-localized** by default.
After each locale PUT, `syncNonLocalizedAttributes` (`@strapi/i18n localizations.js`) calls
`updateComponents` on all other same-status locale variants, using the source locale's blocks
data. This deletes and re-creates the target locales' component rows from the source locale's
data — wiping out their building-item links.

**Fix required (content-architect):**
Add `"pluginOptions": { "i18n": { "localized": true } }` to the `blocks` attribute in:
- `cms/src/api/building/content-types/building/schema.json`
- All other multi-block pages (Accommodation, Services, Location, Home) before their migrations

After schema change: `npm run clean && npm run develop` in `cms/`.

**ETL fix already committed:**
`putLocale` in `scripts/lib/strapi.js` now sends `?status=published` to write both draft and
published in one call (previously only wrote draft; published versions were stale or
inconsistent). This fix is correct and load-bearing for all migrations, not just Building.

See `docs/decisions.md` "2026-06-17 — blocks dynamic zone must be explicitly localized:true".
