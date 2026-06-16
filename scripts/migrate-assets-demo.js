#!/usr/bin/env node
/**
 * Demo: resolve the Building hero image (PictureRef) from Mongo → Strapi media library.
 *
 * Exercises the full resolveAssets path against a real PictureRef.
 *
 * Required env vars:
 *   MONGO_URL_EN   Full MongoDB URI for the English DB
 *   STRAPI_URL     e.g. https://your-instance.strapiapp.com
 *   STRAPI_TOKEN   Scoped Strapi API token (content write, no admin)
 *
 * Run:
 *   cd scripts && node --env-file=.env migrate-assets-demo.js
 */

import { validateStrapiEnv, uploadMedia, verifyMedia } from './lib/strapi.js';
import { fetchLocaleDocuments } from './lib/mongo.js';
import { resolveAssets, loadManifest, saveManifest } from './lib/assets.js';

const MANIFEST_PATH = './.asset-manifest.json';

function validateEnv() {
  if (!process.env.MONGO_URL_EN) {
    console.error('Missing required env var: MONGO_URL_EN');
    process.exit(1);
  }
  validateStrapiEnv();
}

async function main() {
  validateEnv();

  // 1. Fetch building doc from EN Mongo
  // Collection name follows the C# class name convention (PascalCase) — verify against your DB if this fails.
  console.log('Reading Building collection from MongoDB (en)…');
  const docs = await fetchLocaleDocuments({ en: process.env.MONGO_URL_EN }, 'Building');
  const doc = docs.en;
  console.log(doc);

  const image = doc?.Image;
  if (!image) {
    console.error('No Image field found on building document');
    process.exit(1);
  }
  console.log(`  Found image: ${image.Name} (${image.Id})`);

  // 2. Load manifest
  const manifest = await loadManifest(MANIFEST_PATH);
  console.log(`  Manifest entries already cached: ${Object.keys(manifest).length}`);

  // 3. Resolve — wire real fetchBytes + upload
  const fetchBytes = async (src) => {
    console.log(`fetchBytes: ${src}`);
    const res = await fetch(`${process.env.LEGACY_SERVER_URL}/${src}`);
    if (!res.ok) throw new Error(`fetchBytes: ${res.status} fetching ${src}`);
    return Buffer.from(await res.arrayBuffer());
  };

  const upload = (filename, buffer, mimeType, altText) =>
    uploadMedia(filename, buffer, mimeType, altText);

  const { manifest: updatedManifest, stats } = await resolveAssets([image], manifest, {
    fetchBytes,
    upload,
    verify: (id) => verifyMedia(id),
  });

  // 4. Save manifest
  await saveManifest(MANIFEST_PATH, updatedManifest);

  // 5. Summary
  console.log(`\nUploaded: ${stats.uploaded}  Reused: ${stats.reused}`);
}

main().catch(err => {
  console.error('\n' + (err.stack ?? err.message));
  process.exit(1);
});
