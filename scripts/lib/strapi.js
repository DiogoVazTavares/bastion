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
 * PUT data for a locale on a Strapi single-type.
 * Falls back to POST /localizations when the locale variant does not exist yet.
 * Note: a 404 on a mistyped singleType also reaches the fallback; the subsequent
 * POST will then fail with a more specific error.
 */
export async function putLocale(singleType, locale, data) {
  const url = `${strapiUrl()}/api/${singleType}?locale=${locale}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      return createLocalization(singleType, locale, data);
    }
    const body = await res.text();
    throw new Error(
      `Strapi PUT /${singleType}?locale=${locale} failed (${res.status}):\n${body}`
    );
  }

  return res.json();
}

async function createLocalization(singleType, locale, data) {
  const url = `${strapiUrl()}/api/${singleType}/localizations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...data, locale }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Strapi POST /${singleType}/localizations for ${locale} failed (${res.status}):\n${body}`
    );
  }
  return res.json();
}

/**
 * Upload a file buffer to the Strapi media library.
 * Returns the Strapi media object { id, url, ... }.
 */
export async function uploadMedia(filename, buffer, mimeType) {
  const form = new FormData();
  form.append('files', new Blob([buffer], { type: mimeType }), filename);

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
