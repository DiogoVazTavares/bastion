// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  // Astro 7 changed the default HTML whitespace handling to `'jsx'`, which
  // collapses whitespace between inline elements differently. Pin the pre-v7
  // HTML-aware behaviour to preserve pixel parity with the legacy site.
  compressHTML: true,
  vite: {
    build: {
      // Vite 8 (Astro 7) defaults CSS minification to LightningCSS, which
      // hard-errors on the legacy IE star-property hacks (`*zoom`, etc.) in the
      // lifted LESS. esbuild — the pre-Vite-8 default — passes them through as
      // before, keeping output identical to the legacy site (the immutable LESS
      // is not edited).
      cssMinify: "esbuild",
    },
    css: {
      preprocessorOptions: {
        // Less 4.x defaults to parens-only division; old Gulp build used Less 3.x which always computed math
        less: { math: "always" },
      },
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "nl"],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
