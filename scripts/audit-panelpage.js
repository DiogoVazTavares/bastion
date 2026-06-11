#!/usr/bin/env node
/**
 * Audit: PanelPage — issue #5
 *
 * Queries the `panelpages` collection in all three locale DBs (en, fr, nl)
 * and reports whether any documents exist.
 *
 * Required env vars:
 *   MONGO_URL_EN     Full MongoDB URI for the English DB
 *   MONGO_URL_FR     Full MongoDB URI for the French DB
 *   MONGO_URL_NL     Full MongoDB URI for the Dutch DB
 *
 * Optional env vars (for posting the result as a GitHub issue comment):
 *   GH_TOKEN         GitHub personal access token
 *
 * Run:
 *   cd scripts
 *   MONGO_URL_EN=... MONGO_URL_FR=... MONGO_URL_NL=... node audit-panelpage.js
 */

import { fetchAllLocaleDocuments } from './lib/mongo.js';
import { buildIssueComment } from './lib/report.js';

const LOCALES = ['en', 'fr', 'nl'];
const COLLECTION = 'PanelPage';
const ISSUE_NUMBER = 5;
const REPO = 'DiogoVazTavares/bastion';

const MONGO_URLS = {
  en: process.env.MONGO_URL_EN,
  fr: process.env.MONGO_URL_FR,
  nl: process.env.MONGO_URL_NL,
};

function validateEnv() {
  const missing = LOCALES.filter(l => !MONGO_URLS[l]).map(l => `MONGO_URL_${l.toUpperCase()}`);
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
}

async function postGitHubComment(comment) {
  const token = process.env.GH_TOKEN;
  if (!token) {
    console.log('\nGH_TOKEN not set — skipping GitHub comment. Paste the comment above manually.');
    return;
  }

  const url = `https://api.github.com/repos/${REPO}/issues/${ISSUE_NUMBER}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: comment }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  console.log(`\nComment posted: ${data.html_url}`);
}

async function closeGitHubIssue() {
  const token = process.env.GH_TOKEN;
  if (!token) return;

  const url = `https://api.github.com/repos/${REPO}/issues/${ISSUE_NUMBER}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: 'closed' }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error closing issue ${res.status}: ${text}`);
  }
  console.log(`Issue #${ISSUE_NUMBER} closed.`);
}

async function main() {
  validateEnv();

  console.log(`Querying '${COLLECTION}' collection across locale DBs…`);
  const results = await fetchAllLocaleDocuments(MONGO_URLS, COLLECTION, { _id: 0, Title: 1, UID: 1 });

  for (const locale of LOCALES) {
    console.log(`  [${locale}] ${results[locale].length} document(s)`);
  }

  const comment = buildIssueComment(COLLECTION, results);
  console.log('\n--- Issue comment ---\n');
  console.log(comment);
  console.log('\n---------------------\n');

  await postGitHubComment(comment);

  const total = LOCALES.reduce((sum, l) => sum + results[l].length, 0);
  if (total === 0) {
    await closeGitHubIssue();
  } else {
    console.log(`\n⚠  ${total} PanelPage document(s) found — open a follow-up issue before starting Building (issue #12).`);
  }
}

main().catch(err => {
  console.error('\n' + err.message);
  process.exit(1);
});
