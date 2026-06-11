---
name: contact-layout-section
description: Contact is a shared layout section (not a page); issue #6 spec contained erroneous SEO meta fields that were correctly omitted
metadata:
  type: project
---

Contact (`old/Models/Contact.cs`) is NOT a standalone page. It is a shared layout section — the green band before the footer, anchored to `#contact` — rendered on every page. Fields: `Title` (string, localised) and `Text` (HTML, localised) only.

**Why:** Issue #6 spec incorrectly listed `browser_title` and `google_description`. The C# source contradicts this; Contact has no SEO meta, no hero, no `show`/`show_title`/`background_color`. Those fields belong to page types that inherit `PanelText`, not to Contact.

**How to apply:** If any future issue or ETL script adds SEO meta or page-level fields to the Contact single-type, flag it as a spec error and refer back to `old/Models/Contact.cs`.
