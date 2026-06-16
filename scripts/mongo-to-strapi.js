#!/usr/bin/env node
/**
 * ETL: Terms  —  MongoDB (3 locale DBs) → Strapi i18n single type
 *
 * Required env vars:
 *   MONGO_URL_EN     Full MongoDB URI for the English DB   (includes auth + dbname)
 *   MONGO_URL_FR     Full MongoDB URI for the French DB
 *   MONGO_URL_NL     Full MongoDB URI for the Dutch DB
 *   STRAPI_URL       e.g. http://localhost:1337
 *   STRAPI_TOKEN     Full-access Strapi API token
 *
 * Run:
 *   cd scripts && npm install
 *   MONGO_URL_EN=... MONGO_URL_FR=... MONGO_URL_NL=... \
 *   STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=... \
 *   node mongo-to-strapi.js
 */

import { LOCALES, fetchLocaleDocuments } from './lib/mongo.js';
import { validateStrapiEnv, putLocale } from './lib/strapi.js';
import { buildTermsPayloads } from './lib/terms.js';

const MONGO_URLS = {
  en: process.env.MONGO_URL_EN,
  fr: process.env.MONGO_URL_FR,
  nl: process.env.MONGO_URL_NL,
};

function validateEnv() {
  const missing = LOCALES.filter(l => !MONGO_URLS[l]).map(l => `MONGO_URL_${l.toUpperCase()}`);
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  validateStrapiEnv();
}

async function main() {
  validateEnv();

  // 1. Read Terms from all three Mongo DBs with per-locale progress feedback
  console.log('Reading from MongoDB…');
  const docs = {};
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] connecting… `);
    const result = await fetchLocaleDocuments({ [locale]: MONGO_URLS[locale] }, 'Terms');
    docs[locale] = result[locale];
    console.log('✓');
  }

  // 2. Preview the text field so the user can verify HTML survives the roundtrip
  console.log('\nText field preview (first 300 chars per locale):');
  for (const locale of LOCALES) {
    const preview = String(docs[locale].Text ?? '').slice(0, 300);
    console.log(`\n  [${locale}]\n  ${preview || '(empty)'}`);
  }
  console.log();

  // 3. Warn if custom-style span tags are absent
  const enText = String(docs.en.Text ?? '');
  if (!enText.includes('<span class=')) {
    console.warn('  ⚠  No <span class="..."> found in EN text — custom style roundtrip will not be exercised.');
  }

  // 4. Write to Strapi — default locale (en) first, then fr, then nl
  console.log('Writing to Strapi…');
  const payloads = buildTermsPayloads(docs);
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] `);
    await putLocale('terms', locale, payloads[locale]);
    console.log('✓');
  }

  console.log(`\nDone. Open ${process.env.STRAPI_URL}/admin to verify.`);
}

main().catch(err => {
  console.error('\n' + (err.stack ?? err.message));
  process.exit(1);
});
