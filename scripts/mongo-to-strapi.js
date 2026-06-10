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

// mongodb v3 is CJS-only; use default import and destructure
import mongodb from 'mongodb';
const { MongoClient } = mongodb;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOCALES = ['en', 'fr', 'nl'];

const MONGO_URLS = {
  en: process.env.MONGO_URL_EN,
  fr: process.env.MONGO_URL_FR,
  nl: process.env.MONGO_URL_NL,
};

const STRAPI_URL   = (process.env.STRAPI_URL  ?? '').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

// C# enum BackgroundColor is stored as an integer index by MongoDB.Driver by default
const BG_COLOR_BY_INDEX = { 0: 'White', 1: 'Lightgray', 2: 'Gray', 3: 'Green' };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv() {
  const missing = [
    ...LOCALES.filter(l => !MONGO_URLS[l]).map(l => `MONGO_URL_${l.toUpperCase()}`),
    ...(!STRAPI_URL   ? ['STRAPI_URL']   : []),
    ...(!STRAPI_TOKEN ? ['STRAPI_TOKEN'] : []),
  ];
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------

async function fetchTerms(mongoUrl) {
  const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    // client.db() with no argument uses the database name embedded in the URI
    const doc = await client.db().collection('Terms').findOne({}, { projection: { _id: 0 } });
    if (!doc) throw new Error(`No document in 'terms' collection at ${new URL(mongoUrl).host}`);
    return doc;
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Field mapping  (C# PascalCase → Strapi snake_case)
// ---------------------------------------------------------------------------

function mapBackgroundColor(raw) {
  if (typeof raw === 'string') return raw;                          // already a string name
  if (typeof raw === 'number') return BG_COLOR_BY_INDEX[raw] ?? 'White'; // integer enum index
  return 'White';
}

/**
 * Returns the Strapi data payload for one locale.
 * Non-localised field (background_color) is only included for the default locale
 * so Strapi stores it once and shares it across locales.
 */
function buildPayload(doc, isDefaultLocale) {
  const payload = {
    title:              doc.Title            ?? null,
    text:               doc.Text             ?? null,
    show:               doc.Show             ?? true,
    show_title:         doc.ShowTitle        ?? true,
    footer_title:       doc.FooterTitle      ?? null,
    browser_title:      doc.BrowserTitle     ?? null,
    google_description: doc.GoogleDescription ?? null,
  };

  if (isDefaultLocale) {
    payload.background_color = mapBackgroundColor(doc.BackgroundColor);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Strapi REST API
// ---------------------------------------------------------------------------

async function strapiPut(locale, data) {
  const url = `${STRAPI_URL}/api/terms?locale=${locale}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    body: JSON.stringify({ data }),
  });

  const json = await res.json();

  if (!res.ok) {
    // Strapi v5: PUT on a locale that doesn't exist yet returns 404.
    // In that case fall back to creating via the localizations endpoint.
    if (res.status === 404) {
      return strapiCreateLocalization(locale, data);
    }
    throw new Error(`Strapi PUT /${locale} failed (${res.status}):\n${JSON.stringify(json, null, 2)}`);
  }

  return json;
}

async function strapiCreateLocalization(locale, data) {
  const url = `${STRAPI_URL}/api/terms/localizations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    body: JSON.stringify({ ...data, locale }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Strapi POST /localizations for ${locale} failed (${res.status}):\n${JSON.stringify(json, null, 2)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  // 1. Read Terms from all three Mongo DBs
  console.log('Reading from MongoDB…');
  const docs = {};
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] connecting… `);
    docs[locale] = await fetchTerms(MONGO_URLS[locale]);
    console.log('✓');
  }

  // 2. Preview the text field so the user can verify HTML survives the roundtrip
  console.log('\nText field preview (first 300 chars per locale):');
  for (const locale of LOCALES) {
    const preview = String(docs[locale].Text ?? '').slice(0, 300);
    console.log(`\n  [${locale}]\n  ${preview || '(empty)'}`);
  }
  console.log();

  // 3. Warn if custom-style span tags are absent (see open question in the handoff)
  const enText = String(docs.en.Text ?? '');
  if (!enText.includes('<span class=')) {
    console.warn('  ⚠  No <span class="..."> found in EN text — custom style roundtrip will not be exercised.');
  }

  // 4. Write to Strapi — default locale (en) first, then fr, then nl
  console.log('Writing to Strapi…');
  for (const locale of LOCALES) {
    const isDefault = locale === 'en';
    const payload   = buildPayload(docs[locale], isDefault);
    process.stdout.write(`  [${locale}] `);
    await strapiPut(locale, payload);
    console.log('✓');
  }

  console.log(`\nDone. Open ${STRAPI_URL}/admin to verify.`);
}

main().catch(err => {
  console.error('\n' + err.message);
  process.exit(1);
});
