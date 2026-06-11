import mongodb from 'mongodb';
const { MongoClient } = mongodb;

const LOCALES = ['en', 'fr', 'nl'];

/**
 * Fetches all documents from `collectionName` in each locale DB.
 * Returns { en, fr, nl } where each value is an array of documents.
 */
export async function fetchAllLocaleDocuments(mongoUrls, collectionName, projection = {}) {
  const docs = {};
  for (const locale of LOCALES) {
    const client = new MongoClient(mongoUrls[locale], {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    try {
      await client.connect();
      docs[locale] = await client
        .db()
        .collection(collectionName)
        .find({}, { projection })
        .toArray();
    } finally {
      await client.close();
    }
  }
  return docs;
}
