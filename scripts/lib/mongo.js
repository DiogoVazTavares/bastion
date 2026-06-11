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
        throw new Error(
          `No document in '${collectionName}' for locale '${locale}' at ${new URL(mongoUrls[locale]).host}`
        );
      }
      docs[locale] = doc;
    } finally {
      await client.close();
    }
  }
  return docs;
}
