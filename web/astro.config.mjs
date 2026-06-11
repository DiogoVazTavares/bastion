// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',

  vite: {
    css: {
      preprocessorOptions: {
        // Less 4.x defaults to parens-only division; old Gulp build used Less 3.x which always computed math
        less: { math: 'always' },
      },
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'nl'],
    routing: {
      prefixDefaultLocale: true,
    },
  },

  adapter: cloudflare(),
});