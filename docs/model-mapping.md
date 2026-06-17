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
2. **Polymorphic slider slides.** C# `List<SlideBase>` (image/text) → repeatable
   `slider-slide` component with `kind: image | text` + union of fields. Preserves
   mixed-type ordering.
3. **Polymorphic service checkers.** C# subtypes (image-checker/icon-checker) → repeatable
   `service-checker` component with `kind: image | icon` + union of fields.
4. **`BackgroundColor.Green` renamed to `Blue` in Strapi enum.** The C# enum value is named `Green`
   but its `[Description("Blue")]` attribute showed "Blue" in the old CMS UI, and `@color-primary`
   (`#153d86`) is navy blue — the class was always misnamed. Strapi enum uses `"Blue"` to match
   what editors see. The CSS class `section--bg-green` is kept for now and mapped at runtime;
   tracked for rename in `docs/site-wide-issues.md` (SW-4).
5. _(add: nesting-depth limits, type coercions, naming changes, CKE5/HTML handling, …)_

---

## Page single-types

### Building  ← C# `<BuildingPage?>`
Hero + meta fields on the type; `blocks` dynamic zone.

| Strapi field | C# property | Type | Localised | Notes |
|---|---|---|---|---|
| `title` | | text (multiline) | L | hero title |
| `hero` | | text | L | hero cover text |
| `image` | | media | N | hero image |
| `browser_title` | | text | L | → `<title>` |
| `google_description` | | text | L | → meta description |
| `footer_title` | | text | L | |
| `slug` | | uid/text | L | translated per locale; drives routing |
| `blocks` | | dynamic zone | — | allows: paragraph, paragraph-image, building, partners |

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
| `big_image` | `BigImage` | media (single) | N | `[Picture(Legend = "Big Image", Localized = false)]`; uploaded to media library |
| `small_image` | `SmallImage` | media (single) | N | `[Picture(Legend = "Small Image", Localized = false)]`; uploaded to media library |
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
Title + `slider-slide[]` (kind enum, deviation #2). _(field table TBD)_

### blocks.info ← `PanelInfo`
Title + columns (image + HTML text). _(field table TBD)_

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
