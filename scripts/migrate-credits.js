#!/usr/bin/env node
/**
 * ETL: Credits  —  MongoDB (3 locale DBs) → Strapi i18n single type
 *
 * Identity key: single-type singleton (one document per locale DB).
 * Idempotency: putLocale issues a PUT (last-write-wins). Re-running is safe.
 *
 * Required env vars:
 *   MONGO_URL_EN     Full MongoDB URI for the English DB   (includes auth + dbname)
 *   MONGO_URL_FR     Full MongoDB URI for the French DB
 *   MONGO_URL_NL     Full MongoDB URI for the Dutch DB
 *   STRAPI_URL       e.g. https://your-instance.strapiapp.com
 *   STRAPI_TOKEN     Scoped Strapi API token (content write, no admin)
 *
 * Run:
 *   cd scripts && npm install
 *   MONGO_URL_EN=... MONGO_URL_FR=... MONGO_URL_NL=... \
 *   STRAPI_URL=https://... STRAPI_TOKEN=... \
 *   LEGACY_SERVER_URL=https://www.bastiontower.com \
 *   node migrate-credits.js
 */

import { LOCALES, fetchLocaleDocuments } from './lib/mongo.js';
import { validateStrapiEnv, putLocale, uploadMedia } from './lib/strapi.js';
import { buildCreditsPayloads } from './lib/credits.js';
import { loadManifest, saveManifest } from './lib/assets.js';
import { extractAssetUrls, rewriteAssetUrls } from './lib/html.js';

const HTML_MANIFEST_PATH = './.html-asset-manifest.json';

const MONGO_URLS = {
  en: process.env.MONGO_URL_EN,
  fr: process.env.MONGO_URL_FR,
  nl: process.env.MONGO_URL_NL,
};

function validateEnv() {
  const missing = LOCALES.filter(l => !MONGO_URLS[l]).map(l => `MONGO_URL_${l.toUpperCase()}`);
  if (!process.env.LEGACY_SERVER_URL) missing.push('LEGACY_SERVER_URL');
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  validateStrapiEnv();
}

async function main() {
  validateEnv();

  // 1. Read Credits from all three Mongo DBs
  console.log('Reading from MongoDB…');
  const docs = {};
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] connecting… `);
    const result = await fetchLocaleDocuments({ [locale]: MONGO_URLS[locale] }, 'Credits');
    docs[locale] = result[locale];
    console.log('✓');
  }

  // 2. Build payloads (background_color propagated from en via applyNonLocalised)
  const payloads = buildCreditsPayloads(docs);

  // 3. Normalize HTML: upload inline legacy assets and rewrite their URLs
  const legacyBase = process.env.LEGACY_SERVER_URL;
  const legacySrcs = new Set(
    LOCALES.flatMap(locale => extractAssetUrls(payloads[locale].text ?? ''))
           .filter(url => url.startsWith(legacyBase) || url.startsWith('/'))
  );

  if (legacySrcs.size > 0) {
    console.log(`\nUploading ${legacySrcs.size} inline HTML asset(s)…`);
    const htmlManifest = await loadManifest(HTML_MANIFEST_PATH);
    const srcToUrl = {};
    let uploaded = 0, reused = 0;

    for (const src of legacySrcs) {
      if (htmlManifest[src] !== undefined) {
        srcToUrl[src] = htmlManifest[src];
        reused++;
        continue;
      }
      process.stdout.write(`  ${src}… `);
      const fetchUrl = src.startsWith('/') ? `${legacyBase}${src}` : src;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`fetch ${fetchUrl}: ${res.status} ${res.statusText}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = src.split('/').pop()?.split('?')[0] || 'asset';
      const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
      const media = await uploadMedia(filename, buffer, mimeType, '');
      srcToUrl[src] = media.url;
      htmlManifest[src] = media.url;
      uploaded++;
      console.log('✓');
    }

    await saveManifest(HTML_MANIFEST_PATH, htmlManifest);
    console.log(`  Uploaded: ${uploaded}  Reused: ${reused}`);

    for (const locale of LOCALES) {
      payloads[locale] = { ...payloads[locale], text: rewriteAssetUrls(payloads[locale].text, srcToUrl) };
    }
  }

  // 4. Write to Strapi — default locale (en) first, then fr, then nl
  console.log('\nWriting to Strapi…');
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] `);
    await putLocale('credits', locale, payloads[locale]);
    console.log('✓');
  }

  // 5. Per-locale summary
  console.log('\nSummary:');
  for (const locale of LOCALES) {
    const { title, text } = payloads[locale];
    const titlePreview = String(title ?? '').slice(0, 60) || '(null)';
    const textLen = String(text ?? '').length;
    console.log(`  [${locale}]  title="${titlePreview}"  text=${textLen} chars`);
  }

  console.log(`\nDone. Open ${process.env.STRAPI_URL}/admin to verify.`);
}

main().catch(err => {
  console.error('\n' + (err.stack ?? err.message));
  process.exit(1);
});
