import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBackgroundColor, applyNonLocalised } from './blocks.js';

test('mapBackgroundColor maps integer index to string', () => {
  assert.equal(mapBackgroundColor(0), 'White');
  assert.equal(mapBackgroundColor(1), 'Lightgray');
  assert.equal(mapBackgroundColor(2), 'Gray');
  assert.equal(mapBackgroundColor(3), 'Green');
});

test('mapBackgroundColor passes through string value unchanged', () => {
  assert.equal(mapBackgroundColor('Gray'), 'Gray');
  assert.equal(mapBackgroundColor('Green'), 'Green');
});

test('mapBackgroundColor falls back to White for unknown values', () => {
  assert.equal(mapBackgroundColor(99), 'White');
  assert.equal(mapBackgroundColor(null), 'White');
  assert.equal(mapBackgroundColor(undefined), 'White');
});

// applyNonLocalised

test('applyNonLocalised copies specified fields from en payload to all locale payloads', () => {
  const payloads = {
    en: { title: 'Hello', background_color: 'Gray' },
    fr: { title: 'Bonjour', background_color: null },
    nl: { title: 'Hallo', background_color: null },
  };
  const result = applyNonLocalised(payloads, ['background_color']);
  assert.equal(result.en.background_color, 'Gray');
  assert.equal(result.fr.background_color, 'Gray');
  assert.equal(result.nl.background_color, 'Gray');
});

test('applyNonLocalised does not mutate the original payloads', () => {
  const payloads = {
    en: { title: 'Hello', image: 'img.png' },
    fr: { title: 'Bonjour', image: null },
  };
  applyNonLocalised(payloads, ['image']);
  assert.equal(payloads.fr.image, null);
});

test('applyNonLocalised preserves localised fields unchanged', () => {
  const payloads = {
    en: { title: 'Hello', background_color: 'Green' },
    fr: { title: 'Bonjour', background_color: null },
  };
  const result = applyNonLocalised(payloads, ['background_color']);
  assert.equal(result.en.title, 'Hello');
  assert.equal(result.fr.title, 'Bonjour');
});

test('applyNonLocalised throws with actionable message when en payload is absent', () => {
  assert.throws(
    () => applyNonLocalised({ fr: { title: 'Bonjour' } }, ['background_color']),
    /must include an "en" entry/
  );
});
