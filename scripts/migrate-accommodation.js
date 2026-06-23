#!/usr/bin/env node
/**
 * ETL: Accommodation  —  MongoDB (3 locale DBs) → Strapi i18n single type
 *
 * Identity key: single-type singleton (one document per locale DB).
 * Idempotency: putLocale issues a PUT (last-write-wins). Re-running is safe.
 * Asset dedup: .asset-manifest.json keyed by FileRef.Id.
 *
 * Non-localised fields: `image` (hero image) — sourced from en, applied to all locales.
 * Blocks array IS locale-specific (separate locale DBs) — NOT in applyNonLocalised.
 * Sub-block media IDs (slider slides, info items, floor images) are Strapi-global:
 * uploaded once from en, same numeric ID used in all locale payloads.
 *
 * Write order: en → fr → nl (default locale must exist before localizations attach).
 *
 * Required env vars:
 *   MONGO_URL_EN         Full MongoDB URI for the English DB (includes auth + dbname)
 *   MONGO_URL_FR         Full MongoDB URI for the French DB
 *   MONGO_URL_NL         Full MongoDB URI for the Dutch DB
 *   STRAPI_URL           e.g. https://your-instance.strapiapp.com
 *   STRAPI_TOKEN         Scoped Strapi API token (content write, no admin)
 *   LEGACY_SERVER_URL    e.g. https://www.bastiontower.com
 *
 * Run:
 *   cd scripts && npm install
 *   node --env-file=.env migrate-accommodation.js
 */

import mongodb from 'mongodb';
const { ObjectId } = mongodb;
import { LOCALES, withDatabase } from './lib/mongo.js';
import { validateStrapiEnv, putLocale, uploadMedia, verifyMedia } from './lib/strapi.js';
import { resolveAssets, loadManifest, saveManifest } from './lib/assets.js';
import {
  mapParagraph,
  mapSlider,
  mapInfo,
  mapFloors,
  applyNonLocalised,
} from './lib/blocks.js';

const ASSET_MANIFEST_PATH = './.asset-manifest.json';

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

// ---------------------------------------------------------------------------
// Asset helpers
// ---------------------------------------------------------------------------

function makeFetchBytes() {
  const base = process.env.LEGACY_SERVER_URL.replace(/\/$/, '');
  return async (src) => {
    const url = src.startsWith('http') ? src : `${base}${src}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

function makeUpload() {
  return (filename, buffer, mimeType, altText) =>
    uploadMedia(filename, buffer, mimeType, altText);
}

// ---------------------------------------------------------------------------
// Panel type discriminator — MongoDB collection name = C# class name
// ---------------------------------------------------------------------------
const PANEL_TYPES = {
  PanelText:   'blocks.paragraph',
  PanelSlider: 'blocks.slider',
  PanelInfo:   'blocks.info',
  PanelFloors: 'blocks.floors',
};

function toObjectId(val) {
  if (val instanceof ObjectId) return val;
  if (typeof val === 'string') return new ObjectId(val);
  return val;
}

// MongoDB stores C# PictureRef.Id as _id; resolveAssets expects Id (capital I).
function pic(ref) {
  if (!ref) return null;
  return ref.Id != null ? ref : { ...ref, Id: ref._id };
}

// ourCompany.cms serialises typed arrays as { _t: "TypeName", _v: [...] }.
// Plain BSON arrays are returned as JS arrays; fallback covers ordered-key objects.
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (Array.isArray(val._v)) return val._v;
  return Object.values(val);
}

// MongoDB v3.x DBRef: .namespace/.oid  |  v4.x+: .$ref/.$id
function refColl(r) { return r.namespace ?? r.$ref; }
function refId(r)   { return r.oid ?? r.$id; }

/**
 * Resolve _DBRef.c references to full documents, hydrating leaf sub-items.
 */
async function fetchPanels(db, doc) {
  const refs = doc._DBRef?.c ?? [];
  const panels = [];
  for (const ref of refs) {
    const collName = refColl(ref);
    const panel = await db.collection(collName).findOne({ _id: toObjectId(refId(ref)) });
    if (!panel) {
      console.warn(`  WARNING: ${collName}/${refId(ref)} not found — skipped`);
      continue;
    }

    if (collName === 'PanelSlider') {
      const leafRefs = panel._DBRef?.l ?? [];
      const slides = [];
      for (const lr of leafRefs) {
        const slide = await db.collection(refColl(lr)).findOne({ _id: toObjectId(refId(lr)) });
        if (slide) slides.push(slide);
      }
      panels.push({ ...panel, _t: collName, Slides: slides });
      continue;
    }

    if (collName === 'PanelInfo') {
      const leafRefs = panel._DBRef?.l ?? [];
      const items = [];
      for (const lr of leafRefs) {
        const item = await db.collection(refColl(lr)).findOne({ _id: toObjectId(refId(lr)) });
        if (item) items.push(item);
      }
      panels.push({ ...panel, _t: collName, Items: items });
      continue;
    }

    if (collName === 'PanelFloors') {
      const leafRefs = panel._DBRef?.l ?? [];
      const floors = [];
      for (const lr of leafRefs) {
        const floor = await db.collection(refColl(lr)).findOne({ _id: toObjectId(refId(lr)) });
        if (floor) floors.push(floor);
      }
      panels.push({ ...panel, _t: collName, Floors: floors });
      continue;
    }

    if (collName === 'PanelText') {
      panels.push({ ...panel, _t: collName });
      continue;
    }

    // Unknown type — push as-is so mapPanel can warn
    panels.push({ ...panel, _t: collName });
  }
  return panels;
}

// ---------------------------------------------------------------------------
// Block mapper
// ---------------------------------------------------------------------------

/**
 * Maps a single panel to a Strapi dynamic zone entry.
 * Returns null for unrecognised types (logged by caller).
 *
 * Sub-block media (slide images, info item images, floor images) is resolved here
 * only for the en locale pass; the caller stores the resulting IDs and passes the same
 * values when mapping fr/nl (Strapi media IDs are global — no re-upload needed).
 */
async function mapPanel(panel, manifest, fetchBytes, upload) {
  const type = panel._t;

  if (type === 'PanelText') {
    return { __component: PANEL_TYPES.PanelText, ...mapParagraph(panel) };
  }

  if (type === 'PanelSlider') {
    const slides = panel.Slides ?? [];
    const slideImageIds = [];
    for (const slide of slides) {
      const isImage = slide._t === 'SlideImage' || (slide.Image !== undefined && slide.Text === undefined);
      if (isImage && slide.Image) {
        const ref = pic(slide.Image);
        const result = await resolveAssets([ref], manifest, {
          fetchBytes,
          upload,
          verify: verifyMedia,
        });
        Object.assign(manifest, result.manifest);
        slideImageIds.push({ imageId: result.ids.get(ref.Id) ?? null });
      } else {
        slideImageIds.push(null);
      }
    }
    return { __component: PANEL_TYPES.PanelSlider, ...mapSlider(panel, slideImageIds) };
  }

  if (type === 'PanelInfo') {
    const items = panel.Items ?? [];
    const itemImageIds = [];
    for (const item of items) {
      if (item.Image) {
        const ref = pic(item.Image);
        const result = await resolveAssets([ref], manifest, {
          fetchBytes,
          upload,
          verify: verifyMedia,
        });
        Object.assign(manifest, result.manifest);
        itemImageIds.push({ imageId: result.ids.get(ref.Id) ?? null });
      } else {
        itemImageIds.push({ imageId: null });
      }
    }
    return { __component: PANEL_TYPES.PanelInfo, ...mapInfo(panel, itemImageIds) };
  }

  if (type === 'PanelFloors') {
    const floors = panel.Floors ?? [];
    const floorImageIds = [];
    for (const floor of floors) {
      const rawImages = toArray(floor.Images);
      const imageRefs = rawImages.map(pic).filter(Boolean);
      if (imageRefs.length > 0) {
        const result = await resolveAssets(imageRefs, manifest, {
          fetchBytes,
          upload,
          verify: verifyMedia,
        });
        Object.assign(manifest, result.manifest);
        floorImageIds.push(imageRefs.map(r => result.ids.get(r.Id)).filter(id => id != null));
      } else {
        floorImageIds.push([]);
      }
    }
    return { __component: PANEL_TYPES.PanelFloors, ...mapFloors(panel, floorImageIds) };
  }

  return null; // unrecognised — caller logs
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  // 1. Read Accommodation documents + panels from all three Mongo DBs
  console.log('Reading from MongoDB…');
  const docs = {};
  const panelsByLocale = {};
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] connecting… `);
    await withDatabase(MONGO_URLS[locale], async (db) => {
      const doc = await db.collection('Accommodation').findOne({}, { projection: { _id: 0 } });
      if (!doc) throw new Error(`No Accommodation document for locale '${locale}'`);
      docs[locale] = doc;
      panelsByLocale[locale] = await fetchPanels(db, doc);
    });
    console.log(`✓ (${panelsByLocale[locale].length} panels)`);
  }

  // 2. Load shared asset manifest (keyed by FileRef.Id)
  const manifest = await loadManifest(ASSET_MANIFEST_PATH);
  console.log(`\nAsset manifest: ${Object.keys(manifest).length} cached entries`);

  const fetchBytes = makeFetchBytes();
  const upload = makeUpload();

  // 3. Build payloads per locale
  console.log('\nBuilding payloads…');
  const payloads = {};
  const assetStats = { uploaded: 0, reused: 0 };

  for (const locale of LOCALES) {
    const doc = docs[locale];
    const panels = panelsByLocale[locale];

    // Hero image (non-localised — only upload once, from en; others get same id below)
    let heroImageId = null;
    if (locale === 'en' && doc.Image) {
      process.stdout.write(`  [${locale}] uploading hero image… `);
      const heroRef = pic(doc.Image);
      const result = await resolveAssets([heroRef], manifest, {
        fetchBytes,
        upload,
        verify: verifyMedia,
      });
      Object.assign(manifest, result.manifest);
      heroImageId = result.ids.get(heroRef.Id) ?? null;
      assetStats.uploaded += result.stats.uploaded;
      assetStats.reused += result.stats.reused;
      console.log(result.stats.uploaded > 0 ? 'uploaded ✓' : 'reused ✓');
    }

    // Blocks
    process.stdout.write(`  [${locale}] mapping ${panels.length} panel(s)… `);
    const blocks = [];
    for (const panel of panels) {
      const block = await mapPanel(panel, manifest, fetchBytes, upload);
      if (block === null) {
        console.warn(`\n  [${locale}] WARNING: unrecognised panel type "${panel._t}" — skipped`);
      } else {
        blocks.push(block);
      }
    }
    console.log('✓');

    payloads[locale] = {
      title:               doc.Title              ?? null,
      hero:                doc.Hero               ?? null,
      image:               heroImageId,           // non-localised; propagated below
      browser_title:       doc.BrowserTitle       ?? null,
      google_description:  doc.GoogleDescription  ?? null,
      footer_title:        doc.FooterTitle        ?? null,
      blocks,
    };
  }

  // 4. Save manifest after all uploads
  await saveManifest(ASSET_MANIFEST_PATH, manifest);
  console.log(`\nAsset manifest saved (uploaded: ${assetStats.uploaded}, reused: ${assetStats.reused})`);

  // 5. Propagate non-localised hero image from en to all locales
  //    (blocks are locale-specific; excluded from applyNonLocalised)
  const syncedPayloads = applyNonLocalised(payloads, ['image']);

  // 6. Write to Strapi — en first, then fr, then nl
  console.log('\nWriting to Strapi…');
  for (const locale of LOCALES) {
    process.stdout.write(`  [${locale}] `);
    await putLocale('accommodation', locale, syncedPayloads[locale]);
    console.log('✓');
  }

  // 7. Per-locale summary
  console.log('\nSummary:');
  for (const locale of LOCALES) {
    const p = syncedPayloads[locale];
    const titlePreview = String(p.title ?? '').slice(0, 60) || '(null)';
    const blockCount = Array.isArray(p.blocks) ? p.blocks.length : 0;
    const imageUrl = p.image != null ? `id:${p.image}` : '(none)';
    console.log(`  [${locale}]  title="${titlePreview}"  blocks=${blockCount}  heroImage=${imageUrl}`);
  }

  console.log(`\nDone. Open ${process.env.STRAPI_URL}/admin to verify.`);
}

main().catch(err => {
  console.error('\n' + (err.stack ?? err.message));
  process.exit(1);
});
