import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBackgroundColor, applyNonLocalised, mapParagraph, mapParagraphImage, mapBuilding, mapPartners } from './blocks.js';

test('mapBackgroundColor maps integer index to string', () => {
  assert.equal(mapBackgroundColor(0), 'White');
  assert.equal(mapBackgroundColor(1), 'Lightgray');
  assert.equal(mapBackgroundColor(2), 'Gray');
  assert.equal(mapBackgroundColor(3), 'Blue');
});

test('mapBackgroundColor passes through string value unchanged', () => {
  assert.equal(mapBackgroundColor('Gray'), 'Gray');
  assert.equal(mapBackgroundColor('Blue'), 'Blue');
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

test('mapParagraph BackgroundColor string Blue passes through', () => {
  const result = mapParagraph({ BackgroundColor: 'Blue' });
  assert.equal(result.background_color, 'Blue');
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
  assert.equal(result.background_color, 'Blue');
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

// mapBuilding

test('mapBuilding maps all fields from a complete doc with items', () => {
  const doc = {
    Show: false,
    ShowTitle: false,
    BackgroundColor: 2,
    Items: [
      { Title: 'Item 1', Text: '<p>text 1</p>' },
      { Title: 'Item 2', Text: '<p>text 2</p>' },
    ],
  };
  const itemImageIds = [
    { bigImageId: 10, smallImageId: 11 },
    { bigImageId: 20, smallImageId: 21 },
  ];
  const result = mapBuilding(doc, itemImageIds);
  assert.equal(result.show, false);
  assert.equal(result.show_title, false);
  assert.equal(result.background_color, 'Gray');
  assert.equal(result.items.length, 2);
});

test('mapBuilding items array maps title and text per item', () => {
  const doc = {
    Items: [
      { Title: 'A', Text: '<p>alpha</p>' },
      { Title: 'B', Text: '<p>beta</p>' },
    ],
  };
  const result = mapBuilding(doc, [
    { bigImageId: 1, smallImageId: 2 },
    { bigImageId: 3, smallImageId: 4 },
  ]);
  assert.equal(result.items[0].title, 'A');
  assert.equal(result.items[0].text, '<p>alpha</p>');
  assert.equal(result.items[1].title, 'B');
  assert.equal(result.items[1].text, '<p>beta</p>');
});

test('mapBuilding big_image and small_image come from itemImageIds', () => {
  const doc = { Items: [{ Title: 'X', Text: 't' }] };
  const result = mapBuilding(doc, [{ bigImageId: 99, smallImageId: 88 }]);
  assert.equal(result.items[0].big_image, 99);
  assert.equal(result.items[0].small_image, 88);
});

test('mapBuilding missing Items defaults to empty array', () => {
  const result = mapBuilding({}, []);
  assert.deepEqual(result.items, []);
});

test('mapBuilding missing Show and ShowTitle default to true', () => {
  const result = mapBuilding({ Items: [] }, []);
  assert.equal(result.show, true);
  assert.equal(result.show_title, true);
});

test('mapBuilding BackgroundColor integer maps correctly', () => {
  assert.equal(mapBuilding({ Items: [], BackgroundColor: 0 }, []).background_color, 'White');
  assert.equal(mapBuilding({ Items: [], BackgroundColor: 3 }, []).background_color, 'Blue');
});

// mapPartners

test('mapPartners maps all fields from a complete doc', () => {
  const doc = {
    Title: 'Partners',
    Text: '<p>body</p>',
    Show: false,
    ShowTitle: false,
    BackgroundColor: 1,
  };
  const result = mapPartners(doc, [5, 6, 7]);
  assert.equal(result.title, 'Partners');
  assert.equal(result.text, '<p>body</p>');
  assert.equal(result.show, false);
  assert.equal(result.show_title, false);
  assert.equal(result.background_color, 'Lightgray');
  assert.deepEqual(result.images, [5, 6, 7]);
});

test('mapPartners images array is set from imageIds', () => {
  const result = mapPartners({ Title: 'T' }, [10, 20]);
  assert.deepEqual(result.images, [10, 20]);
});

test('mapPartners empty imageIds yields empty images array', () => {
  const result = mapPartners({ Title: 'T' }, []);
  assert.deepEqual(result.images, []);
});

test('mapPartners missing Show and ShowTitle default to true', () => {
  const result = mapPartners({}, []);
  assert.equal(result.show, true);
  assert.equal(result.show_title, true);
});

test('mapPartners BackgroundColor integer maps correctly', () => {
  assert.equal(mapPartners({ BackgroundColor: 2 }, []).background_color, 'Gray');
  assert.equal(mapPartners({ BackgroundColor: 3 }, []).background_color, 'Blue');
});
