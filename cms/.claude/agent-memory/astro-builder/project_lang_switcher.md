---
name: project_lang_switcher
description: How the language switcher resolves per-page locale URLs via currentSlug prop
metadata:
  type: project
---

Chain: page passes `currentSlug="<slug>"` to `<BaseLayout>`. BaseLayout forwards it to `<SiteHeader>`. SiteHeader builds lang hrefs as `/${lang}/${currentSlug}` when present, falling back to `/${lang}/terms` when absent (for pages not yet wired up).

**Why:** The old switcher hardcoded `/[locale]/terms` for all pages — broken. currentSlug is the minimal fix that doesn't require a route map.
**How to apply:** Every new page must pass its slug string as `currentSlug` to BaseLayout. When translated slugs differ per locale this approach will need a `localeSlugs` map instead — note that deviation when it arises.
