/**
 * Strapi REST API client helpers.
 *
 * All functions read STRAPI_URL and STRAPI_TOKEN from the environment.
 * Call validateStrapiEnv() at script startup to fail fast on missing config.
 */

function strapiUrl() {
  return (process.env.STRAPI_URL ?? '').replace(/\/$/, '');
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
 */
export async function putLocale(singleType, locale, data) {
  const url = `${strapiUrl()}/api/${singleType}?locale=${locale}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ data }),
  });

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 404) {
      return createLocalization(singleType, locale, data);
    }
    throw new Error(
      `Strapi PUT /${singleType}?locale=${locale} failed (${res.status}):\n${JSON.stringify(json, null, 2)}`
    );
  }

  return json;
}

async function createLocalization(singleType, locale, data) {
  const url = `${strapiUrl()}/api/${singleType}/localizations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...data, locale }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Strapi POST /${singleType}/localizations for ${locale} failed (${res.status}):\n${JSON.stringify(json, null, 2)}`
    );
  }
  return json;
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

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Strapi upload of '${filename}' failed (${res.status}):\n${JSON.stringify(json, null, 2)}`
    );
  }
  return json[0];
}
