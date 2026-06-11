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

import { fetchLocaleDocuments } from './lib/mongo.js';
import { validateStrapiEnv, putLocale } from './lib/strapi.js';
import { mapBackgroundColor, applyNonLocalised } from './lib/blocks.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOCALES = ['en', 'fr', 'nl'];

const MONGO_URLS = {
  en: process.env.MONGO_URL_EN,
  fr: process.env.MONGO_URL_FR,
  nl: process.env.MONGO_URL_NL,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv() {
  const missing = LOCALES.filter(l => !MONGO_URLS[l]).map(l => `MONGO_URL_${l.toUpperCase()}`);
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  validateStrapiEnv();
}

// ---------------------------------------------------------------------------
// Field mapping  (C# PascalCase → Strapi snake_case)
// ---------------------------------------------------------------------------

function buildLocalePayloads(docs) {
  const payloads = Object.fromEntries(
    LOCALES.map(locale => {
      const doc = docs[locale];
      return [locale, {
        title:              doc.Title             ?? null,
        text:               doc.Text              ?? null,
        show:               doc.Show              ?? true,
        show_title:         doc.ShowTitle         ?? true,
        footer_title:       doc.FooterTitle       ?? null,
        browser_title:      doc.BrowserTitle      ?? null,
        google_description: doc.GoogleDescription ?? null,
        background_color:   locale === 'en' ? mapBackgroundColor(docs.en.BackgroundColor) : null,
      }];
    })
  );
  return applyNonLocalised(payloads, ['background_color']);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  // 1. Read Terms from all three Mongo DBs
  console.log('Reading from MongoDB…');
  const docs = await fetchLocaleDocuments(MONGO_URLS, 'Terms');
  for (const locale of LOCALES) {
    console.log(`  [${locale}] ✓`);
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
  const payloads = buildLocalePayloads(docs);
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] `);
    await putLocale('terms', locale, payloads[locale]);
    console.log('✓');
  }

  console.log(`\nDone. Open ${process.env.STRAPI_URL}/admin to verify.`);
}

main().catch(err => {
  console.error('\n' + err.message);
  process.exit(1);
});
