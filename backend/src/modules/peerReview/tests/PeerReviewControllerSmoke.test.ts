import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'routing-controllers';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { peerReviewContainerModule } from '../container.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewTeacherController } from '../controllers/PeerReviewTeacherController.js';
import { PeerReviewAssignmentController } from '../controllers/PeerReviewAssignmentController.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from '../repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';
import { USERS_TYPES } from '#users/types.js';
import { IUser } from '#shared/interfaces/models.js';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;

let teacherController: PeerReviewTeacherController;
let assignmentController: PeerReviewAssignmentController;

let assessmentRepo: PeerReviewAssessmentRepository;
let submissionRepo: PeerReviewSubmissionRepository;
let assignmentRepo: PeerReviewAssignmentRepository;
let reviewRepo: PeerReviewReviewRepository;
let userRepo: UserRepository;
let database: MongoDatabase;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  const c = new Container();
  await c.load(peerReviewContainerModule);
  c.bind(GLOBAL_TYPES.uri).toConstantValue(uri);
  c.bind(GLOBAL_TYPES.dbName).toConstantValue('vibe_smoke_test');
  c.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();
  c.bind(MongoDatabase).toDynamicValue(() => c.get(GLOBAL_TYPES.Database));
  c.bind(GLOBAL_TYPES.UserRepo).to(UserRepository).inSingletonScope();

  // Register stub email notifier
  c.unbind(PEERREVIEW_TYPES.PeerReviewNotificationService);
  c.bind(PEERREVIEW_TYPES.PeerReviewNotificationService).toConstantValue({
    notifySubmissionsClosed: async () => 'ok',
    notifyAssignmentsOut: async () => 'ok',
    notifyTeacherOverride: async () => 'ok',
  } as any);

  // Stub CourseRepo and ItemRepo dependencies
  c.bind(GLOBAL_TYPES.CourseRepo).toConstantValue({
    findEnrollment: async () => ({ role: 'STUDENT' }),
  } as any);
  c.bind(USERS_TYPES.ItemRepo).toConstantValue({
    findById: async () => ({ name: 'Test Peer Assessment', type: 'PEER_REVIEW_ASSESSMENT' }),
  } as any);

  database = c.get<MongoDatabase>(GLOBAL_TYPES.Database);
  await database.connect();

  useContainer(new InversifyAdapter(c));

  assessmentRepo = c.get<PeerReviewAssessmentRepository>(PEERREVIEW_TYPES.PeerReviewAssessmentRepo);
  submissionRepo = c.get<PeerReviewSubmissionRepository>(PEERREVIEW_TYPES.PeerReviewSubmissionRepo);
  assignmentRepo = c.get<PeerReviewAssignmentRepository>(PEERREVIEW_TYPES.PeerReviewAssignmentRepo);
  reviewRepo = c.get<PeerReviewReviewRepository>(PEERREVIEW_TYPES.PeerReviewReviewRepo);
  userRepo = c.get<UserRepository>(GLOBAL_TYPES.UserRepo);

  teacherController = new PeerReviewTeacherController(
    assessmentRepo,
    submissionRepo,
    reviewRepo,
    assignmentRepo,
    c.get(PEERREVIEW_TYPES.PeerReviewScoringService),
    c.get(PEERREVIEW_TYPES.PeerReviewNotificationService),
    userRepo,
  );

  assignmentController = new PeerReviewAssignmentController(
    assignmentRepo,
    submissionRepo,
    assessmentRepo,
    reviewRepo,
  );
}, 30000);

afterEach(async () => {
  if (mongoClient) {
    const db = mongoClient.db('vibe_smoke_test');
    await Promise.all([
      db.collection('peer_review_assessments').deleteMany({}),
      db.collection('peer_review_submissions').deleteMany({}),
      db.collection('peer_review_assignments').deleteMany({}),
      db.collection('peer_reviews').deleteMany({}),
      db.collection('users').deleteMany({}),
    ]);
  }
});

afterAll(async () => {
  if (database) {
    await database.disconnect();
  }
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Peer Review Controller Smoke Tests', () => {
  it('verifies student review history double-blind safety and teacher dashboard lists', async () => {
    // 1. Seed two users (student submitter, reviewer) in Database
    const submitterId = new ObjectId().toString();
    const reviewerId = new ObjectId().toString();

    const submitter: IUser = {
      _id: new ObjectId(submitterId),
      email: 'submitter@vibe.com',
      firstName: 'Sub',
      lastName: 'Mitter',
      firebaseUID: 'uid-sub',
      roles: 'user',
    } as any;

    const reviewer: IUser = {
      _id: new ObjectId(reviewerId),
      email: 'reviewer@vibe.com',
      firstName: 'Rev',
      lastName: 'Iewer',
      firebaseUID: 'uid-rev',
      roles: 'user',
    } as any;

    await userRepo.create(submitter);
    await userRepo.create(reviewer);

    // 2. Create Assessment
    const assessmentId = new ObjectId().toString();
    const itemId = new ObjectId().toString();
    await assessmentRepo.create({
      _id: new ObjectId(assessmentId),
      itemId: new ObjectId(itemId),
      title: 'Peer Review 1',
      description: 'Review your peers code.',
      courseId: new ObjectId(),
      courseVersionId: new ObjectId(),
      moduleId: new ObjectId(),
      sectionId: new ObjectId(),
      rubric: [
        { criterionId: 'quality', label: 'Code Quality', maxPoints: 20 },
      ],
      submissionDeadline: new Date(Date.now() - 3600000), // in the past
      reviewDeadline: new Date(Date.now() + 3600000), // in the future
      config: {
        reviewsPerSubmission: 1,
        reviewsPerReviewer: 1,
        reviewWindowDays: 7,
        teacherManualReviewEnabled: true,
        notificationsEnabled: false,
        latePolicy: 'penalty-only',
        latePenaltyPercent: 10,
        antiCollusionMode: 'circular-shift-collision-check',
      },
    } as any);

    // 3. Create Submitter's Submission
    const submissionId = await submissionRepo.upsertForStudent(assessmentId, submitterId, {
      notes: 'My work is complete.',
      links: [{ url: 'https://github.com/test/repo', label: 'Repo link', kind: 'drive' }],
      submittedAt: new Date(),
      isLate: false,
      finalScore: null,
    } as any);

    await submissionRepo.setReviewsTotal(submissionId, 1);

    // 4. Create Reviewer's Review Assignment
    const assignmentId = new ObjectId().toString();
    const reviewId = new ObjectId().toString();
    await assignmentRepo.create({
      _id: new ObjectId(assignmentId),
      assessmentId: new ObjectId(assessmentId),
      submissionId: new ObjectId(submissionId),
      studentId: new ObjectId(submitterId),
      reviewerId: new ObjectId(reviewerId),
      status: 'SUBMITTED',
      submittedReviewId: new ObjectId(reviewId),
      dueAt: new Date(Date.now() + 3600000),
    } as any);

    // 5. Create Reviewer's submitted review score
    await reviewRepo.create({
      _id: new ObjectId(reviewId),
      assessmentId: new ObjectId(assessmentId),
      assignmentId: new ObjectId(assignmentId),
      submissionId: new ObjectId(submissionId),
      reviewerId: new ObjectId(reviewerId),
      scores: [
        { criterionId: 'quality', score: 15, comment: 'Nice structure' },
      ],
      overallComment: 'Pretty good code quality.',
      totalScore: 15,
      submittedAt: new Date(),
      isLate: false,
      teacherOverridden: false,
    } as any);

    // 6. Test GET /students/me/peer-reviews-given (Student POV review history)
    const reviewsGiven = await assignmentController.listReviewsGiven(reviewer);
    expect(reviewsGiven).toHaveLength(1);
    expect(reviewsGiven[0].assessmentTitle).toBe('Peer Review 1');
    expect(reviewsGiven[0].totalScore).toBe(15);
    expect(reviewsGiven[0].overallComment).toBe('Pretty good code quality.');
    // Assert Double-Blind compliance: Submitter's email or name is absent!
    expect(JSON.stringify(reviewsGiven)).not.toContain('submitter@vibe.com');
    expect(JSON.stringify(reviewsGiven)).not.toContain('Sub');

    // 7. Test GET /teachers/peer-review-assessments/:id/submissions (Teacher POV submissions roster)
    const submissionsRes = await teacherController.listSubmissionsForTeacher(reviewer, assessmentId);
    expect(submissionsRes.submissions).toHaveLength(1);
    const subItem = submissionsRes.submissions[0];
    expect(subItem.studentName).toBe('Sub Mitter'); // Successfully resolved!
    expect(subItem.studentEmail).toBe('submitter@vibe.com');

    // 8. Test GET /teachers/peer-review-assessments/:id/reviews (Teacher POV reviews details)
    const reviewsRes = await teacherController.listReviewsForTeacher(reviewer, assessmentId);
    expect(reviewsRes.reviews).toHaveLength(1);
    const revItem = reviewsRes.reviews[0];
    expect(revItem.reviewerName).toBe('Rev Iewer'); // Successfully resolved!
    expect(revItem.reviewerEmail).toBe('reviewer@vibe.com');

    // 9. Test Teacher Override Mutation: POST /teachers/peer-reviews/:id/override
    const overrideBody = {
      scores: [{ criterionId: 'quality', score: 18 }],
      overallComment: 'Instructor override to 18.',
      reason: 'Overridden because reviewer did not see helper functions which are correct.',
    };
    await teacherController.teacherOverride({}, reviewer, reviewId, overrideBody);

    // 10. Verify that score re-computed and saved in both the Review and the Submitter's Submission
    const updatedReview = await reviewRepo.findById(reviewId);
    expect(updatedReview!.teacherOverridden).toBe(true);
    expect(updatedReview!.teacherOverrideReason).toBe(overrideBody.reason);
    expect(updatedReview!.teacherOverrideScores).toEqual([
      { criterionId: 'quality', score: 18, comment: '' },
    ]);

    const updatedSub = await submissionRepo.findById(submissionId);
    // Since only 1 review, computeFinalScore with override will output 18 pts.
    expect(updatedSub!.finalScore).toBe(18);
  });
});
