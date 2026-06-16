import { readFile, writeFile } from 'node:fs/promises';

export class AssetResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssetResolutionError';
  }
}

/**
 * Resolves an array of FileRef objects to Strapi media IDs.
 *
 * Identity key: FileRef.Id — stable across re-runs and locales.
 * Idempotency: manifest is checked before any upload; same Id uploaded once.
 *
 * @param {Array<{Id: string, Legend: string, Name: string, Src: string, MimeType?: string}>} fileRefs
 * @param {Record<string, number>} manifest  - keyed by FileRef.Id → Strapi media id
 * @param {{ fetchBytes: (src: string) => Promise<Buffer>, upload: (filename: string, buffer: Buffer, mimeType: string, altText: string) => Promise<{id: number, url: string}>, verify?: (strapiId: number) => Promise<boolean> }} fns
 * @returns {Promise<{ manifest: Record<string, number>, ids: Map<string, number>, stats: { uploaded: number, reused: number } }>}
 */
export async function resolveAssets(fileRefs, manifest, { fetchBytes, upload, verify }) {
  const updatedManifest = { ...manifest };
  const ids = new Map();
  const stats = { uploaded: 0, reused: 0 };

  // within-run dedup: track Ids already resolved this run (may not yet be in manifest)
  const pendingById = new Map(); // Id → Promise<number>

  for (const ref of fileRefs) {
    const { Id, Legend: altText, Name: filename, Src: src } = ref;
    const mimeType = ref.MimeType ?? 'application/octet-stream';

    if (ids.has(Id)) {
      // already processed this Id in this run — reuse without incrementing reused again
      continue;
    }

    if (updatedManifest[Id] !== undefined) {
      // cross-run dedup: already in manifest from a previous run
      const strapiId = updatedManifest[Id];
      if (verify !== undefined) {
        const alive = await verify(strapiId);
        if (alive) {
          ids.set(Id, strapiId);
          stats.reused++;
          continue;
        }
        // stale manifest hit — fall through to re-upload below
      } else {
        ids.set(Id, strapiId);
        stats.reused++;
        continue;
      }
    }

    if (pendingById.has(Id)) {
      // within-run dedup: another fileRef with same Id is already being uploaded
      const strapiId = await pendingById.get(Id);
      ids.set(Id, strapiId);
      // don't increment stats — already counted when the first upload was scheduled
      continue;
    }

    // new upload
    const uploadPromise = (async () => {
      if (!src) {
        throw new AssetResolutionError(
          `AssetResolutionError: FileRef ${Id} ("${filename}") has no Src — cannot fetch`
        );
      }
      let buffer;
      try {
        buffer = await fetchBytes(src);
      } catch (err) {
        throw new AssetResolutionError(
          `AssetResolutionError: FileRef ${Id} ("${filename}") — fetchBytes failed for "${src}": ${err.message}`
        );
      }
      const media = await upload(filename, buffer, mimeType, altText);
      return media.id;
    })();

    pendingById.set(Id, uploadPromise);

    const strapiId = await uploadPromise;
    ids.set(Id, strapiId);
    updatedManifest[Id] = strapiId;
    stats.uploaded++;
  }

  return { manifest: updatedManifest, ids, stats };
}

/**
 * Reads the asset manifest from disk.
 * Returns {} if the file does not exist.
 *
 * @param {string} path
 * @returns {Promise<Record<string, number>>}
 */
export async function loadManifest(path) {
  try {
    const contents = await readFile(path, 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Writes the asset manifest to disk (2-space indent, trailing newline).
 *
 * @param {string} path
 * @param {Record<string, number>} manifest
 */
export async function saveManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
