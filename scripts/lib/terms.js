import { LOCALES } from './mongo.js';
import { mapBackgroundColor, applyNonLocalised } from './blocks.js';

/**
 * Maps Terms MongoDB documents (keyed by locale) to Strapi locale payloads.
 * background_color is non-localised — taken from en and spread to all locales.
 */
export function buildTermsPayloads(docs) {
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
