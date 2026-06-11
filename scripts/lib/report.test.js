import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summariseAuditResults, buildIssueComment } from './report.js';

// summariseAuditResults

test('summariseAuditResults reports zero total when all locales are empty', () => {
  const result = summariseAuditResults({ en: [], fr: [], nl: [] });
  assert.equal(result.total, 0);
  assert.equal(result.isEmpty, true);
  assert.deepEqual(result.byLocale, { en: 0, fr: 0, nl: 0 });
});

test('summariseAuditResults counts documents correctly across locales', () => {
  const doc = { Title: 'Test', UID: 'test' };
  const result = summariseAuditResults({ en: [doc, doc], fr: [doc], nl: [] });
  assert.equal(result.total, 3);
  assert.equal(result.isEmpty, false);
  assert.deepEqual(result.byLocale, { en: 2, fr: 1, nl: 0 });
});

test('summariseAuditResults throws with actionable message when a locale key is missing', () => {
  assert.throws(
    () => summariseAuditResults({ en: [], fr: [] }),
    /expected an array for locale 'nl'/
  );
});

test('summariseAuditResults throws with actionable message when a locale value is not an array', () => {
  assert.throws(
    () => summariseAuditResults({ en: [], fr: [], nl: null }),
    /expected an array for locale 'nl'/
  );
});

// buildIssueComment

test('buildIssueComment states no migration needed when all locales are empty', () => {
  const comment = buildIssueComment('PanelPage', { en: [], fr: [], nl: [] });
  assert.match(comment, /no documents found/i);
  assert.match(comment, /no migration needed/i);
  assert.match(comment, /en: 0.*fr: 0.*nl: 0/i);
});

test('buildIssueComment lists document titles and UIDs and recommends follow-up when docs exist', () => {
  const results = {
    en: [{ Title: 'About Us', UID: 'about-us' }],
    fr: [],
    nl: [],
  };
  const comment = buildIssueComment('PanelPage', results);
  assert.match(comment, /About Us/);
  assert.match(comment, /about-us/);
  assert.match(comment, /follow-up.*migration.*issue/i);
  assert.match(comment, /\*\*en\*\*: 1/);
  assert.match(comment, /\*\*nl\*\*: 0/);
});
