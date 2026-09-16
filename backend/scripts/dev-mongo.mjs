import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Matches backend/.env's DB_URL exactly (mongodb://127.0.0.1:27117/?replicaSet=testset)
// so the backend connects with zero config changes.
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, name: 'testset' },
  instanceOpts: [{ port: 27117 }],
});

console.log('MONGO_READY', replSet.getUri());

process.on('SIGINT', async () => {
  await replSet.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await replSet.stop();
  process.exit(0);
});
