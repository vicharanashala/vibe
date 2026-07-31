/**
 * Development helper: starts a MongoDB-Memory-Server instance,
 * sets DB_URL in process.env, then launches the real app entry point.
 *
 * Usage:  node scripts/dev-with-memory-db.js
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

console.log('[dev] Starting in-memory MongoDB...');
const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();

process.env.DB_URL = uri;
process.env.DB_NAME = process.env.DB_NAME || 'vibe';

console.log(`[dev] In-memory MongoDB running at: ${uri}`);

// Now import and run the real app
await import('../build/index.js');

// Graceful shutdown
const shutdown = async () => {
  console.log('[dev] Shutting down in-memory MongoDB...');
  await mongod.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
