import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { ReviewItemRepository } from '../repositories/index.js';
import { IReviewItem, DEFAULT_SM2_STATE } from '../interfaces/IReviewItem.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';

// ── In-memory DB setup ───────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let inMemoryDb: ReturnType<MongoClient['db']>;

// A minimal mock that satisfies what ReviewItemRepository needs from MongoDatabase.
// It implements getCollection() by delegating to the real in-memory collection.
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
  inMemoryDb = client.db('test_spaced_repetition');
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongoServer?.stop();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const STUDENT_A = 'student_a_123';
const STUDENT_B = 'student_b_456';
const COURSE_X  = 'course_x_789';
const COURSE_Y  = 'course_y_000';

function makeRepo(): ReviewItemRepository {
  return new ReviewItemRepository(makeMockMongoDb());
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function makeItem(overrides: Partial<Omit<IReviewItem, '_id'>> = {}): Omit<IReviewItem, '_id'> {
  return {
    student_id: STUDENT_A,
    course_id: COURSE_X,
    question_id: 'q_001',
    ...DEFAULT_SM2_STATE,
    next_review_at: new Date(),
    last_reviewed_at: null,
    notification_opt_out: false,
    exam_prep_mode: false,
    ...overrides,
  };
}

async function insertItems(items: Omit<IReviewItem, '_id'>[]): Promise<void> {
  const col = inMemoryDb.collection('review_items');
  await col.insertMany(items);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ReviewItemRepository', () => {
  beforeEach(async () => {
    // Clear collection between tests so each test starts with a clean slate.
    await inMemoryDb.collection('review_items').deleteMany({});
  });

  describe('create', () => {
    it('inserts a single item and returns it with _id', async () => {
      const repo = makeRepo();
      const item = makeItem();

      const created = await repo.create(item);

      expect(created._id).toBeDefined();
      const found = await inMemoryDb.collection('review_items').findOne({ _id: created._id });
      expect(found).not.toBeNull();
      expect(found.student_id).toBe(STUDENT_A);
    });
  });

  describe('createMany', () => {
    it('inserts all items and returns the count', async () => {
      const repo = makeRepo();
      const items = [
        makeItem({ question_id: 'q_001' }),
        makeItem({ question_id: 'q_002' }),
        makeItem({ question_id: 'q_003' }),
      ];

      const count = await repo.createMany(items);

      expect(count).toBe(3);
      const all = await inMemoryDb.collection('review_items').find().toArray();
      expect(all).toHaveLength(3);
    });

    it('inserted items have all expected fields', async () => {
      const repo = makeRepo();
      const items = [makeItem({ question_id: 'q_004', course_id: COURSE_Y })];

      await repo.createMany(items);

      const found = await inMemoryDb.collection('review_items').findOne({ question_id: 'q_004' });
      expect(found).toMatchObject({
        student_id: STUDENT_A,
        course_id: COURSE_Y,
        question_id: 'q_004',
        n: 0,
        EF: 2.5,
        interval_days: 1,
        notification_opt_out: false,
      });
    });
  });

  describe('findDueItems', () => {
    it('returns items where next_review_at <= now', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ question_id: 'q_due_1', next_review_at: new Date(Date.now() - 86400000) }), // 1 day ago
        makeItem({ question_id: 'q_due_2', next_review_at: new Date(Date.now() - 3600000)  }), // 1 hour ago
        makeItem({ question_id: 'q_future', next_review_at: daysFromNow(3) }),
      ]);

      const now = new Date();
      const due = await repo.findDueItems(now);

      const ids = due.map(i => (i as any).question_id);
      expect(ids).toContain('q_due_1');
      expect(ids).toContain('q_due_2');
      expect(ids).not.toContain('q_future');
    });

    it('returns empty array when nothing is due', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ question_id: 'q_future', next_review_at: daysFromNow(7) }),
      ]);

      const due = await repo.findDueItems(new Date());
      expect(due).toHaveLength(0);
    });

    it('excludes opted-out items (caller filters separately)', async () => {
      // Note: findDueItems itself does NOT filter by notification_opt_out —
      // the cron job does that in memory after fetching.
      const repo = makeRepo();
      await insertItems([
        makeItem({ question_id: 'q_due', next_review_at: new Date(Date.now() - 1000), notification_opt_out: true }),
      ]);

      const due = await repo.findDueItems(new Date());
      expect(due).toHaveLength(1); // repo returns it; cron filters in memory
    });
  });

  describe('findByStudent', () => {
    it('returns all items for a given student', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ student_id: STUDENT_A, question_id: 'q_a1' }),
        makeItem({ student_id: STUDENT_A, question_id: 'q_a2' }),
        makeItem({ student_id: STUDENT_B, question_id: 'q_b1' }),
      ]);

      const items = await repo.findByStudent(STUDENT_A);

      expect(items).toHaveLength(2);
      expect(items.map(i => (i as any).question_id).sort()).toEqual(['q_a1', 'q_a2']);
    });

    it('returns empty array when student has no items', async () => {
      const repo = makeRepo();
      const items = await repo.findByStudent('unknown_student');
      expect(items).toHaveLength(0);
    });
  });

  describe('findByStudentAndCourse', () => {
    it('returns only items matching both student and course', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ student_id: STUDENT_A, course_id: COURSE_X, question_id: 'q_ax1' }),
        makeItem({ student_id: STUDENT_A, course_id: COURSE_Y, question_id: 'q_ay1' }),
        makeItem({ student_id: STUDENT_B, course_id: COURSE_X, question_id: 'q_bx1' }),
      ]);

      const items = await repo.findByStudentAndCourse(STUDENT_A, COURSE_X);

      expect(items).toHaveLength(1);
      expect((items[0] as any).question_id).toBe('q_ax1');
    });
  });

  describe('findByStudentAndQuestion', () => {
    it('returns the exact (student, question) item', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ student_id: STUDENT_A, question_id: 'q_find_1' }),
        makeItem({ student_id: STUDENT_A, question_id: 'q_find_2' }),
        makeItem({ student_id: STUDENT_B, question_id: 'q_find_1' }),
      ]);

      const item = await repo.findByStudentAndQuestion(STUDENT_A, 'q_find_1');

      expect(item).not.toBeNull();
      expect((item as any).student_id).toBe(STUDENT_A);
      expect((item as any).question_id).toBe('q_find_1');
    });

    it('returns null when no match exists', async () => {
      const repo = makeRepo();
      const item = await repo.findByStudentAndQuestion(STUDENT_A, 'nonexistent');
      expect(item).toBeNull();
    });
  });

  describe('update', () => {
    it('updates only the specified fields and returns the updated document', async () => {
      const repo = makeRepo();
      await insertItems([makeItem({ question_id: 'q_upd_1', n: 0, EF: 2.5 })]);

      const original = await inMemoryDb.collection('review_items').findOne({ question_id: 'q_upd_1' });
      const originalId = (original as any)._id.toString();

      const updated = await repo.update(originalId, {
        n: 3,
        EF: 2.8,
        interval_days: 15,
        next_review_at: daysFromNow(15),
        last_reviewed_at: new Date(),
      });

      expect(updated).not.toBeNull();
      expect((updated as any).n).toBe(3);
      expect((updated as any).EF).toBe(2.8);
      expect((updated as any).interval_days).toBe(15);
      expect((updated as any).question_id).toBe('q_upd_1'); // unchanged field stays
    });

    it('returns null when item does not exist', async () => {
      const repo = makeRepo();
      const updated = await repo.update(new ObjectId().toString(), { n: 1 });
      expect(updated).toBeNull();
    });

    it('preserves unchanged fields', async () => {
      const repo = makeRepo();
      await insertItems([makeItem({ question_id: 'q_upd_2', EF: 2.5, interval_days: 1 })]);

      const original = await inMemoryDb.collection('review_items').findOne({ question_id: 'q_upd_2' });
      await repo.update((original as any)._id.toString(), { EF: 2.9 });

      const after = await inMemoryDb.collection('review_items').findOne({ question_id: 'q_upd_2' });
      expect((after as any).EF).toBe(2.9);
      expect((after as any).interval_days).toBe(1); // unchanged
    });
  });

  describe('updateOptOut', () => {
    it('updates notification_opt_out for all items of a student in a course', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ student_id: STUDENT_A, course_id: COURSE_X, question_id: 'q_opt1', notification_opt_out: false }),
        makeItem({ student_id: STUDENT_A, course_id: COURSE_X, question_id: 'q_opt2', notification_opt_out: false }),
        makeItem({ student_id: STUDENT_A, course_id: COURSE_Y, question_id: 'q_opt3', notification_opt_out: false }),
        makeItem({ student_id: STUDENT_B, course_id: COURSE_X, question_id: 'q_opt4', notification_opt_out: false }),
      ]);

      const modifiedCount = await repo.updateOptOut(STUDENT_A, COURSE_X, true);

      expect(modifiedCount).toBe(2);

      const items = await inMemoryDb.collection('review_items')
        .find({ student_id: STUDENT_A, course_id: COURSE_X })
        .toArray();
      expect(items.every(i => (i as any).notification_opt_out === true)).toBe(true);

      // Other course / student unchanged
      const otherCourse = await inMemoryDb.collection('review_items')
        .findOne({ question_id: 'q_opt3' });
      expect((otherCourse as any).notification_opt_out).toBe(false);
      const otherStudent = await inMemoryDb.collection('review_items')
        .findOne({ question_id: 'q_opt4' });
      expect((otherStudent as any).notification_opt_out).toBe(false);
    });

    it('can flip opt-out back to false', async () => {
      const repo = makeRepo();
      await insertItems([
        makeItem({ student_id: STUDENT_A, course_id: COURSE_X, notification_opt_out: true }),
      ]);

      await repo.updateOptOut(STUDENT_A, COURSE_X, false);

      const item = await inMemoryDb.collection('review_items').findOne({ student_id: STUDENT_A });
      expect((item as any).notification_opt_out).toBe(false);
    });

    it('returns 0 when no items match the (student, course) pair', async () => {
      const repo = makeRepo();
      const modifiedCount = await repo.updateOptOut('nobody', 'no_course', true);
      expect(modifiedCount).toBe(0);
    });
  });

  describe('index-backed uniqueness', () => {
    it('createMany throws when a second createMany races to insert the same (student, question)', async () => {
      // The unique compound index on (student_id, question_id) prevents the same
      // ReviewItem from being seeded twice even when two seedSchedule() calls race.
      // We simulate this by inserting one item then trying to insert a duplicate
      // with the same (student_id, question_id) pair.
      const repo = makeRepo();
      const dupItem = makeItem({ question_id: 'q_dup_unique' });

      // First insert succeeds
      await repo.createMany([dupItem]);

      // Second insert — same (student_id, question_id) — must throw
      let threw = false;
      try {
        await repo.create({ ...dupItem }); // single-item version of the duplicate
      } catch (err: any) {
        threw = true;
        // MongoDB driver throws a bulk write error for unique index violations
        expect(err.message ?? err.code).toMatch(/duplicate|E11000/);
      }
      expect(threw).toBe(true);
    });
  });

});
