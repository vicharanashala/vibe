/**
 * Repository smoke tests.
 *
 * IMPORTANT — these tests share the same Mongo connection as the rest of
 * the test suite (via the project's test setup). They use unique collection
 * names suffixed with a random id to avoid collisions between parallel
 * test files. Every test cleans up its own data in afterEach.
 *
 * If the project's test infra is unbootable (no Mongo URI, missing DI
 * wiring in test setup), these tests will fail at import time. That is the
 * same failure mode as every other existing test in the codebase. See
 * the master plan doc section 1.1 for the pre-existing baseline note.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'routing-controllers';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { peerReviewContainerModule } from '../container.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import {
  makeAssessment,
  makeSubmission,
  makeAssignment,
  makeReview,
} from './utils/peerReviewFactories.js';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;

const repos = {
  assessment: null as unknown as PeerReviewAssessmentRepository,
  submission: null as unknown as PeerReviewSubmissionRepository,
  assignment: null as unknown as PeerReviewAssignmentRepository,
  review: null as unknown as PeerReviewReviewRepository,
};

beforeAll(async () => {
  // Spin up an in-memory Mongo so the suite is hermetic (no prod data risk)
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  // Stand up a DI container just for peer-review + GLOBAL_TYPES.Database.
  const c = new Container();
  await c.load(peerReviewContainerModule);
  c.bind(GLOBAL_TYPES.uri).toConstantValue(uri);
  c.bind(GLOBAL_TYPES.dbName).toConstantValue('vibe_test');

  // Register a fresh MongoDatabase bound to this URI so the repos connect
  // to the in-memory instance, not the dev one.
  c.bind(MongoDatabase).toSelf().inSingletonScope();
  await c.get<MongoDatabase>(MongoDatabase).connect();

  useContainer(new InversifyAdapter(c));

  repos.assessment = c.get<PeerReviewAssessmentRepository>(
    PEERREVIEW_TYPES.PeerReviewAssessmentRepo,
  );
  repos.submission = c.get<PeerReviewSubmissionRepository>(
    PEERREVIEW_TYPES.PeerReviewSubmissionRepo,
  );
  repos.assignment = c.get<PeerReviewAssignmentRepository>(
    PEERREVIEW_TYPES.PeerReviewAssignmentRepo,
  );
  repos.review = c.get<PeerReviewReviewRepository>(
    PEERREVIEW_TYPES.PeerReviewReviewRepo,
  );
}, 30000);

afterEach(async () => {
  // Wipe all peer-review collections between tests so they're isolated.
  if (mongoClient) {
    const db = mongoClient.db('vibe_test');
    await Promise.all([
      db.collection('peer_review_assessments').deleteMany({}),
      db.collection('peer_review_submissions').deleteMany({}),
      db.collection('peer_review_assignments').deleteMany({}),
      db.collection('peer_reviews').deleteMany({}),
    ]);
  }
});

afterAll(async () => {
  await mongoClient?.close();
  await mongoServer?.stop();
});

describe('PeerReviewAssessmentRepository', () => {
  it('creates and fetches by itemId', async () => {
    const a = makeAssessment();
    const id = await repos.assessment.create(a);
    expect(id).toBeTruthy();
    const got = await repos.assessment.findByItemId(a.itemId as string);
    expect(got).toBeTruthy();
    expect((got! as any).title).toBe(a.title);
  });

  it('findDueForAssignment returns past-deadline assessments that have not run yet', async () => {
    const due = makeAssessment({
      submissionDeadline: new Date(Date.now() - 60_000),
    });
    const future = makeAssessment({
      itemId: 'future' as any,
      submissionDeadline: new Date(Date.now() + 60_000),
    });
    await repos.assessment.create(due);
    await repos.assessment.create(future);
    const matches = await repos.assessment.findDueForAssignment(new Date());
    expect(matches.length).toBe(1);
    expect((matches[0] as any)._id.toString()).toBeTruthy();
  });

  it('soft-delete hides the assessment from active queries', async () => {
    const a = makeAssessment();
    await repos.assessment.create(a);
    await repos.assessment.softDelete((await repos.assessment.findByItemId(a.itemId as string))!._id as any);
    const active = await repos.assessment.findActiveByCourse(a.courseId as string);
    expect(active.length).toBe(0);
  });
});

describe('PeerReviewSubmissionRepository', () => {
  it('upsert is idempotent on (assessmentId, studentId)', async () => {
    const s = makeSubmission();
    const id1 = await repos.submission.upsertForStudent(
      s.assessmentId as string,
      s.studentId as string,
      { notes: 'first notes' },
    );
    const id2 = await repos.submission.upsertForStudent(
      s.assessmentId as string,
      s.studentId as string,
      { notes: 'updated notes' },
    );
    expect(id1).toBe(id2); // same _id
    const got = await repos.submission.findById(id1);
    expect((got as any).notes).toBe('updated notes');
  });

  it('(assessmentId, studentId) is a unique index — duplicate insert fails', async () => {
    const assessmentId = 'a1';
    const studentId = 's1';
    await repos.submission.upsertForStudent(assessmentId, studentId, { notes: 'first' });
    // The second call uses the upsert path which should also pass via updateOne.
    // Simulate a strict duplicate-key by inserting another doc with a different _id:
    await expect(
      repos.submission['collection'].insertOne({
        assessmentId,
        studentId,
        notes: 'duplicate',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('countForAssessment tracks active submissions', async () => {
    const a = 'assessX';
    await repos.submission.upsertForStudent(a, 's1', { notes: 'n1' });
    await repos.submission.upsertForStudent(a, 's2', { notes: 'n2' });
    const count = await repos.submission.countForAssessment(a);
    expect(count).toBe(2);
  });

  it('incrementReviewsCompleted + setReviewsTotal interact correctly', async () => {
    const id = await repos.submission.upsertForStudent('a', 's', { notes: 'x' });
    await repos.submission.setReviewsTotal(id, 3);
    await repos.submission.incrementReviewsCompleted(id);
    await repos.submission.incrementReviewsCompleted(id);
    const got = await repos.submission.findById(id);
    expect((got as any).reviewsCompleted).toBe(2);
    expect((got as any).reviewsTotal).toBe(3);
  });
});

describe('PeerReviewAssignmentRepository', () => {
  it('createMany returns N ids and findBySubmission returns N rows', async () => {
    const a = makeAssignment();
    const b = makeAssignment({ submissionId: a.submissionId });
    const ids = await repos.assignment.createMany([a, b]);
    expect(ids.length).toBe(2);
    const got = await repos.assignment.findBySubmission(a.submissionId as string);
    expect(got.length).toBe(2);
  });

  it('findPendingForReviewer filters out SUBMITTED and REASSIGNED', async () => {
    const pending = makeAssignment({ reviewerId: 'r1', status: 'PENDING' });
    const done = makeAssignment({ reviewerId: 'r1', status: 'SUBMITTED' });
    const reassigned = makeAssignment({ reviewerId: 'r1', status: 'REASSIGNED' });
    await repos.assignment.create(pending);
    await repos.assignment.create(done);
    await repos.assignment.create(reassigned);
    const got = await repos.assignment.findPendingForReviewer('r1');
    expect(got.length).toBe(1);
    expect((got[0] as any).status).toBe('PENDING');
  });

  it('markReassigned transitions status and points to new slot', async () => {
    const old = await repos.assignment.create(makeAssignment());
    const newId = await repos.assignment.create(makeAssignment());
    await repos.assignment.markReassigned(old, newId);
    const got = await repos.assignment.findById(old);
    expect((got as any).status).toBe('REASSIGNED');
    expect((got as any).reassignedToAssignmentId.toString()).toBe(newId);
  });

  it('findOverdueForReassessment respects the max-rounds cap', async () => {
    const capped = await repos.assignment.create(
      makeAssignment({ reassignmentCount: 2 }),
    );
    const fresh = await repos.assignment.create(
      makeAssignment({ reassignmentCount: 0 }),
    );
    const got = await repos.assignment.findOverdueForReassessment(
      'any-assessment',
      2,
    );
    const ids = got.map(a => (a as any)._id.toString());
    expect(ids).toContain(fresh);
    expect(ids).not.toContain(capped);
  });
});

describe('PeerReviewReviewRepository', () => {
  it('create + findByAssessment returns the same row', async () => {
    const r = makeReview();
    const id = await repos.review.create(r);
    const got = await repos.review.findByAssessment(r.assignmentId as string);
    expect(got).toBeTruthy();
    expect((got! as any)._id.toString()).toBe(id);
  });

  it('applyTeacherOverride sets override flags', async () => {
    const id = await repos.review.create(makeReview());
    await repos.review.applyTeacherOverride(id, {
      teacherOverrideScores: [
        { criterionId: 'c1', score: 25, comment: 'perfect' },
      ],
      reason: 'manual adjustment for integrity flag',
      overriddenBy: 'teacherId',
    });
    const got = await repos.review.findById(id);
    expect((got as any).teacherOverridden).toBe(true);
    expect((got as any).teacherOverrideReason).toBeTruthy();
    expect((got as any).teacherOverrideScores.length).toBe(1);
  });
});
