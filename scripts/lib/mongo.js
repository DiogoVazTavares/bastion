import mongodb from 'mongodb';
const { MongoClient } = mongodb;

const LOCALES = ['en', 'fr', 'nl'];

/**
 * Reads one document from `collectionName` in each of the three locale DBs.
 * Returns { en, fr, nl } keyed by locale.
 */
export async function fetchLocaleDocuments(mongoUrls, collectionName) {
  const docs = {};
  for (const locale of LOCALES) {
    const client = new MongoClient(mongoUrls[locale], {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    try {
      await client.connect();
      const doc = await client
        .db()
        .collection(collectionName)
        .findOne({}, { projection: { _id: 0 } });
      if (!doc) {
        throw new Error(
          `No document in '${collectionName}' collection at ${new URL(mongoUrls[locale]).host}`
        );
      }
      docs[locale] = doc;
    } finally {
      await client.close();
    }
  }
  return docs;
}
