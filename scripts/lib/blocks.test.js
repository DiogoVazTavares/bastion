import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBackgroundColor, applyNonLocalised, mapParagraph, mapParagraphImage } from './blocks.js';

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

// mapParagraph

test('mapParagraph maps all fields from a complete doc', () => {
  const doc = { Title: 'Hello', Text: '<p>body</p>', Show: false, ShowTitle: false, BackgroundColor: 2 };
  const result = mapParagraph(doc);
  assert.equal(result.title, 'Hello');
  assert.equal(result.text, '<p>body</p>');
  assert.equal(result.show, false);
  assert.equal(result.show_title, false);
  assert.equal(result.background_color, 'Gray');
});

test('mapParagraph Show missing defaults to true', () => {
  const result = mapParagraph({ Title: 'T', Text: 't', ShowTitle: true, BackgroundColor: 0 });
  assert.equal(result.show, true);
});

test('mapParagraph ShowTitle missing defaults to true', () => {
  const result = mapParagraph({ Title: 'T', Text: 't', Show: true, BackgroundColor: 0 });
  assert.equal(result.show_title, true);
});

test('mapParagraph Title and Text missing default to null', () => {
  const result = mapParagraph({ Show: true, ShowTitle: true, BackgroundColor: 0 });
  assert.equal(result.title, null);
  assert.equal(result.text, null);
});

test('mapParagraph BackgroundColor integer 0 maps to White', () => {
  const result = mapParagraph({ BackgroundColor: 0 });
  assert.equal(result.background_color, 'White');
});

test('mapParagraph BackgroundColor string Green passes through', () => {
  const result = mapParagraph({ BackgroundColor: 'Green' });
  assert.equal(result.background_color, 'Green');
});

// mapParagraphImage

test('mapParagraphImage maps all fields including imageId', () => {
  const doc = { Title: 'T', Text: '<p>x</p>', Show: true, ShowTitle: false, BackgroundColor: 3 };
  const result = mapParagraphImage(doc, 42);
  assert.equal(result.title, 'T');
  assert.equal(result.text, '<p>x</p>');
  assert.equal(result.image, 42);
  assert.equal(result.show, true);
  assert.equal(result.show_title, false);
  assert.equal(result.background_color, 'Green');
});

test('mapParagraphImage imageId null yields image: null', () => {
  const result = mapParagraphImage({ BackgroundColor: 0 }, null);
  assert.equal(result.image, null);
});

test('mapParagraphImage imageId undefined yields image: null', () => {
  const result = mapParagraphImage({ BackgroundColor: 0 }, undefined);
  assert.equal(result.image, null);
});

test('mapParagraphImage image and background_color propagate via applyNonLocalised', () => {
  const doc = { Title: 'T', Text: 't', Show: true, ShowTitle: true, BackgroundColor: 1 };
  const payloads = {
    en: mapParagraphImage(doc, 42),
    fr: mapParagraphImage(doc, null),
    nl: mapParagraphImage(doc, null),
  };
  const result = applyNonLocalised(payloads, ['background_color', 'image']);
  assert.equal(result.fr.image, 42);
  assert.equal(result.nl.image, 42);
  assert.equal(result.fr.background_color, 'Lightgray');
  assert.equal(result.nl.background_color, 'Lightgray');
});
