/**
 * One-off: create the Atlas Vector Search index on the embeddings collection.
 *
 *   pnpm --filter backend exec tsx src/modules/studentQuestions/scripts/setupVectorIndex.ts
 *
 * Safe to re-run — an existing index is reported and left alone.
 *
 * Requires `VECTOR_DB_URL` (a cluster of its own; the application DB is never
 * touched). Atlas supports Vector Search on the free M0 tier for development;
 * production needs M10 or higher.
 *
 * `numDimensions` must match the embedding model (all-MiniLM-L6-v2 → 384). If the
 * model ever changes, this index and every stored vector must be rebuilt together —
 * vectors from two different models are not comparable.
 *
 * `segmentId` is indexed as a filter field: a question can only duplicate another
 * question on the SAME lesson segment, and pre-filtering keeps the ANN search from
 * ranging over the entire bank.
 */
import 'dotenv/config';
import {MongoClient} from 'mongodb';
import {screeningConfig} from '#root/config/screening.js';

const {dbUrl, dbName, collection, indexName} = screeningConfig.vector;
const DIMS = 384; // all-MiniLM-L6-v2

async function run() {
  if (!dbUrl) {
    console.error('VECTOR_DB_URL is not set. Add it to backend/.env first.');
    process.exit(1);
  }

  const client = new MongoClient(dbUrl);
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`cluster : ${dbName}`);
    console.log(`target  : ${collection}.${indexName}\n`);

    // The collection must exist before an index can be built on it.
    const existing = await db.listCollections({name: collection}).toArray();
    if (existing.length === 0) {
      await db.createCollection(collection);
      console.log(`created collection "${collection}"`);
    }

    const coll = db.collection(collection);

    const indexes = await coll.listSearchIndexes().toArray().catch(() => []);
    if (indexes.some((i: any) => i.name === indexName)) {
      console.log(`✅ index "${indexName}" already exists — nothing to do.`);
      return;
    }

    await coll.createSearchIndex({
      name: indexName,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: DIMS,
            // Vectors are L2-normalised by the provider, so cosine is exact.
            // NOTE: Atlas reports this as (1 + cosine) / 2 — QuestionVectorRepository
            // converts it back, so thresholds stay in raw-cosine units.
            similarity: 'cosine',
          },
          {type: 'filter', path: 'segmentId'},
        ],
      },
    } as any);

    console.log(`✅ created vector index "${indexName}" (${DIMS}d, cosine, filter: segmentId)`);
    console.log('   Atlas builds it asynchronously — it may take a minute to become queryable.');
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('failed:', err?.message ?? err);
  process.exit(1);
});
