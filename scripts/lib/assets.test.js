import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAssets, loadManifest, saveManifest } from './assets.js';

// ---------------------------------------------------------------------------
// resolveAssets
// ---------------------------------------------------------------------------

test('reused asset: fetchBytes and upload are never called', async () => {
  const fetchCalls = [];
  const uploadCalls = [];

  const fileRefs = [{ Id: 'abc', Legend: 'Alt', Name: 'photo.jpg', Src: 'https://example.com/photo.jpg', MimeType: 'image/jpeg' }];
  const manifest = { abc: 42 };

  const { ids, stats } = await resolveAssets(fileRefs, manifest, {
    fetchBytes: src => { fetchCalls.push(src); return Buffer.from(''); },
    upload: () => { uploadCalls.push(true); return { id: 99, url: '' }; },
  });

  assert.equal(fetchCalls.length, 0);
  assert.equal(uploadCalls.length, 0);
  assert.equal(ids.get('abc'), 42);
  assert.equal(stats.reused, 1);
  assert.equal(stats.uploaded, 0);
});

test('within-run dedup: two fileRefs with same Id upload exactly once', async () => {
  const uploadCalls = [];

  const fileRefs = [
    { Id: 'dup', Legend: 'Alt EN', Name: 'img.png', Src: 'https://example.com/img.png', MimeType: 'image/png' },
    { Id: 'dup', Legend: 'Alt FR', Name: 'img.png', Src: 'https://example.com/img.png', MimeType: 'image/png' },
  ];

  const { ids, stats } = await resolveAssets(fileRefs, {}, {
    fetchBytes: async () => Buffer.from('bytes'),
    upload: async (filename, buffer, mimeType, altText) => {
      uploadCalls.push({ filename, mimeType, altText });
      return { id: 7, url: 'https://cdn/img.png' };
    },
  });

  assert.equal(uploadCalls.length, 1, 'upload called exactly once');
  assert.equal(ids.get('dup'), 7);
  assert.equal(stats.uploaded, 1);
  assert.equal(stats.reused, 0);
});

test('field mapping: Legend → altText, Name → filename, MimeType → mimeType', async () => {
  const uploadCalls = [];

  const fileRefs = [
    { Id: 'x1', Legend: 'My alt text', Name: 'hero.jpg', Src: 'https://example.com/hero.jpg', MimeType: 'image/jpeg' },
  ];

  await resolveAssets(fileRefs, {}, {
    fetchBytes: async () => Buffer.from('data'),
    upload: async (filename, buffer, mimeType, altText) => {
      uploadCalls.push({ filename, mimeType, altText });
      return { id: 1, url: '' };
    },
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0].filename, 'hero.jpg');
  assert.equal(uploadCalls[0].mimeType, 'image/jpeg');
  assert.equal(uploadCalls[0].altText, 'My alt text');
});

test('missing MimeType falls back to application/octet-stream', async () => {
  const uploadCalls = [];

  const fileRefs = [
    { Id: 'y1', Legend: 'Doc', Name: 'file.bin', Src: 'https://example.com/file.bin' },
  ];

  await resolveAssets(fileRefs, {}, {
    fetchBytes: async () => Buffer.from('x'),
    upload: async (filename, buffer, mimeType, altText) => {
      uploadCalls.push({ mimeType });
      return { id: 2, url: '' };
    },
  });

  assert.equal(uploadCalls[0].mimeType, 'application/octet-stream');
});

test('stats: uploaded and reused counts are correct for mixed batch', async () => {
  const fileRefs = [
    { Id: 'new1', Legend: '', Name: 'a.jpg', Src: 'https://example.com/a.jpg', MimeType: 'image/jpeg' },
    { Id: 'new2', Legend: '', Name: 'b.jpg', Src: 'https://example.com/b.jpg', MimeType: 'image/jpeg' },
    { Id: 'old1', Legend: '', Name: 'c.jpg', Src: 'https://example.com/c.jpg', MimeType: 'image/jpeg' },
  ];
  const manifest = { old1: 55 };

  let uploadCount = 0;
  const { stats } = await resolveAssets(fileRefs, manifest, {
    fetchBytes: async () => Buffer.from(''),
    upload: async () => { uploadCount++; return { id: uploadCount, url: '' }; },
  });

  assert.equal(stats.uploaded, 2);
  assert.equal(stats.reused, 1);
});

test('manifest is updated with newly uploaded ids', async () => {
  let nextId = 10;
  const fileRefs = [
    { Id: 'z1', Legend: '', Name: 'z1.jpg', Src: 'https://example.com/z1.jpg', MimeType: 'image/jpeg' },
  ];

  const { manifest } = await resolveAssets(fileRefs, {}, {
    fetchBytes: async () => Buffer.from(''),
    upload: async () => ({ id: nextId++, url: '' }),
  });

  assert.equal(manifest['z1'], 10);
});

// ---------------------------------------------------------------------------
// verify — self-healing manifest
// ---------------------------------------------------------------------------

test('hit-present: verify returns true → upload never called, stats.reused === 1', async () => {
  const uploadCalls = [];
  const verifyCalls = [];

  const fileRefs = [{ Id: 'alive', Legend: 'Alt', Name: 'alive.jpg', Src: 'https://example.com/alive.jpg', MimeType: 'image/jpeg' }];
  const manifest = { alive: 42 };

  const { ids, stats } = await resolveAssets(fileRefs, manifest, {
    fetchBytes: async () => Buffer.from(''),
    upload: async () => { uploadCalls.push(true); return { id: 99, url: '' }; },
    verify: async (id) => { verifyCalls.push(id); return true; },
  });

  assert.equal(uploadCalls.length, 0, 'upload must not be called');
  assert.equal(verifyCalls.length, 1);
  assert.equal(verifyCalls[0], 42);
  assert.equal(ids.get('alive'), 42);
  assert.equal(stats.reused, 1);
  assert.equal(stats.uploaded, 0);
});

test('hit-missing (self-heal): verify returns false → upload called, manifest overwritten, stats.uploaded === 1', async () => {
  const uploadCalls = [];

  const fileRefs = [{ Id: 'dead', Legend: 'Alt', Name: 'dead.jpg', Src: 'https://example.com/dead.jpg', MimeType: 'image/jpeg' }];
  const manifest = { dead: 42 };

  const { manifest: updatedManifest, ids, stats } = await resolveAssets(fileRefs, manifest, {
    fetchBytes: async () => Buffer.from('bytes'),
    upload: async (filename, buffer, mimeType, altText) => {
      uploadCalls.push({ filename, altText });
      return { id: 77, url: '' };
    },
    verify: async () => false,
  });

  assert.equal(uploadCalls.length, 1, 'upload must be called exactly once');
  assert.equal(ids.get('dead'), 77);
  assert.equal(updatedManifest['dead'], 77, 'manifest entry must be overwritten with new id');
  assert.equal(stats.uploaded, 1);
  assert.equal(stats.reused, 0);
});

test('miss: id not in manifest → upload called, verify never called', async () => {
  const uploadCalls = [];
  const verifyCalls = [];

  const fileRefs = [{ Id: 'new', Legend: 'Alt', Name: 'new.jpg', Src: 'https://example.com/new.jpg', MimeType: 'image/jpeg' }];

  const { ids, stats } = await resolveAssets(fileRefs, {}, {
    fetchBytes: async () => Buffer.from(''),
    upload: async () => { uploadCalls.push(true); return { id: 5, url: '' }; },
    verify: async (id) => { verifyCalls.push(id); return true; },
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(verifyCalls.length, 0, 'verify must not be called on a manifest miss');
  assert.equal(ids.get('new'), 5);
  assert.equal(stats.uploaded, 1);
  assert.equal(stats.reused, 0);
});

test('verify optional: omitting verify still reuses manifest hit without error', async () => {
  const uploadCalls = [];

  const fileRefs = [{ Id: 'cached', Legend: 'Alt', Name: 'cached.jpg', Src: 'https://example.com/cached.jpg', MimeType: 'image/jpeg' }];
  const manifest = { cached: 10 };

  const { ids, stats } = await resolveAssets(fileRefs, manifest, {
    fetchBytes: async () => Buffer.from(''),
    upload: async () => { uploadCalls.push(true); return { id: 99, url: '' }; },
    // no verify
  });

  assert.equal(uploadCalls.length, 0, 'upload must not be called');
  assert.equal(ids.get('cached'), 10);
  assert.equal(stats.reused, 1);
  assert.equal(stats.uploaded, 0);
});

// ---------------------------------------------------------------------------
// loadManifest / saveManifest
// ---------------------------------------------------------------------------

test('loadManifest returns {} when file does not exist', async () => {
  const missing = join(tmpdir(), `bastion-test-missing-${Date.now()}.json`);
  const result = await loadManifest(missing);
  assert.deepEqual(result, {});
});

test('saveManifest writes JSON and loadManifest reads it back', async () => {
  const path = join(tmpdir(), `bastion-test-manifest-${Date.now()}.json`);
  const data = { abc: 1, def: 2 };
  await saveManifest(path, data);
  const loaded = await loadManifest(path);
  assert.deepEqual(loaded, data);
});

test('saveManifest writes 2-space indented JSON with trailing newline', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = join(tmpdir(), `bastion-test-indent-${Date.now()}.json`);
  await saveManifest(path, { a: 1 });
  const raw = await readFile(path, 'utf8');
  assert.ok(raw.endsWith('\n'), 'must end with newline');
  assert.ok(raw.includes('  "a"'), 'must be 2-space indented');
});
