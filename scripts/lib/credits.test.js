import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreditsPayloads } from './credits.js';

const BASE_DOC = {
  Title: 'Credits', Text: '<p>body</p>', Show: true, ShowTitle: true,
  FooterTitle: 'Footer', BrowserTitle: 'Meta', GoogleDescription: 'Desc',
  BackgroundColor: 2,
};

function docs(overrides = {}) {
  return {
    en: { ...BASE_DOC, ...overrides.en },
    fr: { ...BASE_DOC, Title: 'Crédits', ...overrides.fr },
    nl: { ...BASE_DOC, Title: 'Credits NL', ...overrides.nl },
  };
}

test('buildCreditsPayloads maps PascalCase fields to snake_case', () => {
  const result = buildCreditsPayloads(docs());
  assert.equal(result.en.browser_title, 'Meta');
  assert.equal(result.en.google_description, 'Desc');
  assert.equal(result.en.footer_title, 'Footer');
  assert.equal(result.en.title, 'Credits');
  assert.equal(result.en.text, '<p>body</p>');
});

test('buildCreditsPayloads propagates background_color from en to all locales', () => {
  const result = buildCreditsPayloads(docs());
  assert.equal(result.en.background_color, 'Gray'); // BackgroundColor: 2 → 'Gray'
  assert.equal(result.fr.background_color, 'Gray');
  assert.equal(result.nl.background_color, 'Gray');
});

test('buildCreditsPayloads background_color integer 0 → White', () => {
  const result = buildCreditsPayloads(docs({ en: { BackgroundColor: 0 } }));
  assert.equal(result.en.background_color, 'White');
  assert.equal(result.fr.background_color, 'White');
  assert.equal(result.nl.background_color, 'White');
});

test('buildCreditsPayloads preserves localised titles per locale', () => {
  const result = buildCreditsPayloads(docs());
  assert.equal(result.en.title, 'Credits');
  assert.equal(result.fr.title, 'Crédits');
  assert.equal(result.nl.title, 'Credits NL');
});

test('buildCreditsPayloads respects Show: false without overriding with default', () => {
  const result = buildCreditsPayloads(docs({ en: { Show: false } }));
  assert.equal(result.en.show, false);
});

test('buildCreditsPayloads defaults Show to true when field is null', () => {
  const result = buildCreditsPayloads(docs({ fr: { Show: null } }));
  assert.equal(result.fr.show, true);
});

test('buildCreditsPayloads defaults ShowTitle to true when field is null', () => {
  const result = buildCreditsPayloads(docs({ fr: { ShowTitle: null } }));
  assert.equal(result.fr.show_title, true);
});

test('buildCreditsPayloads maps null fields to null rather than undefined', () => {
  const result = buildCreditsPayloads(docs({ en: { FooterTitle: null } }));
  assert.equal(result.en.footer_title, null);
});
