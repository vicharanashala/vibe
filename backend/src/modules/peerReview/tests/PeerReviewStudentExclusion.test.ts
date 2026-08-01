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
  c.bind(GLOBAL_TYPES.dbName).toConstantValue('vibe_exclusion_test');
  c.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();
  c.bind(MongoDatabase).toDynamicValue(() => c.get(GLOBAL_TYPES.Database));
  c.bind(GLOBAL_TYPES.UserRepo).to(UserRepository).inSingletonScope();

  c.unbind(PEERREVIEW_TYPES.PeerReviewNotificationService);
  c.bind(PEERREVIEW_TYPES.PeerReviewNotificationService).toConstantValue({
    notifySubmissionsClosed: async () => 'ok',
    notifyAssignmentsOut: async () => 'ok',
    notifyTeacherOverride: async () => 'ok',
  } as any);

  c.bind(GLOBAL_TYPES.CourseRepo).toConstantValue({
    findEnrollment: async () => ({ role: 'INSTRUCTOR' }),
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
}, 30000);

afterEach(async () => {
  if (mongoClient) {
    const db = mongoClient.db('vibe_exclusion_test');
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

describe('Peer Review Student Exclusion Tests', () => {
  it('disqualifies student from reviewing peers while preserving their submission evaluation', async () => {
    // 1. Seed Teacher, Student A (colluding reviewer), Student B, Student C
    const teacherId = new ObjectId().toString();
    const studentAId = new ObjectId().toString();
    const studentBId = new ObjectId().toString();
    const studentCId = new ObjectId().toString();

    const teacher: IUser = {
      _id: new ObjectId(teacherId),
      email: 'teacher@vibe.com',
      firstName: 'Prof',
      lastName: 'Oak',
      roles: 'INSTRUCTOR',
    } as any;

    await userRepo.create(teacher);

    // 2. Create Assessment
    const assessmentId = new ObjectId().toString();
    await assessmentRepo.create({
      _id: new ObjectId(assessmentId),
      title: 'Project Peer Review',
      rubric: [{ criterionId: 'c1', label: 'Functionality', maxPoints: 50 }],
      config: { reviewsPerSubmission: 2, reviewsPerReviewer: 2 },
    } as any);

    // 3. Create Submissions for A, B, C
    const subAId = await submissionRepo.upsertForStudent(assessmentId, studentAId, { notes: 'Sub A' } as any);
    const subBId = await submissionRepo.upsertForStudent(assessmentId, studentBId, { notes: 'Sub B' } as any);
    const subCId = await submissionRepo.upsertForStudent(assessmentId, studentCId, { notes: 'Sub C' } as any);

    // 4. Create assignments:
    // A reviews B (colluding high score)
    // C reviews B (valid score)
    // B reviews A (valid score for A's submission)
    const asnABId = new ObjectId().toString();
    const asnCBId = new ObjectId().toString();
    const asnBAId = new ObjectId().toString();

    await assignmentRepo.create({
      _id: new ObjectId(asnABId),
      assessmentId: new ObjectId(assessmentId),
      submissionId: new ObjectId(subBId),
      reviewerId: new ObjectId(studentAId),
      status: 'SUBMITTED',
    } as any);

    await assignmentRepo.create({
      _id: new ObjectId(asnCBId),
      assessmentId: new ObjectId(assessmentId),
      submissionId: new ObjectId(subBId),
      reviewerId: new ObjectId(studentCId),
      status: 'SUBMITTED',
    } as any);

    await assignmentRepo.create({
      _id: new ObjectId(asnBAId),
      assessmentId: new ObjectId(assessmentId),
      submissionId: new ObjectId(subAId),
      reviewerId: new ObjectId(studentBId),
      status: 'SUBMITTED',
    } as any);

    // 5. Create reviews
    await reviewRepo.create({
      assessmentId: new ObjectId(assessmentId),
      assignmentId: new ObjectId(asnABId),
      submissionId: new ObjectId(subBId),
      reviewerId: new ObjectId(studentAId),
      scores: [{ criterionId: 'c1', score: 50, comment: 'Fake perfect' }],
      totalScore: 50,
    } as any);

    await reviewRepo.create({
      assessmentId: new ObjectId(assessmentId),
      assignmentId: new ObjectId(asnCBId),
      submissionId: new ObjectId(subBId),
      reviewerId: new ObjectId(studentCId),
      scores: [{ criterionId: 'c1', score: 35, comment: 'Solid work' }],
      totalScore: 35,
    } as any);

    await reviewRepo.create({
      assessmentId: new ObjectId(assessmentId),
      assignmentId: new ObjectId(asnBAId),
      submissionId: new ObjectId(subAId),
      reviewerId: new ObjectId(studentBId),
      scores: [{ criterionId: 'c1', score: 40, comment: 'Good project' }],
      totalScore: 40,
    } as any);

    // 6. Teacher disqualifies Student A as a reviewer due to collusion
    const excludeResult = await teacherController.excludeStudentFromPeerReview(
      {},
      teacher,
      subAId,
      { reason: 'Collusion detected: Student A gave artificial perfect scores to friend.' },
    );

    expect(excludeResult.ok).toBe(true);

    // 7. Verify Student A is marked disqualified as a reviewer
    const updatedSubA = await submissionRepo.findById(subAId);
    expect(updatedSubA!.reviewerExcluded || updatedSubA!.excludedFromPeerReview).toBe(true);
    expect(updatedSubA!.teacherExcludeReason).toContain('Collusion detected');
    // Verify Student A's OWN submission STILL receives its score (40 pts) from peer B!
    expect(updatedSubA!.finalScore).toBe(40);

    // 8. Verify Student A's review given to B is marked EXCLUDED
    const updatedAsnAB = await assignmentRepo.findById(asnABId);
    expect(updatedAsnAB!.status).toBe('EXCLUDED');

    // 9. Verify target student B's score was recomputed without Student A's corrupt review
    const updatedSubB = await submissionRepo.findById(subBId);
    expect(updatedSubB!.finalScore).toBe(35); // B's score updated to 35 from valid reviewer C
  });
});
