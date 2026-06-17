---
name: project_page_pattern
description: Canonical Astro page pattern — getStaticPaths, locale array, InferGetStaticPropsType
metadata:
  type: project
---

Every multi-locale page follows this pattern:

```ts
export const getStaticPaths = (async () => {
  const locales = ['en', 'fr', 'nl'];
  const pages = await Promise.all(
    locales.map(async (locale) => {
      const data = await fetchX(locale);
      return { params: { locale }, props: { data, locale } };
    })
  );
  return pages;
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
const { data, locale } = Astro.props;
```

**Why:** Established in credits.astro; keeps type inference tight with no manual Props interface.
**How to apply:** Use for every `[locale]/xxx.astro` page.
