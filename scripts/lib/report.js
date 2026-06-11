import { LOCALES } from './mongo.js';

export function summariseAuditResults(results) {
  for (const locale of LOCALES) {
    if (!Array.isArray(results[locale])) {
      throw new Error(
        `summariseAuditResults: expected an array for locale '${locale}', got ${typeof results[locale]}`
      );
    }
  }
  const byLocale = Object.fromEntries(LOCALES.map(l => [l, results[l].length]));
  const total = LOCALES.reduce((sum, l) => sum + byLocale[l], 0);
  return { total, byLocale, isEmpty: total === 0 };
}

export function buildIssueComment(collectionName, results) {
  const { total, byLocale, isEmpty } = summariseAuditResults(results);

  if (isEmpty) {
    const zeroCounts = LOCALES.map(l => `${l}: ${byLocale[l]}`).join(', ');
    return `## Audit: \`${collectionName}\`\n\nNo documents found in any locale DB (${zeroCounts}).\n\n**Result:** no migration needed — issue can be closed.`;
  }

  const lines = [`## Audit: \`${collectionName}\`\n`, `Found **${total}** document(s) across locale DBs:\n`];
  for (const locale of LOCALES) {
    const docs = results[locale];
    if (docs.length === 0) {
      lines.push(`- **${locale}**: 0 documents`);
    } else {
      lines.push(`- **${locale}**: ${docs.length} document(s)`);
      for (const doc of docs) {
        lines.push(`  - Title: \`${doc.Title ?? '(none)'}\` — UID: \`${doc.UID ?? '(none)'}\``);
      }
    }
  }
  lines.push('\n**Result:** follow-up migration issue required before Building (issue #12) can start.');
  return lines.join('\n');
}
