# Model mapping — C# (our.cms) → Strapi

**The contract.** Every Strapi content type, component, and field traces back to a named C#
class/property. Deviations are allowed only where Strapi cannot represent the C# structure,
and each is logged in "Forced deviations" below. content-architect owns this file; everyone
else consumes it.

Legend for "Localised": **L** = localised (per en/fr/nl), **N** = not localised (shared
across locale variants).

---

## Forced deviations (the full list — add as discovered)

1. **Flattened inheritance.** Strapi components do not inherit. Shared C# base-class fields
   (e.g. `show`, `show_title`, `background_color`) are copied into every component that had
   them. Logged once here as a pattern; not repeated per block.
2. **Polymorphic slider slides — dynamic zone (revised 2026-06-22).** C# `PanelSlider`
   holds a `List<ISlide>` where `SlideImage` and `SlideText` are the only two leaf types.
   The two subtypes have genuinely disjoint field shapes (`image` vs HTML `text`), so a
   dynamic zone of `blocks.slide-image` and `blocks.slide-text` is the natural 1:1 mapping
   of the C# polymorphism — each slide type is its own component, ordered freely in the
   zone. The earlier plan (a single `slider-slide` repeatable with a `kind` enum and a
   union of fields) would have forced a merged schema with one field always null; a dynamic
   zone avoids that and matches the C# inheritance structure more closely. Preserves
   mixed-type ordering.
3. **Polymorphic service checkers.** C# subtypes (image-checker/icon-checker) → repeatable
   `service-checker` component with `kind: image | icon` + union of fields.
4. **`BackgroundColor.Green` renamed to `Blue` in Strapi enum.** The C# enum value is named `Green`
   but its `[Description("Blue")]` attribute showed "Blue" in the old CMS UI, and `@color-primary`
   (`#153d86`) is navy blue — the class was always misnamed. Strapi enum uses `"Blue"` to match
   what editors see. The CSS class `section--bg-green` is kept for now and mapped at runtime;
   tracked for rename in `docs/site-wide-issues.md` (SW-4).
5. **`blocks` dynamic zones must be explicitly `localized: true` on all multi-block page single-types.**
   Strapi v5 i18n treats a dynamic zone as non-localized unless explicitly opted in. Without the
   annotation, `syncNonLocalizedAttributes` propagates the source locale's entire `blocks` payload
   (including component rows) to all other locale variants after each PUT, wiping previously-written
   locales' items. Fix: add `"pluginOptions": { "i18n": { "localized": true } }` to the `blocks`
   attribute on every multi-block page schema. Applied to `building` (2026-06-17). Must also be
   applied when Accommodation, Services, Location, and Home schemas are created.
   Tracked in `docs/decisions.md` (2026-06-17).
   _(Former deviation #5 — `building-item` image fields `localized:true` — was a workaround for a
   symptom of this root cause; reverted below once the DZ was fixed.)_
6. **`building-item` image fields reverted to `localized: false` (correction of former deviation #5).**
   C# `PanelBuilding.Item.BigImage` and `SmallImage` carry `[Picture(Localized = false)]` — correctly
   shared across locales. A prior workaround set them to `localized: true` to prevent an observed
   ID-collision cascade, but the real root cause was the `blocks` DZ missing `localized: true`
   (deviation #5 above). With the DZ now localized, `syncNonLocalizedAttributes` no longer touches
   `blocks` at all, so the ID-collision path is gone. Both fields revert to `localized: false` as
   the C# model specifies. Tracked in `docs/decisions.md` (2026-06-17).
7. _(add: nesting-depth limits, type coercions, naming changes, CKE5/HTML handling, …)_

---

## Page single-types

### Building  ← C# `Building` (`old/Models/Building.cs`)
Hero + meta fields on the type; `blocks` dynamic zone.

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | text (multiline) | L | `[Text(Multiline = true, Localized = true)]` |
| `hero` | `Hero` | text (multiline) | L | `[Text(Legend = "Titre Cover", Multiline = true, Localized = true)]` |
| `image` | `Image` | media (single, images only) | N | `[Picture(Localized = false)]` |
| `browser_title` | `BrowserTitle` | string | L | `[Text(Localized = true)]` |
| `google_description` | `GoogleDescription` | text (multiline) | L | `[Text(Multiline = true, Localized = true)]` |
| `footer_title` | _(none)_ | string | L | **Forced deviation** — absent from `Building.cs`; no C# origin. Included for operational consistency: all multi-block page single-types expose `footer_title` so editors have a uniform experience. Source of truth: issue #12. |
| `slug` | | uid/text | L | translated per locale; drives routing — issue #24 |
| `blocks` | | dynamic zone | L | allows: `blocks.paragraph`, `blocks.paragraph-image`, `blocks.building`, `blocks.partners`; forced deviation #5 (must be explicitly localized) |

_(repeat a block like this for: Accommodation, Services, Location, Home)_

### Contact ← C# `Contact`

Shared layout section (green band before the footer, anchored to `#contact`). Rendered on
every page — **not a standalone page**. No hero, no SEO meta, no show/background fields.

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Localized = true)]` — legend "Titre" |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Localized = true)]` — legend "Contact texte" |

**Forced deviation — issue #6 spec discrepancy:** Issue #6 listed `browser_title` and
`google_description` on Contact. Omitted — absent from `old/Models/Contact.cs`. Contact is
a layout section, not a page; SEO meta fields are not applicable.

### Terms / Credits (flat — no dynamic zone)

Both `terms` and `credits` are Strapi single-types with identical field shapes. `Credits` extends `PanelText` in C# (via inheritance); fields are flattened per forced deviation #1.

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | inherited from `PanelText` |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | inherited from `PanelText` |
| `show` | `Show` | boolean (default true) | L | inherited from `PanelText` |
| `show_title` | `ShowTitle` | boolean (default true) | L | inherited from `PanelText` |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Green, default White) | N | inherited from `PanelText`; forced deviation #1 |
| `footer_title` | `FooterTitle` | string | L | `[Text(Legend = "Footer title", Localized = true)]` |
| `browser_title` | `BrowserTitle` | string | L | `[Text(Legend = "Titre du navigateur", Localized = true)]` |
| `google_description` | `GoogleDescription` | text (multiline) | L | `[Text(Multiline = true, Localized = true)]` |

---

## Block components  (`blocks.*`)

For each, list every field with C# origin, type, localised flag, and any deviation. Seed
rows below from CONTEXT.md; content-architect fills the field detail per issue.

### blocks.hero ← `IHeroBlock`
Full-width banner: title, cover text, image, optional video. _(field table TBD)_

### blocks.paragraph ← `PanelText`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Legend = "Titre", Localized = true)]` |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Localized = true)]` |
| `show` | `Show` | boolean (default true) | L | `[Switch(Legend = "Show on website", Localized = true)]` |
| `show_title` | `ShowTitle` | boolean (default true) | L | `[Switch(Legend = "Show Title", Localized = true)]` |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Green, default White) | N | `[Enumeration(Localized = false)]`; forced deviation #1 (flattened inheritance) |

### blocks.paragraph-image ← `PanelTextImage`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Legend = "Panel Titre", Localized = true)]` |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Localized = true)]` |
| `image` | `Image` | media (single) | N | `[Picture(Localized = false)]` → `PictureRef`; uploaded to Strapi media library |
| `show` | `Show` | boolean (default true) | L | `[Switch(Legend = "Show on website", Localized = true)]` |
| `show_title` | `ShowTitle` | boolean (default true) | L | `[Switch(Legend = "Show Title", Localized = true)]` |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Green, default White) | N | `[Enumeration(Localized = false)]`; forced deviation #1 |

### blocks.building ← `PanelBuilding`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `show` | `Show` | boolean (default true) | L | `[Switch(Legend = "Show on website", Localized = true)]`; forced deviation #1 |
| `show_title` | `ShowTitle` | boolean (default true) | L | `[Switch(Legend = "Show Title", Localized = true)]`; forced deviation #1 |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Green, default White) | N | `[Enumeration(Localized = false)]`; forced deviation #1 |
| `items` | (children via `Model.Fluent.Leaves<IBuildingItemBlock>()`) | repeatable component (`blocks.building-item`) | L (wrapper localised) | items array |

#### blocks.building-item ← `PanelBuilding.Item`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `big_image` | `BigImage` | media (single) | N | `[Picture(Legend = "Big Image", Localized = false)]`; reverted to N — former workaround (deviation #5 was misdiagnosed; real fix is DZ `localized:true`, deviation #5) |
| `small_image` | `SmallImage` | media (single) | N | `[Picture(Legend = "Small Image", Localized = false)]`; reverted to N — same as above |
| `title` | `Title` | string | L | `[Text(Legend = "Title", Localized = true)]` |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Legend = "Texte", Localized = true)]` |

### blocks.partners ← `PanelPartners`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Legend = "Titre", Localized = true)]` |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Legend = "Texte", Localized = true)]` |
| `images` | `Images` | media (multiple) | N | `[Pictures(Legend = "Images", Localized = false)]`; all uploaded to media library |
| `show` | `Show` | boolean (default true) | L | `[Switch(Legend = "Show on website", Localized = true)]`; forced deviation #1 |
| `show_title` | `ShowTitle` | boolean (default true) | L | `[Switch(Legend = "Show Title", Localized = true)]`; forced deviation #1 |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Green, default White) | N | `[Enumeration(Localized = false)]`; forced deviation #1 |

### blocks.slider ← `PanelSlider`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Legend = "Titre", Localized = true)]` |
| `show` | `Show` | boolean (default true) | L | `[Switch(Legend = "Show on website", Localized = true)]`; forced deviation #1 |
| `show_title` | `ShowTitle` | boolean (default true) | L | `[Switch(Legend = "Show Title", Localized = true)]`; forced deviation #1 |
| `background_color` | `BackgroundColor` | enumeration (White/Lightgray/Gray/Blue, default White) | N | `[Enumeration(Localized = false)]`; forced deviation #4 (C# name is `Green`; Strapi uses `Blue` — see deviation #4) |
| `slides` | _(dynamic: `SlideImage` \| `SlideText` leaf types of `ISlide`)_ | dynamic zone (`blocks.slide-image`, `blocks.slide-text`) | L | forced deviation #2 (dynamic zone replaces kind-enum plan — see above) |

#### blocks.slide-image ← `PanelSlider.SlideImage`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `image` | `Image` | media (single, images only) | N | `[Picture(Legend = "Image", Localized = false)]` → `PictureRef` |

#### blocks.slide-text ← `PanelSlider.SlideText`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Legend = "Text", Localized = true)]` |

### blocks.info ← `PanelInfo`

Title + columns (image + HTML text). Used on Accommodation and Location page dynamic zones.

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | `Title` | string | L | `[Text(Legend="Title", Localized=true)]` |
| `show` | `Show` | boolean (default `true`) | L | `[Switch(Legend="Show on website", Localized=true)]` |
| `show_title` | `ShowTitle` | boolean (default `true`) | L | `[Switch(Legend="Show Title", Localized=true)]` |
| `background_color` | `BackgroundColor` | enumeration (`White`/`Lightgray`/`Gray`/`Blue`, default `White`) | N | `[Enumeration("background color", Localized=false)]`; deviation #4 — C# `Green` stored as `Blue` (matching `slider.json` precedent) |
| `items` | _(list of `PanelInfoItem`)_ | repeatable component `blocks.info-item` | L | nested `[Leaf]` class; localised so item order can vary per locale |

#### blocks.info-item ← `PanelInfo.PanelInfoItem`

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `image` | `Image` | media (single, images only) | N | `[Picture(Legend="Image")]` → `PictureRef`; no `Localized` flag on attribute — shared across locales |
| `text` | `Text` | CKEditor5 (`bastion` preset) | L | `[HTML(Legend="Texte", Localized=true)]` with `CustomStyles`; same CKE5 setup as `paragraph-image` and `building-item` |

### blocks.floors ← `PanelFloors`
Title + intro + floor items with lightbox images. _(field table TBD)_

### blocks.map ← `PanelMap`
Title + building coordinates + place markers (category). _(field table TBD)_

### blocks.distances ← `PanelDistances`
Title + transport-mode groups → place/minutes items (static authored data). _(field table TBD)_

### blocks.checkers-home ← `HomePanelCheckers`
Cards: image, title, HTML text, link (always green). _(field table TBD)_

### blocks.checkers-services ← `ServicesPanelCheckers`
`service-checker[]` (kind enum, deviation #3). _(field table TBD)_

---

## CKEditor 5 / rich-text configuration

Populated from migration-engineer's HTML inventory.

- **Tags/attributes/classes found in production:** _(inventory summary — TBD)_
- **General HTML Support (`htmlSupport`) config:** _(TBD — must cover exactly the above)_
- **Normalization whitelist (applied in ETL):** _(short explicit list — e.g. strip `<font>`,
  collapse empty `<p>&nbsp;</p>`; TBD)_
- **Custom-style `<span class="...">` handling:** _(Phase-0 open question — resolve from
  inventory)_
