---
name: project_context
description: Key patterns observed in the rebuild relevant to a11y auditing approach
metadata:
  type: project
---

**Why:** Tracks rebuild-wide a11y patterns so future audits don't re-examine resolved or known patterns.

**How to apply:** Use when auditing new components to avoid duplicating analysis already settled.

---

- `<html lang={locale}>` is correctly set in BaseLayout. Not a finding on any page.
- Hero image alt: rebuild uses `alternativeText ?? ''` from Strapi — correct pattern. Old site had hardcoded "Alternate Text" (T3-008). The rebuild is an improvement.
- `<video autoplay loop muted>` on hero: no captions — pre-existing T3 (T3-007). Building page passes `video={null}` so irrelevant there; only applies to Home page.
- Icon-only interactive elements (close, burger, scroll arrow): all pre-existing on old site (T3-001 through T3-005). In new code these become T1 invisible wins — add aria-labels.
- Duplicate `<nav>` pattern: pre-existing T3-006. New code can add `aria-label` as T1 invisible win.
- Skip-link target `<a name="content" id="content">` in building.astro: marginally better as `<div id="content" tabindex="-1">` — flag T1/borderline for astro-builder to confirm.
