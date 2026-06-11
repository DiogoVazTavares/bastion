#!/usr/bin/env node
/**
 * ETL: Contact  —  MongoDB (3 locale DBs) → Strapi i18n single type
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
 *   node migrate-contact.js
 */

import { LOCALES, fetchLocaleDocuments } from './lib/mongo.js';
import { validateStrapiEnv, putLocale } from './lib/strapi.js';
import { buildContactPayloads } from './lib/contact.js';

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

  // 1. Read Contact from all three Mongo DBs
  console.log('Reading from MongoDB…');
  const docs = {};
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] connecting… `);
    const result = await fetchLocaleDocuments({ [locale]: MONGO_URLS[locale] }, 'Contact');
    docs[locale] = result[locale];
    console.log('✓');
  }

  // 2. Build payloads
  const payloads = buildContactPayloads(docs);

  // 3. Write to Strapi — default locale (en) first, then fr, then nl
  console.log('\nWriting to Strapi…');
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] `);
    await putLocale('contact', locale, payloads[locale]);
    console.log('✓');
  }

  // 4. Per-locale summary
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
