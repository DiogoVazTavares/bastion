import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTermsPayloads } from './terms.js';

const BASE_DOC = {
  Title: 'Terms', Text: '<p>body</p>', Show: true, ShowTitle: true,
  FooterTitle: 'Footer', BrowserTitle: 'Meta', GoogleDescription: 'Desc',
  BackgroundColor: 2,
};

function docs(overrides = {}) {
  return {
    en: { ...BASE_DOC, ...overrides.en },
    fr: { ...BASE_DOC, Title: 'Conditions', ...overrides.fr },
    nl: { ...BASE_DOC, Title: 'Voorwaarden', ...overrides.nl },
  };
}

test('buildTermsPayloads maps PascalCase fields to snake_case', () => {
  const result = buildTermsPayloads(docs());
  assert.equal(result.en.browser_title, 'Meta');
  assert.equal(result.en.google_description, 'Desc');
  assert.equal(result.en.footer_title, 'Footer');
  assert.equal(result.en.title, 'Terms');
  assert.equal(result.en.text, '<p>body</p>');
});

test('buildTermsPayloads propagates background_color from en to all locales', () => {
  const result = buildTermsPayloads(docs());
  assert.equal(result.en.background_color, 'Gray'); // BackgroundColor: 2 → 'Gray'
  assert.equal(result.fr.background_color, 'Gray');
  assert.equal(result.nl.background_color, 'Gray');
});

test('buildTermsPayloads preserves localised titles per locale', () => {
  const result = buildTermsPayloads(docs());
  assert.equal(result.en.title, 'Terms');
  assert.equal(result.fr.title, 'Conditions');
  assert.equal(result.nl.title, 'Voorwaarden');
});

test('buildTermsPayloads respects Show: false without overriding with default', () => {
  const result = buildTermsPayloads(docs({ en: { Show: false } }));
  assert.equal(result.en.show, false);
});

test('buildTermsPayloads defaults Show to true when field is null', () => {
  const result = buildTermsPayloads(docs({ fr: { Show: null } }));
  assert.equal(result.fr.show, true);
});

test('buildTermsPayloads defaults ShowTitle to true when field is null', () => {
  const result = buildTermsPayloads(docs({ fr: { ShowTitle: null } }));
  assert.equal(result.fr.show_title, true);
});

test('buildTermsPayloads maps null fields to null rather than undefined', () => {
  const result = buildTermsPayloads(docs({ en: { FooterTitle: null } }));
  assert.equal(result.en.footer_title, null);
});
