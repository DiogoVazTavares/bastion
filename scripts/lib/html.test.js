import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAssetUrls, rewriteAssetUrls } from './html.js';

// ---------------------------------------------------------------------------
// extractAssetUrls
// ---------------------------------------------------------------------------

test('extractAssetUrls: returns [] for null', () => {
  assert.deepEqual(extractAssetUrls(null), []);
});

test('extractAssetUrls: returns [] for empty string', () => {
  assert.deepEqual(extractAssetUrls(''), []);
});

test('extractAssetUrls: extracts img src', () => {
  assert.deepEqual(extractAssetUrls('<img src="https://cdn/a.jpg">'), ['https://cdn/a.jpg']);
});

test('extractAssetUrls: extracts a href', () => {
  assert.deepEqual(extractAssetUrls('<a href="https://cdn/doc.pdf">x</a>'), ['https://cdn/doc.pdf']);
});

test('extractAssetUrls: deduplicates repeated URLs', () => {
  const html = '<img src="https://cdn/a.jpg"><a href="https://cdn/a.jpg">link</a>';
  assert.deepEqual(extractAssetUrls(html), ['https://cdn/a.jpg']);
});

test('extractAssetUrls: returns multiple distinct URLs in document order', () => {
  const html = '<img src="https://cdn/a.jpg"><img src="https://cdn/b.jpg">';
  assert.deepEqual(extractAssetUrls(html), ['https://cdn/a.jpg', 'https://cdn/b.jpg']);
});

test('img rewrite: replaces legacy src with R2 URL', () => {
  const result = rewriteAssetUrls(
    '<img src="legacy/img.jpg">',
    { 'legacy/img.jpg': 'https://cdn/img.jpg' }
  );
  assert.equal(result, '<img src="https://cdn/img.jpg">');
});

test('href rewrite: replaces legacy href with R2 URL', () => {
  const result = rewriteAssetUrls(
    '<a href="legacy/doc.pdf">download</a>',
    { 'legacy/doc.pdf': 'https://cdn/doc.pdf' }
  );
  assert.equal(result, '<a href="https://cdn/doc.pdf">download</a>');
});

test('untouched URL: URL not in srcToUrl is left as-is', () => {
  const result = rewriteAssetUrls(
    '<img src="other/image.png">',
    { 'legacy/img.jpg': 'https://cdn/img.jpg' }
  );
  assert.equal(result, '<img src="other/image.png">');
});

test('shared-file case: same URL in both img src and a href is rewritten to same R2 URL', () => {
  const result = rewriteAssetUrls(
    '<img src="legacy/file.jpg"><a href="legacy/file.jpg">link</a>',
    { 'legacy/file.jpg': 'https://cdn/file.jpg' }
  );
  assert.equal(result, '<img src="https://cdn/file.jpg"><a href="https://cdn/file.jpg">link</a>');
});

test('multiple replacements: two different images in same HTML are each rewritten', () => {
  const result = rewriteAssetUrls(
    '<img src="legacy/a.jpg"><img src="legacy/b.jpg">',
    { 'legacy/a.jpg': 'https://cdn/a.jpg', 'legacy/b.jpg': 'https://cdn/b.jpg' }
  );
  assert.equal(result, '<img src="https://cdn/a.jpg"><img src="https://cdn/b.jpg">');
});

test('single-quote attrs: rewrites src in single-quoted attributes', () => {
  const result = rewriteAssetUrls(
    "<img src='legacy/img.jpg'>",
    { 'legacy/img.jpg': 'https://cdn/img.jpg' }
  );
  assert.equal(result, "<img src='https://cdn/img.jpg'>");
});

test('empty srcToUrl: returns HTML unchanged', () => {
  const html = '<img src="legacy/img.jpg"><a href="legacy/doc.pdf">x</a>';
  assert.equal(rewriteAssetUrls(html, {}), html);
});

test('Map input: accepts Map<string, string> as srcToUrl', () => {
  const map = new Map([['legacy/img.jpg', 'https://cdn/img.jpg']]);
  const result = rewriteAssetUrls('<img src="legacy/img.jpg">', map);
  assert.equal(result, '<img src="https://cdn/img.jpg">');
});
