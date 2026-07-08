/**
 * Service-level tests for PeerReviewAssessmentService.
 *
 * These bypass the controller layer and call the service directly. They
 * verify the most important business rules:
 *   - create() with valid body returns both ids
 *   - create() rejects when rubric total <= 0
 *   - create() rejects when submissionDeadline is in the past
 *   - create() rejects when reviewsPerSubmission != reviewsPerReviewer
 *   - edit() rejects when the assessment already has submissions
 *   - close() sets the closedAt field
 *
 * Uses the same in-memory Mongo setup as PeerReviewRepositories.test.ts
 * (refer to that file's comment header for the global test-infra caveat).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'routing-controllers';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { peerReviewContainerModule } from '../container.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentService } from '../services/PeerReviewAssessmentService.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import {
  CreatePeerReviewAssessmentBody,
  RubricCriterionDto,
} from '../classes/validators/PeerReviewValidators.js';
import { IUser } from '#shared/interfaces/models.js';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;

let service: PeerReviewAssessmentService;
let assessmentRepo: PeerReviewAssessmentRepository;
let submissionRepo: PeerReviewSubmissionRepository;
let database: MongoDatabase;

const teacher: IUser = {
  _id: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
  firebaseUID: 'teacher-firebase-uid',
  email: 'teacher@test.com',
  firstName: 'Test',
  lastName: 'Teacher',
  roles: 'admin',
} as any;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  const c = new Container();
  await c.load(peerReviewContainerModule);
  c.bind(GLOBAL_TYPES.uri).toConstantValue(uri);
  c.bind(GLOBAL_TYPES.dbName).toConstantValue('vibe_test_peerreview_svc');
  c.bind(MongoDatabase).toSelf().inSingletonScope();
  database = c.get(MongoDatabase);
  await database.connect();
  useContainer(new InversifyAdapter(c));

  service = c.get<PeerReviewAssessmentService>(
    PEERREVIEW_TYPES.PeerReviewAssessmentService,
  );
  assessmentRepo = c.get<PeerReviewAssessmentRepository>(
    PEERREVIEW_TYPES.PeerReviewAssessmentRepo,
  );
  submissionRepo = c.get<PeerReviewSubmissionRepository>(
    PEERREVIEW_TYPES.PeerReviewSubmissionRepo,
  );

  // Inject minimal stubs (cast as any) so we don't depend on the full
  // courses/users DI graph (which is broken in the test infra).
  (service as any).itemRepo = makeStubItemRepo();
  (service as any).courseRepo = makeStubCourseRepo();
}, 60_000);

afterEach(async () => {
  if (mongoClient) {
    const db = mongoClient.db('vibe_test_peerreview_svc');
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

// ---------------------------------------------------------------------------
// Helpers: stub repositories so we don't need the full courses/users DI graph
// ---------------------------------------------------------------------------

function makeStubItemRepo(): any {
  return {
    createItem: async (item: any) => ({ ...item, _id: new ObjectId() }),
    createItems: async (items: any[]) =>
      items.map(i => ({ ...i, _id: new ObjectId() })),
  };
}

function makeStubCourseRepo(): any {
  return {
    readVersion: async (versionId: string) =>
      ({
        _id: new ObjectId(),
        courseId: new ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'),
        modules: [
          {
            moduleId: new ObjectId('111111111111111111111111'),
            sections: [
              {
                sectionId: new ObjectId('222222222222222222222222'),
              },
            ],
          },
        ],
      }),
  };
}

function makeValidBody(overrides: Partial<CreatePeerReviewAssessmentBody> = {}): CreatePeerReviewAssessmentBody {
  const base: CreatePeerReviewAssessmentBody = {
    title: 'Test Assessment',
    description: 'A test',
    rubric: [
      { label: 'Code Quality', maxPoints: 30 } as RubricCriterionDto,
      { label: 'Functionality', maxPoints: 50 } as RubricCriterionDto,
      { label: 'Documentation', maxPoints: 20 } as RubricCriterionDto,
    ],
    submissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reviewWindowDays: 7,
    teacherManualReviewEnabled: true,
    notificationsEnabled: true,
    latePolicy: 'penalty-only',
    latePenaltyPercent: 10,
    antiCollusionMode: 'circular-shift-collision-check',
    reviewsPerSubmission: 3,
    reviewsPerReviewer: 3,
    cohortId: new ObjectId().toString(),
    itemName: 'Test Item',
    itemDescription: 'A test item',
    courseId: new ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb').toString(),
    courseVersionId: new ObjectId().toString(),
    moduleId: '111111111111111111111111',
    sectionId: '222222222222222222222222',
  };
  return { ...base, ...overrides };
}

describe('PeerReviewAssessmentService.create', () => {
  it('returns assessmentId + itemId for a valid body', async () => {
    const result = await service.create(teacher, makeValidBody());
    expect(result.assessmentId).toBeTruthy();
    expect(result.itemId).toBeTruthy();
    // Both ids should be valid hex strings (24 chars)
    expect(result.assessmentId).toHaveLength(24);
    expect(result.itemId).toHaveLength(24);
  });

  it('persists the rubric with the right totalMaxPoints', async () => {
    const result = await service.create(teacher, makeValidBody());
    const stored = await assessmentRepo.findById(result.assessmentId);
    expect(stored).toBeTruthy();
    expect(stored!.totalMaxPoints).toBe(100);
    expect(stored!.rubric.length).toBe(3);
  });

  it('rejects when rubric total <= 0', async () => {
    const body = makeValidBody({
      rubric: [
        { label: 'A', maxPoints: 0 } as RubricCriterionDto,
      ],
    });
    await expect(service.create(teacher, body)).rejects.toThrow(
      /Rubric total points must be > 0/,
    );
  });

  it('rejects when reviewsPerSubmission != reviewsPerReviewer', async () => {
    const body = makeValidBody({
      reviewsPerSubmission: 3,
      reviewsPerReviewer: 2,
    });
    await expect(service.create(teacher, body)).rejects.toThrow(
      /reviewsPerSubmission must equal reviewsPerReviewer/,
    );
  });

  it('rejects when submissionDeadline is in the past', async () => {
    const body = makeValidBody({
      submissionDeadline: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(service.create(teacher, body)).rejects.toThrow(
      /submissionDeadline must be in the future/,
    );
  });
});

describe('PeerReviewAssessmentService.edit', () => {
  it('updates the title when before the deadline', async () => {
    const created = await service.create(teacher, makeValidBody());
    await service.edit(teacher, created.assessmentId, { title: 'Updated' });
    const reloaded = await assessmentRepo.findById(created.assessmentId);
    expect(reloaded!.title).toBe('Updated');
  });

  it('rejects edits after a submission exists', async () => {
    const created = await service.create(teacher, makeValidBody());
    // simulate a student submission for this assessment
    await submissionRepo.upsertForStudent(created.assessmentId, 'student-1', {
      notes: 'n',
      links: [
        {
          url: 'https://drive.google.com/file/d/abc/view',
          label: 'Report',
          kind: 'drive',
          lastAccessible: true,
        },
      ],
      submittedAt: new Date(),
      isLate: false,
      attachmentsAccessibilityChecked: true,
    });
    await expect(
      service.edit(teacher, created.assessmentId, { title: 'too-late' }),
    ).rejects.toThrow(/after a student has submitted/);
  });

  it('rejects edits after the submissionDeadline has passed', async () => {
    const created = await service.create(teacher, makeValidBody());
    // overwrite submissionDeadline to a past date directly in the repo
    await assessmentRepo.update(created.assessmentId, {
      submissionDeadline: new Date(Date.now() - 60_000),
    });
    await expect(
      service.edit(teacher, created.assessmentId, { title: 'too-late' }),
    ).rejects.toThrow(/submission deadline has passed/);
  });
});

describe('PeerReviewAssessmentService.close', () => {
  it('sets closedAt on a successful close', async () => {
    const created = await service.create(teacher, makeValidBody());
    await service.close(teacher, created.assessmentId);
    const reloaded = await assessmentRepo.findById(created.assessmentId);
    expect(reloaded!.closedAt).toBeTruthy();
  });

  it('refuses to close an already-closed assessment', async () => {
    const created = await service.create(teacher, makeValidBody());
    await service.close(teacher, created.assessmentId);
    await expect(
      service.close(teacher, created.assessmentId),
    ).rejects.toThrow(/already closed/);
  });
});
