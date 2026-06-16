import mongodb from 'mongodb';
const { MongoClient } = mongodb;

export const LOCALES = ['en', 'fr', 'nl'];

/**
 * Reads one document from `collectionName` in each DB specified in mongoUrls.
 * Returns an object keyed by the same locales as mongoUrls.
 *
 * Pass all three locale URLs to fetch in bulk, or a single-locale subset to
 * fetch incrementally (e.g. for per-locale progress feedback in a caller loop).
 */
export async function fetchLocaleDocuments(mongoUrls, collectionName) {
  const locales = Object.keys(mongoUrls);
  for (const locale of locales) {
    if (!mongoUrls[locale]) {
      throw new Error(`fetchLocaleDocuments: missing URL for locale '${locale}'`);
    }
  }

  const docs = {};
  for (const locale of locales) {
    const client = new MongoClient(mongoUrls[locale]);
    try {
      await client.connect();
      const doc = await client
        .db()
        .collection(collectionName)
        .findOne({}, { projection: { _id: 0 } });
      if (!doc) {
        let hostHint;
        try { hostHint = new URL(mongoUrls[locale]).host; } catch { hostHint = '<unparseable URL>'; }
        throw new Error(
          `No document in '${collectionName}' for locale '${locale}' at ${hostHint}`
        );
      }
      docs[locale] = doc;
    } finally {
      await client.close().catch(() => {});
    }
  }
  return docs;
}

/**
 * Fetches all documents from `collectionName` in each DB specified in mongoUrls.
 * Returns an object keyed by the same locales as mongoUrls, each value an array.
 */
export async function fetchAllLocaleDocuments(mongoUrls, collectionName, projection = {}) {
  const locales = Object.keys(mongoUrls);
  for (const locale of locales) {
    if (!mongoUrls[locale]) {
      throw new Error(`fetchAllLocaleDocuments: missing URL for locale '${locale}'`);
    }
  }

  const docs = {};
  for (const locale of locales) {
    const client = new MongoClient(mongoUrls[locale]);
    try {
      await client.connect();
      docs[locale] = await client
        .db()
        .collection(collectionName)
        .find({}, { projection })
        .toArray();
    } finally {
      await client.close().catch(() => {});
    }
  }
  return docs;
}
