// Called during ETL normalization after resolveAssets; rewrites legacy <img src> and
// <a href> URLs in rich-text fields to R2-backed media URLs.

/**
 * Extracts all unique src/href values from an HTML string.
 * Returns a deduplicated array of URL strings in document order.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function extractAssetUrls(html) {
  if (!html) return [];
  const seen = new Set();
  for (const [, , url] of html.matchAll(/\b(?:src|href)=(["'])(.*?)\1/g)) {
    seen.add(url);
  }
  return [...seen];
}

/**
 * Rewrites legacy asset URLs in an HTML string to R2-backed media URLs.
 *
 * @param {string} html - CKE5 rich-text HTML body
 * @param {Map<string, string>|Record<string, string>} srcToUrl - legacy src → R2 URL
 * @returns {string} HTML with matching src/href values replaced
 */
export function rewriteAssetUrls(html, srcToUrl) {
  if (!html) return html;

  const lookup = srcToUrl instanceof Map
    ? (k) => srcToUrl.get(k)
    : (k) => srcToUrl[k];

  return html.replace(/\b(src|href)=(["'])(.*?)\2/g, (match, attr, quote, url) => {
    const replacement = lookup(url);
    if (replacement === undefined) return match;
    return `${attr}=${quote}${replacement}${quote}`;
  });
}
