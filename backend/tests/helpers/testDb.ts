import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';

let mongod: MongoMemoryServer | null = null;
let client: MongoClient | null = null;
let db: Db | null = null;

export async function setupTestDb(): Promise<{ uri: string; db: Db; client: MongoClient }> {
  if (mongod && client && db) return { uri: mongod.getUri(), db, client };
  mongod = await MongoMemoryServer.create({
    instance: { dbName: 'vibe-test' },
  });
  const uri = mongod.getUri();
  process.env.DB_URL = uri;
  process.env.MONGO_URI = uri;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('vibe-test');
  return { uri, db, client };
}

export async function teardownTestDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
  db = null;
}

export async function clearTestDb(): Promise<void> {
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
}

export function getTestDb(): Db {
  if (!db) throw new Error('Test DB not initialized. Call setupTestDb() in beforeAll.');
  return db;
}

export function getTestClient(): MongoClient {
  if (!client) throw new Error('Test client not initialized. Call setupTestDb() in beforeAll.');
  return client;
}
