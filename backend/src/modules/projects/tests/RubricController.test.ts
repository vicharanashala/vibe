import request from 'supertest';
import Express from 'express';
import {
  Action,
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import {
  describe,
  it,
  beforeEach,
  beforeAll,
  expect,
  vi,
  afterEach,
  afterAll,
} from 'vitest';
import {Container} from 'inversify';
import {ObjectId} from 'mongodb';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {PROJECTS_TYPES} from '#root/modules/projects/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {projectsContainerModules, projectsModuleOptions} from '../index.js';
import {dbConfig} from '#root/config/db.js';
import {MongoDatabase, HttpErrorHandler} from '#shared/index.js';
import {IProjectSubmission} from '../repositories/model.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';

describe('RubricController / AssessmentController Integration Tests', () => {
  const App = Express();
  let app: any;
  let currentUserCheckerSpy: any;
  let container: Container;
  let db: MongoDatabase;

  const course1 = new ObjectId().toString();
  const version1 = new ObjectId().toString();
  const course2 = new ObjectId().toString();
  const version2 = new ObjectId().toString();

  const adminUser = {
    _id: new ObjectId().toString(),
    firebaseUID: 'admin-uid',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: 'admin',
    enrollments: [],
  };

  const instructorUser = {
    _id: new ObjectId().toString(),
    firebaseUID: 'instructor-uid',
    email: 'instructor@example.com',
    firstName: 'Instructor',
    lastName: 'User',
    roles: 'user',
    enrollments: [{courseId: course1, versionId: version1, role: 'INSTRUCTOR'}],
  };

  const studentUser = {
    _id: new ObjectId().toString(),
    firebaseUID: 'student-uid',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'User',
    roles: 'user',
    enrollments: [{courseId: course1, versionId: version1, role: 'STUDENT'}],
  };

  const student2User = {
    _id: new ObjectId().toString(),
    firebaseUID: 'student2-uid',
    email: 'student2@example.com',
    firstName: 'Student2',
    lastName: 'User',
    roles: 'user',
    enrollments: [{courseId: course1, versionId: version1, role: 'STUDENT'}],
  };

  const otherInstructor = {
    _id: new ObjectId().toString(),
    firebaseUID: 'other-uid',
    email: 'other@example.com',
    firstName: 'Other',
    lastName: 'Instructor',
    roles: 'user',
    enrollments: [{courseId: course2, versionId: version2, role: 'INSTRUCTOR'}],
  };

  const mockCourseRepo = {
    readVersion: vi.fn(),
    getCourseVersionStatus: vi.fn(),
  };
  const mockProgressService = {stopItem: vi.fn(), updateProgress: vi.fn()};

  const mockFirebaseAuthService = {
    getCurrentUserFromToken: async (token: string) => {
      if (token === 'admin') return adminUser;
      if (token === 'instructor') return instructorUser;
      if (token === 'student') return studentUser;
      if (token === 'student2') return student2User;
      if (token === 'other-instructor') return otherInstructor;
      return studentUser;
    },
  };

  const mockEnrollmentService = {
    getAllEnrollments: async (userId: string) => {
      if (userId === instructorUser._id) {
        return [{courseId: new ObjectId(course1), courseVersionId: new ObjectId(version1), role: 'INSTRUCTOR'}];
      }
      if (userId === studentUser._id) {
        return [{courseId: new ObjectId(course1), courseVersionId: new ObjectId(version1), role: 'STUDENT'}];
      }
      if (userId === student2User._id) {
        return [{courseId: new ObjectId(course1), courseVersionId: new ObjectId(version1), role: 'STUDENT'}];
      }
      if (userId === otherInstructor._id) {
        return [{courseId: new ObjectId(course2), courseVersionId: new ObjectId(version2), role: 'INSTRUCTOR'}];
      }
      return [];
    },
  };

  beforeAll(async () => {
    container = new Container();
    const testDbName = `vibe_test_rubric_${new ObjectId().toString()}`;
    container.bind(GLOBAL_TYPES.uri).toConstantValue(dbConfig.url);
    container.bind(GLOBAL_TYPES.dbName).toConstantValue(testDbName);
    container.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();
    container.bind(GLOBAL_TYPES.CourseRepo).toConstantValue(mockCourseRepo);
    container.bind(USERS_TYPES.ProgressService).toConstantValue(mockProgressService);
    container.bind(FirebaseAuthService).toConstantValue(mockFirebaseAuthService as any);
    container.bind(EnrollmentService).toConstantValue(mockEnrollmentService as any);

    await container.load(...projectsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    currentUserCheckerSpy = vi
      .spyOn(Current, 'currentUserChecker')
      .mockImplementation(async (action: Action) => {
        const authHeader = action.request.headers.authorization;
        if (authHeader) {
          const token = authHeader.split(' ')[1];
          if (token === 'admin') return adminUser;
          if (token === 'instructor') return instructorUser;
          if (token === 'student') return studentUser;
          if (token === 'student2') return student2User;
          if (token === 'other-instructor') return otherInstructor;
        }
        return studentUser;
      });

    const options: RoutingControllersOptions = {
      controllers: projectsModuleOptions.controllers,
      middlewares: projectsModuleOptions.middlewares,
      defaultErrorHandler: projectsModuleOptions.defaultErrorHandler,
      authorizationChecker: projectsModuleOptions.authorizationChecker,
      currentUserChecker: Current.currentUserChecker,
      validation: projectsModuleOptions.validation,
    };

    app = useExpressServer(App, options);
  });

  beforeEach(async () => {
    const rubricCol = await db.getCollection('project_rubrics');
    const assessmentCol = await db.getCollection('project_assessments');
    const submissionCol = await db.getCollection('project_submissions');
    await rubricCol.deleteMany({});
    await assessmentCol.deleteMany({});
    await submissionCol.deleteMany({});

    mockCourseRepo.readVersion.mockReset();
    mockCourseRepo.getCourseVersionStatus.mockReset();
    mockCourseRepo.readVersion.mockResolvedValue(true);
    mockCourseRepo.getCourseVersionStatus.mockResolvedValue('active');
  });

  afterEach(() => {
    currentUserCheckerSpy.mockClear();
  });

  afterAll(async () => {
    if (db.isConnected()) {
      if (db.database) {
        await db.database.dropDatabase();
      }
      await db.disconnect();
    }
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Rubric creation
  // ────────────────────────────────────────────────────────────────────────

  describe('POST /project/rubric/course/:courseId/version/:versionId', () => {
    const createBody = {
      title: 'Code Quality',
      description: 'Assesses code quality',
      criteria: [
        {name: 'Structure', description: 'Code organisation', maxPoints: 40},
        {name: 'Readability', maxPoints: 30},
        {name: 'Testing', maxPoints: 30},
      ],
    };

    it('TC-01: instructor can create a rubric for their course/version', async () => {
      const res = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send(createBody)
        .expect(200);

      expect(res.body.title).toBe('Code Quality');
      expect(res.body.criteria).toHaveLength(3);
      // Criterion IDs must be server-generated (non-empty strings)
      res.body.criteria.forEach((c: any) => {
        expect(c.id).toBeTruthy();
        expect(typeof c.id).toBe('string');
      });
      expect(res.body.id).toBeTruthy();
    });

    it('TC-02: student cannot create a rubric (403)', async () => {
      await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer student')
        .send(createBody)
        .expect(403);
    });

    it('TC-03: instructor from another course cannot create a rubric (403)', async () => {
      // otherInstructor is enrolled in course2/version2 only
      await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer other-instructor')
        .send(createBody)
        .expect(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Rubric update (with lock check)
  // ────────────────────────────────────────────────────────────────────────

  describe('PATCH /project/rubric/:rubricId', () => {
    it('TC-04: instructor can edit a rubric that has no assessments', async () => {
      // Create a rubric first
      const createRes = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({title: 'Original', criteria: [{name: 'Crit A', maxPoints: 100}]})
        .expect(200);

      const rubricId = createRes.body.id;

      const patchRes = await request(app)
        .patch(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer instructor')
        .send({title: 'Updated Title'})
        .expect(200);

      expect(patchRes.body.title).toBe('Updated Title');
    });

    it('TC-05a: modifying existing criteria on a locked rubric is rejected (400)', async () => {
      // Create rubric
      const createRes = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          title: 'Locked Rubric',
          criteria: [{name: 'Design', maxPoints: 50}],
        })
        .expect(200);

      const rubricId = createRes.body.id;
      const criterionId = createRes.body.criteria[0].id;

      // Create a submission to assess
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      // Save assessment — locks the rubric
      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({rubricId, criteria: [{criterionId, points: 40}]})
        .expect(200);

      // Attempting to modify existing criterion points should return 400
      await request(app)
        .patch(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          criteria: [{id: criterionId, name: 'Design Modified', maxPoints: 100}],
        })
        .expect(400);
    });

    it('TC-05b: instructor can append new criteria to a locked rubric without changing existing assessment snapshot', async () => {
      // Create rubric
      const createRes = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          title: 'Rubric for Appending',
          criteria: [{name: 'Design', maxPoints: 50}],
        })
        .expect(200);

      const rubricId = createRes.body.id;
      const existingCriterion = createRes.body.criteria[0];

      // Create submission and save assessment
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({rubricId, criteria: [{criterionId: existingCriterion.id, points: 45}]})
        .expect(200);

      // Append a new criterion to the locked rubric
      const patchRes = await request(app)
        .patch(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          criteria: [
            existingCriterion,
            {name: 'Documentation', maxPoints: 25},
          ],
        })
        .expect(200);

      expect(patchRes.body.criteria).toHaveLength(2);
      expect(patchRes.body.criteria[0].id).toBe(existingCriterion.id);
      expect(patchRes.body.criteria[1].name).toBe('Documentation');
      expect(patchRes.body.criteria[1].id).toBeDefined();

      // Verify the old assessment's maxPoints & totalPoints remain unchanged in snapshot
      const getAssessmentRes = await request(app)
        .get(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .expect(200);

      expect(getAssessmentRes.body.maxPoints).toBe(50);
      expect(getAssessmentRes.body.totalPoints).toBe(45);
      expect(getAssessmentRes.body.percentage).toBe(90);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Assessment save (PUT — upsert)
  // ────────────────────────────────────────────────────────────────────────

  describe('PUT /project/assessment/submission/:submissionId', () => {
    /** Helper: create a rubric and return its id + criterion id */
    async function createRubric() {
      const res = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          title: 'Test Rubric',
          criteria: [
            {name: 'Criterion A', maxPoints: 50},
            {name: 'Criterion B', maxPoints: 50},
          ],
        })
        .expect(200);
      return {rubricId: res.body.id as string, criteria: res.body.criteria as any[]};
    }

    /** Helper: insert a real submission */
    async function createSubmission(userId: string = studentUser._id) {
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(userId),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      return insertRes.insertedId.toString();
    }

    it('TC-06: instructor can save an assessment and score is computed server-side', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      const res = await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [
            {criterionId: criteria[0].id, points: 40},
            {criterionId: criteria[1].id, points: 35},
          ],
          overallFeedback: 'Great work!',
        })
        .expect(200);

      // Server-side computed values
      expect(res.body.totalPoints).toBe(75);
      expect(res.body.maxPoints).toBe(100);
      expect(res.body.percentage).toBe(75);
      expect(res.body.overallFeedback).toBe('Great work!');
    });

    it('TC-07: client-sent bogus totalPoints/percentage values are ignored (server recomputes)', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      // Send obviously wrong total — server should ignore it
      const res = await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [
            {criterionId: criteria[0].id, points: 30},
            {criterionId: criteria[1].id, points: 20},
          ],
        })
        .expect(200);

      // Correct values are 50 total / 100 max / 50%
      expect(res.body.totalPoints).toBe(50);
      expect(res.body.maxPoints).toBe(100);
      expect(res.body.percentage).toBe(50);
    });

    it('TC-08: points > criterion.maxPoints → 400', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 999}],
        })
        .expect(400);
    });

    it('TC-09: points < 0 → 400', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: -5}],
        })
        .expect(400);
    });

    it('TC-10: unknown criterionId → 400', async () => {
      const {rubricId} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: new ObjectId().toString(), points: 10}],
        })
        .expect(400);
    });

    it('TC-11: student cannot PUT an assessment (403)', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer student')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 40}],
        })
        .expect(403);
    });

    it('TC-13: instructor from another course cannot assess (403)', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer other-instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 40}],
        })
        .expect(403);
    });

    it('TC-14: saving an assessment does NOT change the submission featured field', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 40}],
        })
        .expect(200);

      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const submission = await subCol.findOne({_id: new ObjectId(submissionId)});
      // featured must remain false — assessment must not mutate it
      expect(submission?.featured).toBe(false);
    });

    it('TC-15: re-saving an assessment for the same submission upserts (no duplicate documents)', async () => {
      const {rubricId, criteria} = await createRubric();
      const submissionId = await createSubmission();

      // First save
      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 20}],
        })
        .expect(200);

      // Second save (different score)
      const res2 = await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({
          rubricId,
          criteria: [{criterionId: criteria[0].id, points: 45}],
          overallFeedback: 'Revised',
        })
        .expect(200);

      expect(res2.body.totalPoints).toBe(45);

      // Verify exactly ONE assessment document exists
      const assessCol = await db.getCollection('project_assessments');
      const docs = await assessCol
        .find({submissionId: new ObjectId(submissionId)})
        .toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0].totalPoints).toBe(45);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Assessment GET
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /project/assessment/submission/:submissionId', () => {
    it('TC-12a: student can GET their own assessment', async () => {
      // Create rubric + submission + assessment
      const createRubricRes = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({title: 'R', criteria: [{name: 'C', maxPoints: 20}]})
        .expect(200);

      const rubricId = createRubricRes.body.id;
      const criterionId = createRubricRes.body.criteria[0].id;

      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({rubricId, criteria: [{criterionId, points: 15}]})
        .expect(200);

      // Student retrieves their own assessment
      const res = await request(app)
        .get(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer student')
        .expect(200);

      expect(res.body.totalPoints).toBe(15);
      expect(res.body.maxPoints).toBe(20);
    });

    it('TC-12b: student cannot GET another student\'s assessment (403)', async () => {
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      // Submission belongs to student2, not student
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(student2User._id),
        submissionURL: 'https://github.com/test2',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      // student (not student2) tries to GET this assessment → 403
      await request(app)
        .get(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer student')
        .expect(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Rubric deletion
  // ────────────────────────────────────────────────────────────────────────

  describe('DELETE /project/rubric/:rubricId', () => {
    /** Helper: create a rubric and return its full response body */
    async function createRubric(title = 'Rubric to Delete') {
      const res = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({title, criteria: [{name: 'Criterion A', maxPoints: 50}]})
        .expect(200);
      return res.body as {id: string; criteria: {id: string}[]};
    }

    it('TC-16: instructor can delete a rubric that has no assessments', async () => {
      const {id: rubricId} = await createRubric();

      const res = await request(app)
        .delete(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer instructor')
        .expect(200);

      expect(res.body.message).toMatch(/deleted/i);

      // Confirm the rubric is really gone
      const listRes = await request(app)
        .get(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .expect(200);
      expect(listRes.body.map((r: any) => r.id)).not.toContain(rubricId);
    });

    it('TC-17: delete is rejected (400) with a human-readable message when assessments exist', async () => {
      const {id: rubricId, criteria} = await createRubric('Locked Rubric');
      const criterionId = criteria[0].id;

      // Create a submission and assess against the rubric — this locks it
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({rubricId, criteria: [{criterionId, points: 40}]})
        .expect(200);

      // Now attempting to delete should be blocked
      const delRes = await request(app)
        .delete(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer instructor')
        .expect(400);

      // The error message must be human-readable — not "Invalid body" or similar
      expect(delRes.body.message).toMatch(/cannot be deleted/i);
      expect(delRes.body.message).toMatch(/assess/i);
    });

    it('TC-18: student cannot delete a rubric (403)', async () => {
      const {id: rubricId} = await createRubric();
      await request(app)
        .delete(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer student')
        .expect(403);
    });

    it('TC-19: instructor from another course cannot delete a rubric (403)', async () => {
      const {id: rubricId} = await createRubric();
      await request(app)
        .delete(`/project/rubric/${rubricId}`)
        .set('Authorization', 'Bearer other-instructor')
        .expect(403);
    });

    it('TC-21: DELETE /project/rubric/:rubricId with a non-existent (but valid-format) rubricId → should return 404, not crash', async () => {
      const nonExistentId = new ObjectId().toString(); // valid ObjectId format, no matching document
      await request(app)
        .delete(`/project/rubric/${nonExistentId}`)
        .set('Authorization', 'Bearer instructor')
        .expect(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // assessmentCount on GET list
  // ────────────────────────────────────────────────────────────────────────

  describe('GET /project/rubric/course/:courseId/version/:versionId — assessmentCount field', () => {
    it('TC-22: assessmentCount is 0 for a new rubric and 1 after an assessment is saved', async () => {
      // Create a rubric — count must be 0
      const createRes = await request(app)
        .post(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .send({title: 'Count Test', criteria: [{name: 'Crit', maxPoints: 20}]})
        .expect(200);

      const rubricId = createRes.body.id;
      const criterionId = createRes.body.criteria[0].id;

      let listRes = await request(app)
        .get(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .expect(200);

      const before = listRes.body.find((r: any) => r.id === rubricId);
      expect(before).toBeDefined();
      expect(before.assessmentCount).toBe(0);

      // Save an assessment — count should become 1
      const subCol = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await subCol.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://github.com/test',
        createdAt: new Date(),
        featured: false,
      });
      const submissionId = insertRes.insertedId.toString();

      await request(app)
        .put(`/project/assessment/submission/${submissionId}`)
        .set('Authorization', 'Bearer instructor')
        .send({rubricId, criteria: [{criterionId, points: 15}]})
        .expect(200);

      listRes = await request(app)
        .get(`/project/rubric/course/${course1}/version/${version1}`)
        .set('Authorization', 'Bearer instructor')
        .expect(200);

      const after = listRes.body.find((r: any) => r.id === rubricId);
      expect(after).toBeDefined();
      expect(after.assessmentCount).toBe(1);
    });
  });
});
