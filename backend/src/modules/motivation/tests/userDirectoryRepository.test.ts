import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { UserDirectoryRepository } from '../repositories/index.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/interfaces/models.js';

// ── In-memory DB setup ───────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let inMemoryDb: ReturnType<MongoClient['db']>;

// Minimal mock delegating to the in-memory collection.
function makeMockMongoDb(): MongoDatabase {
  return {
    getCollection: (name: string) => inMemoryDb.collection(name),
  } as unknown as MongoDatabase;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  inMemoryDb = client.db('test_motivation');
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongoServer?.stop();
});

beforeEach(async () => {
  // Start each test with a clean users collection.
  await inMemoryDb.collection('users').deleteMany({});
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo(): UserDirectoryRepository {
  return new UserDirectoryRepository(makeMockMongoDb());
}

async function insertUsers(users: Partial<IUser>[]): Promise<void> {
  const col = inMemoryDb.collection('users');
  // IUser._id is `string | ObjectId | null`, but Mongo's insertMany
  // expects `OptionalId<Document>` whose `_id` is `ObjectId`. Cast
  // through unknown to bypass the structural mismatch — these are
  // test fixtures and the inserted shapes are controlled by the
  // test cases below.
  await col.insertMany(users as unknown as Parameters<typeof col.insertMany>[0]);
}

const UID_A = 'uid_a_001';
const UID_B = 'uid_b_002';
const UID_C = 'uid_c_003';
const UID_MISSING = 'uid_does_not_exist';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UserDirectoryRepository', () => {
  describe('getDisplayNamesByFirebaseUIDs', () => {
    it('returns an empty Map for an empty input without touching the DB', async () => {
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([]);
      expect(map.size).toBe(0);
    });

    it('resolves firstName + lastName when both are present', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Bharat', lastName: 'Kumar' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([UID_A]);
      expect(map.get(UID_A)).toBe('Bharat Kumar');
    });

    it('resolves firstName only when lastName is missing', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Asha' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([UID_A]);
      expect(map.get(UID_A)).toBe('Asha');
    });

    it('resolves firstName only when lastName is an empty string', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Asha', lastName: '' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([UID_A]);
      expect(map.get(UID_A)).toBe('Asha');
    });

    it('trims whitespace from firstName and lastName', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: '  Bharat  ', lastName: '  Kumar  ' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([UID_A]);
      // Each piece is trimmed individually, then joined with a single
      // space — internal padding doesn't survive the trim.
      expect(map.get(UID_A)).toBe('Bharat Kumar');
    });

    it('treats a whitespace-only lastName as missing', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Asha', lastName: '   ' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([UID_A]);
      expect(map.get(UID_A)).toBe('Asha');
    });

    it('returns the requested subset when some UIDs are missing from the collection', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Bharat', lastName: 'Kumar' },
        { firebaseUID: UID_B, firstName: 'Asha' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([
        UID_A,
        UID_B,
        UID_MISSING,
      ]);
      expect(map.size).toBe(2);
      expect(map.get(UID_A)).toBe('Bharat Kumar');
      expect(map.get(UID_B)).toBe('Asha');
      expect(map.has(UID_MISSING)).toBe(false);
    });

    it('returns a single batched result for many UIDs in one query', async () => {
      const uids = [UID_A, UID_B, UID_C];
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Bharat', lastName: 'Kumar' },
        { firebaseUID: UID_B, firstName: 'Asha' },
        { firebaseUID: UID_C, firstName: 'Chandra' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs(uids);
      expect(map.size).toBe(3);
      expect(map.get(UID_A)).toBe('Bharat Kumar');
      expect(map.get(UID_B)).toBe('Asha');
      expect(map.get(UID_C)).toBe('Chandra');
    });

    it('returns an empty Map when no users match', async () => {
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Bharat' },
      ]);
      const repo = makeRepo();
      const map = await repo.getDisplayNamesByFirebaseUIDs([
        'not_in_db_1',
        'not_in_db_2',
      ]);
      expect(map.size).toBe(0);
    });

    it('produces deterministic per-instance results (no init state leaks between tests)', async () => {
      // First instance resolves, then a fresh instance on the same
      // collection must produce the same result (no module-scoped state).
      await insertUsers([
        { firebaseUID: UID_A, firstName: 'Bharat', lastName: 'Kumar' },
      ]);
      const repo1 = makeRepo();
      const repo2 = makeRepo();
      const map1 = await repo1.getDisplayNamesByFirebaseUIDs([UID_A]);
      const map2 = await repo2.getDisplayNamesByFirebaseUIDs([UID_A]);
      expect(map1.get(UID_A)).toBe('Bharat Kumar');
      expect(map2.get(UID_A)).toBe('Bharat Kumar');
    });
  });
});