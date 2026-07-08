---
name: block-schema-pattern
description: Strapi component schema structure for blocks.*; completed blocks tracker
metadata:
  type: project
---

## Schema location pattern
`cms/src/components/blocks/<name>.json` (flat file, not a subdirectory)

## Schema structure
```json
{
  "collectionName": "components_blocks_<snake_plural>",
  "info": { "displayName": "...", "icon": "...", "description": "<CSharpClass> — ..." },
  "options": {},
  "attributes": { ... }
}
```

## Field conventions
- Localised fields: `"pluginOptions": { "i18n": { "localized": true } }`
- Non-localised fields: `"pluginOptions": { "i18n": { "localized": false } }`
- CKEditor5: `"type": "customField", "customField": "plugin::ckeditor5.CKEditor", "options": { "preset": "bastion" }`
- Media (single image, non-localised): `"type": "media", "multiple": false, "required": false, "allowedTypes": ["images"]` + `localized: false`
- Media (multiple images, non-localised): `"type": "media", "multiple": true, "required": false, "allowedTypes": ["images"]` + `localized: false`
- Enumeration (background_color): `"type": "enumeration", "enum": ["White","Lightgray","Gray","Blue"], "default": "White"` + `localized: false` — deviation #4: C# enum value `Green` renamed to `Blue` in Strapi (the CMS UI always showed "Blue"; `#153d86` is navy blue)
- Boolean (show/show_title): `"type": "boolean", "default": true` + `localized: true`

## Forced deviation #1 — flattened inheritance
C# base-class fields (`show`, `show_title`, `background_color`) copied into every component. Strapi has no inheritance. Logged once in `docs/model-mapping.md`.

## Completed block schemas
| Block | C# source | Issue | Schema path |
|---|---|---|---|
| `blocks.paragraph` | `PanelText` | #7 | `cms/src/components/blocks/paragraph.json` |
| `blocks.paragraph-image` | `PanelTextImage` | #8 | `cms/src/components/blocks/paragraph-image.json` |
| `blocks.building` | `PanelBuilding` | #9 | `cms/src/components/blocks/building.json` |
| `blocks.building-item` | `PanelBuilding.Item` | #9 | `cms/src/components/blocks/building-item.json` |
| `blocks.partners` | `PanelPartners` | #10 | `cms/src/components/blocks/partners.json` |
| `blocks.slider` | `PanelSlider` | #13 | `cms/src/components/blocks/slider.json` |
| `blocks.slide-image` | `PanelSlider.SlideImage` | #13 | `cms/src/components/blocks/slide-image.json` |
| `blocks.slide-text` | `PanelSlider.SlideText` | #13 | `cms/src/components/blocks/slide-text.json` |

## Reference
Contact schema at `cms/src/api/contact/content-types/contact/schema.json` is the field-definition reference pattern.
