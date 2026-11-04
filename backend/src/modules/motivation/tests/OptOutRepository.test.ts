import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { OptOutRepository } from '../repositories/index.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';

// ── In-memory DB setup ───────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let inMemoryDb: ReturnType<MongoClient['db']>;

// Minimal mock delegating to the in-memory collection. Mirrors the
// UserDirectoryRepository test setup so the two repos are tested on
// the same MongoMemoryServer lifecycle.
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
  // Start each test with a clean opt-out collection.
  await inMemoryDb.collection('motivation_opt_outs').deleteMany({});
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo(): OptOutRepository {
  return new OptOutRepository(makeMockMongoDb());
}

const STUDENT_A = 'student_a_001';
const STUDENT_B = 'student_b_002';
const COURSE_X = 'course_x_history';
const COURSE_Y = 'course_y_math';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('OptOutRepository', () => {
  describe('setOptOut + getOptOutForCourse', () => {
    it('returns changed=true and a Date on first opt-out', async () => {
      const repo = makeRepo();
      const before = Date.now();
      const result = await repo.setOptOut(STUDENT_A, COURSE_X, true);
      const after = Date.now();
      expect(result.changed).toBe(true);
      expect(result.optedOutAt).toBeInstanceOf(Date);
      // The returned timestamp should be within the call window.
      expect(result.optedOutAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.optedOutAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it('persists so getOptOutForCourse returns true after setOptOut(true)', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      const optedOut = await repo.getOptOutForCourse(STUDENT_A, COURSE_X);
      expect(optedOut).toBe(true);
    });

    it('getOptOutForCourse returns false on a fresh DB', async () => {
      const repo = makeRepo();
      const optedOut = await repo.getOptOutForCourse(STUDENT_A, COURSE_X);
      expect(optedOut).toBe(false);
    });

    it('setOptOut(true) twice returns changed=false on the second call (idempotent)', async () => {
      const repo = makeRepo();
      const first = await repo.setOptOut(STUDENT_A, COURSE_X, true);
      expect(first.changed).toBe(true);
      const second = await repo.setOptOut(STUDENT_A, COURSE_X, true);
      expect(second.changed).toBe(false);
      // Timestamp refreshes even on no-op — caller decides whether the
      // new timestamp is meaningful. Surface it for now.
      expect(second.optedOutAt).toBeInstanceOf(Date);
    });

    it('setOptOut(false) on an existing doc returns changed=true and null optedOutAt', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      const result = await repo.setOptOut(STUDENT_A, COURSE_X, false);
      expect(result.changed).toBe(true);
      expect(result.optedOutAt).toBeNull();
      // Verify the doc is actually gone.
      const stillOptedOut = await repo.getOptOutForCourse(STUDENT_A, COURSE_X);
      expect(stillOptedOut).toBe(false);
    });

    it('setOptOut(false) on a non-existent doc returns changed=false (no-op)', async () => {
      const repo = makeRepo();
      const result = await repo.setOptOut(STUDENT_A, COURSE_X, false);
      expect(result.changed).toBe(false);
      expect(result.optedOutAt).toBeNull();
    });
  });

  describe('getOptOutsForStudent', () => {
    it('returns the array of courseIds a student has opted out of', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      await repo.setOptOut(STUDENT_A, COURSE_Y, true);
      const courses = await repo.getOptOutsForStudent(STUDENT_A);
      expect(courses.sort()).toEqual([COURSE_X, COURSE_Y].sort());
    });

    it('returns an empty array when the student has no opt-outs', async () => {
      const repo = makeRepo();
      // Add an opt-out for a *different* student to ensure isolation.
      await repo.setOptOut(STUDENT_B, COURSE_X, true);
      const courses = await repo.getOptOutsForStudent(STUDENT_A);
      expect(courses).toEqual([]);
    });

    it('does not include courses the student has come back from', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      await repo.setOptOut(STUDENT_A, COURSE_Y, true);
      await repo.setOptOut(STUDENT_A, COURSE_X, false); // come back
      const courses = await repo.getOptOutsForStudent(STUDENT_A);
      expect(courses).toEqual([COURSE_Y]);
    });
  });

  describe('getOptOutsForCourse (bulk)', () => {
    it('returns a Set of studentIds opted out of a single course', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      await repo.setOptOut(STUDENT_B, COURSE_X, true);
      // Plus a different-course opt-out to ensure we don't pick it up.
      await repo.setOptOut(STUDENT_A, COURSE_Y, true);
      const optedOutSet = await repo.getOptOutsForCourse(COURSE_X);
      expect(optedOutSet).toBeInstanceOf(Set);
      expect(optedOutSet.size).toBe(2);
      expect(optedOutSet.has(STUDENT_A)).toBe(true);
      expect(optedOutSet.has(STUDENT_B)).toBe(true);
      // STUDENT_A is in COURSE_X (just verified); no one else should
      // leak in from COURSE_Y.
      expect(optedOutSet.size).toBe(2);
    });

    it('returns an empty Set when no one has opted out of the course', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_Y, true); // different course
      const optedOutSet = await repo.getOptOutsForCourse(COURSE_X);
      expect(optedOutSet.size).toBe(0);
    });
  });

  describe('cross-course isolation', () => {
    it('opting out of one course does not affect the other', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      // COURSE_Y should still report opted-out = false.
      const yOptedOut = await repo.getOptOutForCourse(STUDENT_A, COURSE_Y);
      expect(yOptedOut).toBe(false);
      // And coming back on COURSE_X should not affect COURSE_Y.
      await repo.setOptOut(STUDENT_A, COURSE_X, false);
      const yAfterX = await repo.getOptOutForCourse(STUDENT_A, COURSE_Y);
      expect(yAfterX).toBe(false);
    });

    it('unique (studentId, courseId) index allows same student across courses', async () => {
      const repo = makeRepo();
      await repo.setOptOut(STUDENT_A, COURSE_X, true);
      await repo.setOptOut(STUDENT_A, COURSE_Y, true);
      // Both should now report opted-out.
      const x = await repo.getOptOutForCourse(STUDENT_A, COURSE_X);
      const y = await repo.getOptOutForCourse(STUDENT_A, COURSE_Y);
      expect(x).toBe(true);
      expect(y).toBe(true);
    });
  });
});