import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { StudentSRStatusRepository } from '../repositories/providers/mongodb/StudentSRStatusRepository.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/interfaces/models.js';

// ── In-memory DB setup ───────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let inMemoryDb: ReturnType<MongoClient['db']>;

// A minimal mock that satisfies what StudentSRStatusRepository needs from
// MongoDatabase. The repo only calls getCollection('users'), so we delegate
// to the in-memory collection.
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
  inMemoryDb = client.db('test_student_sr_status');
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongoServer?.stop();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const UID_A = 'uid_a_aaa';
const UID_B = 'uid_b_bbb';
const UID_C = 'uid_c_ccc';
const UID_MISSING = 'uid_does_not_exist';

function makeRepo(): StudentSRStatusRepository {
  return new StudentSRStatusRepository(makeMockMongoDb());
}

function makeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    firebaseUID: UID_A,
    email: 'a@example.com',
    firstName: 'A',
    roles: 'user',
    ...overrides,
  };
}

async function insertUsers(users: IUser[]): Promise<void> {
  const col = inMemoryDb.collection('users');
  // Cast: IUser doesn't statically extend Document, but the runtime shape is compatible.
  await col.insertMany(users as any);
}

async function findUserByUid(uid: string): Promise<IUser | null> {
  // Cast: findOne returns WithId<Document>; we know the schema matches IUser.
  return (await inMemoryDb.collection('users').findOne({ firebaseUID: uid })) as IUser | null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('StudentSRStatusRepository', () => {
  beforeEach(async () => {
    // Clear collection between tests so each test starts with a clean slate.
    await inMemoryDb.collection('users').deleteMany({});
  });

  // ─── getStatus ───────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns false when the user has no sr_disabled field (default = enabled)', async () => {
      await insertUsers([makeUser()]); // no sr_disabled
      const repo = makeRepo();

      const status = await repo.getStatus(UID_A);

      expect(status).toBe(false);
    });

    it('returns true when sr_disabled is explicitly set to true', async () => {
      await insertUsers([makeUser({ sr_disabled: true })]);
      const repo = makeRepo();

      const status = await repo.getStatus(UID_A);

      expect(status).toBe(true);
    });

    it('returns false when sr_disabled is explicitly set to false', async () => {
      await insertUsers([makeUser({ sr_disabled: false })]);
      const repo = makeRepo();

      const status = await repo.getStatus(UID_A);

      expect(status).toBe(false);
    });

    it('returns false when the user does not exist', async () => {
      const repo = makeRepo();

      const status = await repo.getStatus(UID_MISSING);

      expect(status).toBe(false);
    });

    it('does not mutate the user document', async () => {
      await insertUsers([makeUser({ sr_disabled: false })]);
      const repo = makeRepo();

      await repo.getStatus(UID_A);

      const after = await findUserByUid(UID_A);
      expect(after).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(after, 'sr_disabled')).toBe(true);
      expect(after.sr_disabled).toBe(false);
    });
  });

  // ─── getStatusForMany ────────────────────────────────────────────────────

  describe('getStatusForMany', () => {
    it('returns an empty Map when given an empty studentIds array', async () => {
      const repo = makeRepo();

      const map = await repo.getStatusForMany([]);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });

    it('returns a Map keyed by firebaseUID with each student\'s status', async () => {
      await insertUsers([
        makeUser({ firebaseUID: UID_A, sr_disabled: true  }),
        makeUser({ firebaseUID: UID_B, sr_disabled: false }),
        makeUser({ firebaseUID: UID_C }), // no flag — default false
      ]);
      const repo = makeRepo();

      const map = await repo.getStatusForMany([UID_A, UID_B, UID_C]);

      expect(map.size).toBe(3);
      expect(map.get(UID_A)).toBe(true);
      expect(map.get(UID_B)).toBe(false);
      expect(map.get(UID_C)).toBe(false);
    });

    it('returns a partial Map when some UIDs do not exist', async () => {
      await insertUsers([
        makeUser({ firebaseUID: UID_A, sr_disabled: true }),
      ]);
      const repo = makeRepo();

      const map = await repo.getStatusForMany([UID_A, UID_MISSING]);

      expect(map.size).toBe(1);
      expect(map.get(UID_A)).toBe(true);
      expect(map.has(UID_MISSING)).toBe(false);
    });
  });

  // ─── setStatus ───────────────────────────────────────────────────────────

  describe('setStatus', () => {
    it('sets sr_disabled=true on a user that did not have the field', async () => {
      await insertUsers([makeUser()]); // no sr_disabled
      const repo = makeRepo();

      const matched = await repo.setStatus(UID_A, true);

      expect(matched).toBe(true);
      const after = await findUserByUid(UID_A);
      expect(after.sr_disabled).toBe(true);
    });

    it('flips sr_disabled from false to true', async () => {
      await insertUsers([makeUser({ sr_disabled: false })]);
      const repo = makeRepo();

      const matched = await repo.setStatus(UID_A, true);

      expect(matched).toBe(true);
      const after = await findUserByUid(UID_A);
      expect(after.sr_disabled).toBe(true);
    });

    it('flips sr_disabled from true to false', async () => {
      await insertUsers([makeUser({ sr_disabled: true })]);
      const repo = makeRepo();

      const matched = await repo.setStatus(UID_A, false);

      expect(matched).toBe(true);
      const after = await findUserByUid(UID_A);
      expect(after.sr_disabled).toBe(false);
    });

    it('returns false when the user does not exist', async () => {
      const repo = makeRepo();

      const matched = await repo.setStatus(UID_MISSING, true);

      expect(matched).toBe(false);
    });

    it('does not disturb other user fields', async () => {
      await insertUsers([makeUser({ firstName: 'Original', email: 'orig@example.com' })]);
      const repo = makeRepo();

      await repo.setStatus(UID_A, true);

      const after = await findUserByUid(UID_A);
      expect(after.firstName).toBe('Original');
      expect(after.email).toBe('orig@example.com');
      expect(after.sr_disabled).toBe(true);
    });
  });

  // ─── setStatusForMany ────────────────────────────────────────────────────

  describe('setStatusForMany', () => {
    it('returns {0, 0} when given an empty studentIds array', async () => {
      const repo = makeRepo();

      const result = await repo.setStatusForMany([], true);

      expect(result).toEqual({ matchedCount: 0, modifiedCount: 0 });
    });

    it('sets sr_disabled=true on all matched users (all-new)', async () => {
      await insertUsers([
        makeUser({ firebaseUID: UID_A }),
        makeUser({ firebaseUID: UID_B }),
        makeUser({ firebaseUID: UID_C }),
      ]);
      const repo = makeRepo();

      const result = await repo.setStatusForMany([UID_A, UID_B, UID_C], true);

      expect(result).toEqual({ matchedCount: 3, modifiedCount: 3 });
      const a = await findUserByUid(UID_A);
      const b = await findUserByUid(UID_B);
      const c = await findUserByUid(UID_C);
      expect(a.sr_disabled).toBe(true);
      expect(b.sr_disabled).toBe(true);
      expect(c.sr_disabled).toBe(true);
    });

    it('returns matchedCount=N, modifiedCount=0 when all already have the value', async () => {
      await insertUsers([
        makeUser({ firebaseUID: UID_A, sr_disabled: true }),
        makeUser({ firebaseUID: UID_B, sr_disabled: true }),
      ]);
      const repo = makeRepo();

      const result = await repo.setStatusForMany([UID_A, UID_B], true);

      expect(result).toEqual({ matchedCount: 2, modifiedCount: 0 });
    });

    it('returns matchedCount=N, modifiedCount=flip-count on a partial flip', async () => {
      // A: already true (no flip), B: false → true (flip), C: no field (new flip)
      await insertUsers([
        makeUser({ firebaseUID: UID_A, sr_disabled: true  }),
        makeUser({ firebaseUID: UID_B, sr_disabled: false }),
        makeUser({ firebaseUID: UID_C }), // no field
      ]);
      const repo = makeRepo();

      const result = await repo.setStatusForMany([UID_A, UID_B, UID_C], true);

      expect(result.matchedCount).toBe(3);
      expect(result.modifiedCount).toBe(2); // B + C flipped
    });

    it('counts matched but not modified for unknown UIDs', async () => {
      await insertUsers([makeUser({ firebaseUID: UID_A })]);
      const repo = makeRepo();

      const result = await repo.setStatusForMany([UID_A, UID_MISSING], true);

      expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 });
      const a = await findUserByUid(UID_A);
      expect(a.sr_disabled).toBe(true);
    });

    it('flips all matched users from true to false', async () => {
      await insertUsers([
        makeUser({ firebaseUID: UID_A, sr_disabled: true }),
        makeUser({ firebaseUID: UID_B, sr_disabled: true }),
      ]);
      const repo = makeRepo();

      const result = await repo.setStatusForMany([UID_A, UID_B], false);

      expect(result).toEqual({ matchedCount: 2, modifiedCount: 2 });
      const a = await findUserByUid(UID_A);
      const b = await findUserByUid(UID_B);
      expect(a.sr_disabled).toBe(false);
      expect(b.sr_disabled).toBe(false);
    });
  });
});
