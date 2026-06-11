# ADR 0002 — Dynamic zones for multi-block pages; flat schemas for single-block pages

**Date:** 2026-06-11  
**Status:** Accepted

## Context

Pages in the old CMS fall into two categories:

1. **Single-block pages** (Terms, Credits): each has exactly one content section with a fixed field structure. No editor can add or reorder sections.
2. **Multi-block pages** (Building, Accommodation, Services, Location, Home): each has an ordered sequence of heterogeneous block types. The old CMS allowed editors to add, reorder, and remove block instances.

In Phase 0, Terms was implemented with a flat Strapi schema — all fields directly on the single-type entry, no components. This worked because Terms is always one block.

When planning the remaining pages, two options were evaluated for multi-block pages:

- **Flat fields per block slot**: each page schema has named fields for each expected block (`panel_building`, `panel_partners`, etc.). Simple to query. Editors cannot reorder or add blocks.
- **Dynamic zones**: each page schema has a `blocks` dynamic zone. Block types are Strapi components. Editors can add, reorder, and remove blocks freely.

## Decision

Use **dynamic zones** for all multi-block pages. Keep **flat schemas** for Terms and Credits (already done in Phase 0; no reason to change).

## Rationale

The flat approach would require knowing the exact number and order of blocks per page at schema-design time, and would silently break if a page in production had more instances than the schema anticipated. The dynamic zone approach matches the editorial model from the old CMS — blocks are ordered sequences, not named slots.

Terms and Credits are not changed because they are already deployed and have no multiple-block requirement.

## Consequences

- All block types are defined as Strapi components under `cms/src/components/blocks/`.
- Multi-block page single-types have a `blocks` dynamic zone field listing which component types are allowed.
- ETL scripts must build an ordered array of block objects rather than posting flat fields.
- Astro pages iterate over the `blocks` array and render the appropriate component for each entry.
- Terms and Credits remain flat — their ETL and Astro pages do not use the `blocks` pattern.
