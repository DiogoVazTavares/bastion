# Context — bastiontower.com Modernisation

## Glossary

**Block**
A reusable content section that composes into a page. Corresponds to a C# Panel class in the old CMS. In the new system, each block type is a Strapi component under `cms/src/components/blocks/` and an Astro component under `web/src/components/blocks/`.

**Canonical block names**

| Strapi component | Old C# model | Description |
|---|---|---|
| `blocks.hero` | `IHeroBlock` | Full-width banner: title, cover text, image, optional video |
| `blocks.paragraph` | `PanelText` | Title + HTML body + show/show_title/background_color |
| `blocks.paragraph-image` | `PanelTextImage` | Title + HTML body + image + show/show_title/background_color |
| `blocks.building` | `PanelBuilding` | Ordered items with big image, small image, title, HTML text |
| `blocks.partners` | `PanelPartners` | Title + HTML text + image array |
| `blocks.slider` | `PanelSlider` | Title + slides (image slide or text slide) |
| `blocks.info` | `PanelInfo` | Title + columns with image + HTML text |
| `blocks.floors` | `PanelFloors` | Title + intro text + floor items with lightbox images |
| `blocks.map` | `PanelMap` | Title + building coordinates + place markers with category |
| `blocks.distances` | `PanelDistances` | Title + transport-mode groups each with place/minutes items |
| `blocks.checkers-home` | `HomePanelCheckers` | Cards with image, title, HTML text, link (always green) |
| `blocks.checkers-services` | `ServicesPanelCheckers` | Two subtypes: image-checker and icon-checker |

**Dynamic zone**
A Strapi field that holds an ordered array of heterogeneous block components. Used on all multi-block page single-types (Building, Accommodation, Services, Location, Home). Allows editors to add, reorder, and remove blocks freely.

**Flat schema**
A Strapi single-type where content fields live directly on the entry with no dynamic zone. Used for single-block pages: Terms and Credits.

**Hero**
The full-width banner at the top of most pages. Fields: `title` (multiline text), `hero` (cover text), `image` (media, not localised), `video` (media, not localised, Home only). Not a dynamic zone block — fields are directly on the page single-type.

**Page slice**
The primary unit of work in this project. A page slice delivers one complete page end-to-end: Strapi single-type schema → ETL migration script → Astro page component rendering at all three locales (`/en`, `/fr`, `/nl`).

**Sub-slice**
A single block type's implementation within a page slice. A sub-slice is complete when: the Strapi component schema exists, the ETL produces correct data for that block, and the Astro component renders it correctly.

**Locale**
One of three language variants: `en` (default), `fr`, `nl`. All three variants are stored in a single Strapi entry with i18n fields. In the old system they were separate MongoDB databases.

**ETL**
The one-time migration scripts under `scripts/` that read content from the three MongoDB databases and write it into Strapi. Each page has its own script (`scripts/migrate-[page].js`). Shared infrastructure lives in `scripts/lib/`.
