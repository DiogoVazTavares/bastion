const LOCALES = ['en', 'fr', 'nl'];

export function summariseAuditResults(results) {
  const byLocale = Object.fromEntries(LOCALES.map(l => [l, results[l].length]));
  const total = LOCALES.reduce((sum, l) => sum + byLocale[l], 0);
  return { total, byLocale, isEmpty: total === 0 };
}

export function buildIssueComment(collectionName, results) {
  const { total, byLocale, isEmpty } = summariseAuditResults(results);

  if (isEmpty) {
    return `## Audit: \`${collectionName}\`\n\nNo documents found in any locale DB (en: 0, fr: 0, nl: 0).\n\n**Result:** no migration needed — issue can be closed.`;
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
