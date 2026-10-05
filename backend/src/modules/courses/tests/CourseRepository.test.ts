import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { CourseRepository } from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';

// ── In-memory DB setup ───────────────────────────────────────────────────────
//
// `CourseRepository` is constructed with 8 injected collaborators
// (db, progressRepo, enrollmentRepo, anomalyRepo, settingsRepo,
// courseRegistrationRepo, projectSubmissionRepo, questionBankRepo,
// reportRepo, inviteRepo). For these tests we only exercise
// `isMentorOnCourse` — which only touches the courses collection —
// so we pass `undefined` for the repos and a stubbed MongoDatabase
// for `db`. The other repo slots are never called by the helper
// under test.

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let inMemoryDb: ReturnType<MongoClient['db']>;

// Minimal stub delegating to the in-memory collection. We only
// pass the `db` slot the helper actually uses; the rest stay
// `undefined` because `isMentorOnCourse` never reads them.
function makeMockMongoDb(): MongoDatabase {
  return {
    getCollection: (name: string) => inMemoryDb.collection(name),
  } as unknown as MongoDatabase;
}

function makeRepo(): CourseRepository {
  // Cast to `any` to skip the 9-repo constructor signature — only
  // the `db` slot is touched by `isMentorOnCourse` under test. The
  // other slots stay undefined; calling them would crash, but the
  // tests don't reach them.
  return new CourseRepository(makeMockMongoDb() as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  inMemoryDb = client.db('test_course_repo');
}, 120_000);

afterAll(async () => {
  // CourseRepository.init() fires createIndex calls without awaiting
  // them, so close() races with in-flight index ops. Swallow the
  // resulting `MongoClientClosedError` rejections — tests already
  // finished by this point and the noise is cosmetic.
  process.on('unhandledRejection', () => undefined);
  await client?.close();
  await mongoServer?.stop();
});

beforeEach(async () => {
  // Match the production collection name ('newCourse') so CourseRepository.init()
  // resolves the same collection that we seed here.
  await inMemoryDb.collection('newCourse').deleteMany({});
});

// ── Test fixtures ───────────────────────────────────────────────────────────

const INSTRUCTOR_ID = new ObjectId();
const MENTOR_ID = new ObjectId();
const RANDOM_USER_ID = new ObjectId();
const COURSE_ID = new ObjectId();

async function insertCourse(opts: {
  instructors?: ObjectId[];
  mentorIds?: ObjectId[] | 'missing';
}): Promise<void> {
  // Use raw insertOne so we control the field shape exactly
  // (CourseRepository's `create()` goes through the Course class
  // which applies default-init logic we don't want for these tests).
  const doc: Record<string, unknown> = {
    _id: COURSE_ID,
    name: 'Test Course',
    description: 'Course used for mentor gate tests',
    versions: [],
    instructors: opts.instructors ?? [],
  };
  if (opts.mentorIds !== 'missing') {
    doc.mentorIds = opts.mentorIds ?? [];
  }
  await inMemoryDb.collection('newCourse').insertOne(doc);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CourseRepository.isMentorOnCourse', () => {
  it('returns true when the user is in instructors', async () => {
    await insertCourse({instructors: [INSTRUCTOR_ID]});
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(),
      INSTRUCTOR_ID.toString(),
    );
    expect(allowed).toBe(true);
  });

  it('returns true when the user is in mentorIds (not instructors)', async () => {
    await insertCourse({mentorIds: [MENTOR_ID]});
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(),
      MENTOR_ID.toString(),
    );
    expect(allowed).toBe(true);
  });

  it('returns false when the user is in neither list', async () => {
    await insertCourse({
      instructors: [INSTRUCTOR_ID],
      mentorIds: [MENTOR_ID],
    });
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(),
      RANDOM_USER_ID.toString(),
    );
    expect(allowed).toBe(false);
  });

  it('treats missing mentorIds field as empty (legacy courses)', async () => {
    // Course created before the mentorIds field shipped — field absent.
    // An instructor is still allowed; a non-instructor is rejected.
    await insertCourse({
      instructors: [INSTRUCTOR_ID],
      mentorIds: 'missing',
    });
    const repo = makeRepo();
    expect(
      await repo.isMentorOnCourse(
        COURSE_ID.toString(),
        INSTRUCTOR_ID.toString(),
      ),
    ).toBe(true);
    expect(
      await repo.isMentorOnCourse(
        COURSE_ID.toString(),
        RANDOM_USER_ID.toString(),
      ),
    ).toBe(false);
  });

  it('returns false when the course does not exist', async () => {
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(),
      RANDOM_USER_ID.toString(),
    );
    expect(allowed).toBe(false);
  });

  it('returns true when the user is in BOTH lists (OR semantics)', async () => {
    // Same user appears as both instructor and mentor. Helper should
    // return true on first match and not double-count.
    await insertCourse({
      instructors: [INSTRUCTOR_ID],
      mentorIds: [INSTRUCTOR_ID],
    });
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(),
      INSTRUCTOR_ID.toString(),
    );
    expect(allowed).toBe(true);
  });

  it('handles string IDs as userId without crashing', async () => {
    // Course.instructors stores ObjectIds; userId is a string. The
    // helper's `String(id) === String(userId)` coercion must work.
    await insertCourse({instructors: [INSTRUCTOR_ID]});
    const repo = makeRepo();
    const allowed = await repo.isMentorOnCourse(
      COURSE_ID.toString(), // explicit string
      INSTRUCTOR_ID.toString(),
    );
    expect(allowed).toBe(true);
  });
});
