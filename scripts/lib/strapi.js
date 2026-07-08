/**
 * Strapi REST API client helpers.
 *
 * All functions read STRAPI_URL and STRAPI_TOKEN from the environment.
 * Call validateStrapiEnv() at script startup to fail fast on missing config.
 */

function strapiUrl() {
  const url = process.env.STRAPI_URL;
  if (!url) throw new Error('STRAPI_URL env var is not set — call validateStrapiEnv() at startup');
  return url.replace(/\/$/, '');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
  };
}

export function validateStrapiEnv() {
  const missing = [];
  if (!process.env.STRAPI_URL) missing.push('STRAPI_URL');
  if (!process.env.STRAPI_TOKEN) missing.push('STRAPI_TOKEN');
  if (missing.length) {
    console.error('Missing required env vars:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
}

/**
 * PUT data for a locale on a Strapi single-type, writing to both draft and published.
 *
 * Strapi v5 draftAndPublish: a PUT without ?status= writes only the draft; the
 * published copy retains whatever components were last explicitly published.  When the
 * building page has localized repeatable components (building-item) inside a dynamic
 * zone, writing fr/nl drafts and then calling a separate publish step causes Strapi to
 * regenerate the published component rows for the last-written locale only, silently
 * dropping item links for earlier locales.
 *
 * Fix: pass ?status=published so Strapi writes both the draft and the published version
 * in a single call — the returned entry carries a non-null publishedAt.
 *
 * For the default locale (en): omits ?locale= so Strapi v5 treats it as an upsert.
 * Falls back to POST /localizations when a non-default locale variant does not exist yet,
 * then immediately publishes with a second PUT ?status=published.
 */
export async function putLocale(singleType, locale, data) {
  const url = locale === 'en'
    ? `${strapiUrl()}/api/${singleType}?status=published`
    : `${strapiUrl()}/api/${singleType}?locale=${locale}&status=published`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      return createLocalizationAndPublish(singleType, locale, data);
    }
    const body = await res.text();
    throw new Error(
      `Strapi PUT /${singleType}?status=published${locale !== 'en' ? `&locale=${locale}` : ''} failed (${res.status}):\n${body}`
    );
  }

  return res.json();
}

/**
 * Creates a new locale variant via POST /localizations (draft), then immediately
 * publishes it via PUT ?status=published.  Used as the 404 fallback from putLocale
 * for locales that have never been written before.
 */
async function createLocalizationAndPublish(singleType, locale, data) {
  const createUrl = `${strapiUrl()}/api/${singleType}/localizations`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...data, locale }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(
      `Strapi POST /${singleType}/localizations for ${locale} failed (${createRes.status}):\n${body}`
    );
  }

  // Draft created — now publish it so the published copy has the correct components.
  const publishUrl = `${strapiUrl()}/api/${singleType}?locale=${locale}&status=published`;
  const publishRes = await fetch(publishUrl, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ data }),
  });

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(
      `Strapi PUT /${singleType}?locale=${locale}&status=published (post-create publish) failed (${publishRes.status}):\n${body}`
    );
  }

  return publishRes.json();
}

/**
 * Upload a file buffer to the Strapi media library.
 * Returns the Strapi media object { id, url, ... }.
 *
 * The legacy CMS uses a single Image.Legend value for both the img alt attribute and
 * the figcaption. We therefore set both alternativeText and caption to the same altText
 * value so that Astro's Slider component (which reads caption for <figcaption>) works
 * correctly. This matches _Slider.cshtml:28,32 which renders Legend in both places.
 *
 * @param {string} filename
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} [altText]  - sets both alternativeText and caption in Strapi media library
 */
export async function uploadMedia(filename, buffer, mimeType, altText) {
  const form = new FormData();
  form.append('files', new Blob([buffer], { type: mimeType }), filename);
  if (altText !== undefined) {
    form.append('fileInfo', JSON.stringify({
      alternativeText: altText,
      caption: altText,
      name: filename,
    }));
  }

  const url = `${strapiUrl()}/api/upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strapi upload of '${filename}' failed (${res.status}):\n${body}`);
  }

  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(
      `Strapi upload of '${filename}' returned an unexpected response: ${JSON.stringify(json)}`
    );
  }
  return json[0];
}

/**
 * Updates the caption (and optionally alternativeText/name) of an existing Strapi media file.
 *
 * Uses POST /api/upload?id=<id> with a fileInfo multipart field — the Strapi v5 upload plugin
 * update path, confirmed working against the local instance.
 *
 * Called by resolveAssets when a manifest hit is found but the file's caption is null/empty,
 * so re-runs correctly backfill caption on already-uploaded images without re-uploading.
 *
 * @param {number} strapiId
 * @param {{ alternativeText?: string, caption?: string, name?: string }} fileInfo
 * @returns {Promise<object>} Updated Strapi media object.
 */
export async function updateMediaInfo(strapiId, fileInfo) {
  const form = new FormData();
  form.append('fileInfo', JSON.stringify(fileInfo));

  const url = `${strapiUrl()}/api/upload?id=${strapiId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strapi updateMediaInfo(${strapiId}) failed (${res.status}):\n${body}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}

/**
 * Checks whether a Strapi media file still exists.
 *
 * Returns true on 200, false on 404.
 * Throws on any other status (unexpected server error).
 *
 * @param {number} id  - Strapi media library id
 * @returns {Promise<boolean>}
 */
export async function verifyMedia(id) {
  const url = `${strapiUrl()}/api/upload/files/${id}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (res.status === 200) return true;
  if (res.status === 404) return false;

  const body = await res.text();
  throw new Error(`verifyMedia(${id}): unexpected status ${res.status}:\n${body}`);
}
