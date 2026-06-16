import { LOCALES } from './mongo.js';

/**
 * Maps Contact MongoDB documents (keyed by locale) to Strapi locale payloads.
 * Contact has only two localised fields: title and text.
 * No non-localised fields — no applyNonLocalised call needed.
 */
export function buildContactPayloads(docs) {
  return Object.fromEntries(
    LOCALES.map(locale => {
      const doc = docs[locale];
      return [locale, {
        title: doc.Title ?? null,
        text:  doc.Text  ?? null,
      }];
    })
  );
}
