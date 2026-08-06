import request from 'supertest';
import Express from 'express';
import { Action, RoutingControllersOptions, useContainer, useExpressServer } from 'routing-controllers';
import { describe, it, beforeEach, beforeAll, expect, vi, afterEach, afterAll } from 'vitest';
import { Container } from 'inversify';
import { ObjectId } from 'mongodb';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { PROJECTS_TYPES } from '#root/modules/projects/types.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { projectsContainerModules, projectsModuleOptions } from '../index.js';
import { dbConfig } from '#root/config/db.js';
import { MongoDatabase, HttpErrorHandler } from '#shared/index.js';
import { IProjectSubmission } from '../repositories/model.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';

describe('ProjectController Integration Tests', () => {
  const App = Express();
  let app: any;
  let currentUserCheckerSpy: any;
  let container: Container;
  let db: MongoDatabase;

  // Generate valid 24-character ObjectId hex strings
  const course1 = new ObjectId().toString();
  const version1 = new ObjectId().toString();
  const course2 = new ObjectId().toString();
  const version2 = new ObjectId().toString();

  // Mock Users using the valid ObjectIds
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
    enrollments: [
      {
        courseId: course1,
        versionId: version1,
        role: 'INSTRUCTOR',
      },
    ],
  };

  const studentUser = {
    _id: new ObjectId().toString(),
    firebaseUID: 'student-uid',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'User',
    roles: 'user',
    enrollments: [
      {
        courseId: course1,
        versionId: version1,
        role: 'STUDENT',
      },
    ],
  };

  const otherInstructor = {
    _id: new ObjectId().toString(),
    firebaseUID: 'other-uid',
    email: 'other@example.com',
    firstName: 'Other',
    lastName: 'Instructor',
    roles: 'user',
    enrollments: [
      {
        courseId: course2,
        versionId: version2,
        role: 'INSTRUCTOR',
      },
    ],
  };

  // Mock Repositories/Services
  const mockCourseRepo = {
    readVersion: vi.fn(),
    getCourseVersionStatus: vi.fn(),
  };

  const mockProgressService = {
    stopItem: vi.fn(),
    updateProgress: vi.fn(),
  };

  // Mock services for @Ability parameter decorator
  const mockFirebaseAuthService = {
    getCurrentUserFromToken: async (token: string) => {
      if (token === 'admin') return adminUser;
      if (token === 'instructor') return instructorUser;
      if (token === 'student') return studentUser;
      if (token === 'other-instructor') return otherInstructor;
      return studentUser;
    },
  };

  const mockEnrollmentService = {
    getAllEnrollments: async (userId: string) => {
      if (userId === adminUser._id) return [];
      if (userId === instructorUser._id) {
        return [
          {
            courseId: new ObjectId(course1),
            courseVersionId: new ObjectId(version1),
            role: 'INSTRUCTOR',
          },
        ];
      }
      if (userId === studentUser._id) {
        return [
          {
            courseId: new ObjectId(course1),
            courseVersionId: new ObjectId(version1),
            role: 'STUDENT',
          },
        ];
      }
      if (userId === otherInstructor._id) {
        return [
          {
            courseId: new ObjectId(course2),
            courseVersionId: new ObjectId(version2),
            role: 'INSTRUCTOR',
          },
        ];
      }
      return [];
    },
  };

  beforeAll(async () => {
    container = new Container();

    // Bind database config & connection with unique database name for test isolation
    const testDbName = `vibe_test_project_${new ObjectId().toString()}`;
    container.bind(GLOBAL_TYPES.uri).toConstantValue(dbConfig.url);
    container.bind(GLOBAL_TYPES.dbName).toConstantValue(testDbName);
    container.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();

    // Bind HttpErrorHandler required by routing-controllers middleware
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    // Bind mocks
    container.bind(GLOBAL_TYPES.CourseRepo).toConstantValue(mockCourseRepo);
    container.bind(USERS_TYPES.ProgressService).toConstantValue(mockProgressService);
    container.bind(FirebaseAuthService).toConstantValue(mockFirebaseAuthService as any);
    container.bind(EnrollmentService).toConstantValue(mockEnrollmentService as any);

    // Load projects container module
    await container.load(...projectsContainerModules);

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    // Resolve db for setup/teardown
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    // Spy on currentUserChecker
    currentUserCheckerSpy = vi.spyOn(Current, 'currentUserChecker').mockImplementation(
      async (action: Action) => {
        const authHeader = action.request.headers.authorization;
        if (authHeader) {
          const token = authHeader.split(' ')[1];
          if (token === 'admin') return adminUser;
          if (token === 'instructor') return instructorUser;
          if (token === 'student') return studentUser;
          if (token === 'other-instructor') return otherInstructor;
        }
        return studentUser;
      }
    );

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
    // Clear project submissions collection before each test
    const col = await db.getCollection('project_submissions');
    await col.deleteMany({});

    // Reset mocks
    mockCourseRepo.readVersion.mockReset();
    mockCourseRepo.getCourseVersionStatus.mockReset();
    mockCourseRepo.readVersion.mockResolvedValue(true);
    mockCourseRepo.getCourseVersionStatus.mockResolvedValue('active');
  });

  afterEach(() => {
    currentUserCheckerSpy.mockClear();
  });

  afterAll(async () => {
    // Clean up database and disconnect
    if (db.isConnected()) {
      if (db.database) {
        await db.database.dropDatabase();
      }
      await db.disconnect();
    }
    vi.restoreAllMocks();
  });

  describe('POST /project/ (submitProject)', () => {
    it('creates a new submission defaulting to featured: false', async () => {
      const payload = {
        projectId: new ObjectId().toString(),
        courseId: course1,
        versionId: version1,
        moduleId: new ObjectId().toString(),
        sectionId: new ObjectId().toString(),
        submissionURL: 'https://github.com/vibe/test',
        comment: 'My test project',
      };

      const res = await request(app)
        .post('/project')
        .set('Authorization', 'Bearer student')
        .send(payload)
        .expect(200);

      expect(res.body.message).toBe('Project submitted successfully');

      // Verify in DB
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const doc = await col.findOne({ projectId: new ObjectId(payload.projectId) });
      expect(doc).toBeDefined();
      expect(doc?.featured).toBe(false);
    });
  });

  describe('PATCH /project/submission/:submissionId/featured', () => {
    it('allows curation by course instructor', async () => {
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/work',
        comment: 'Great work',
        createdAt: new Date(),
        featured: false,
      });

      const submissionId = insertRes.insertedId.toString();

      const res = await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(200);

      expect(res.body.message).toBe('Submission featured successfully.');

      const updated = await col.findOne({ _id: new ObjectId(submissionId) });
      expect(updated?.featured).toBe(true);
    });

    it('is idempotent when sending the same featured value twice', async () => {
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/work',
        comment: 'Great work',
        createdAt: new Date(),
        featured: false,
      });

      const submissionId = insertRes.insertedId.toString();

      // First PATCH
      const res1 = await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(200);

      expect(res1.body.message).toBe('Submission featured successfully.');

      // Second PATCH
      const res2 = await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(200);

      expect(res2.body.message).toBe('Submission featured successfully.');

      // Verify no duplicates and state remains true
      const docs = await col.find({ _id: new ObjectId(submissionId) }).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0].featured).toBe(true);
    });

    it('denies curation for students (403)', async () => {
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/work',
        createdAt: new Date(),
        featured: false,
      });

      const submissionId = insertRes.insertedId.toString();

      await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer student')
        .send({ featured: true })
        .expect(403);
    });

    it('denies curation for instructors from other courses (403)', async () => {
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/work',
        createdAt: new Date(),
        featured: false,
      });

      const submissionId = insertRes.insertedId.toString();

      // otherInstructor is only INSTRUCTOR for course2 / version2
      await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer other-instructor')
        .send({ featured: true })
        .expect(403);
    });

    it('denies request with invalid parameters or bad request body', async () => {
      const col = await db.getCollection<IProjectSubmission>('project_submissions');
      const insertRes = await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/work',
        createdAt: new Date(),
        featured: false,
      });

      const submissionId = insertRes.insertedId.toString();

      // invalid featured field type (string instead of boolean)
      await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: 'yes' })
        .expect(400);

      // missing featured field
      await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({})
        .expect(400);
    });

    it('returns 404 for non-existent submission', async () => {
      const fakeId = new ObjectId().toString();

      await request(app)
        .patch(`/project/submission/${fakeId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(404);
    });

    it('returns 404 for invalid ObjectId format', async () => {
      await request(app)
        .patch('/project/submission/invalid-id/featured')
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(404);
    });
  });

  describe('GET /project/:projectId/course/:courseId/version/:versionId/gallery', () => {
    it('returns only featured submissions and sanitizes private fields', async () => {
      const projectId = new ObjectId();
      const col = await db.getCollection<IProjectSubmission>('project_submissions');

      // 1. Featured submission
      const f1 = await col.insertOne({
        projectId,
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/featured-1',
        comment: 'Nice design',
        createdAt: new Date(),
        featured: true,
      });

      // 2. Unfeatured submission
      await col.insertOne({
        projectId,
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/unfeatured',
        comment: 'Work in progress',
        createdAt: new Date(),
        featured: false,
      });

      // 3. Featured from different project (isolation)
      await col.insertOne({
        projectId: new ObjectId(),
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/different-project',
        createdAt: new Date(),
        featured: true,
      });

      const res = await request(app)
        .get(`/project/${projectId.toString()}/course/${course1}/version/${version1}/gallery`)
        .set('Authorization', 'Bearer student')
        .expect(200);

      // Verify length & content
      expect(res.body).toHaveLength(1);
      expect(res.body[0].submissionURL).toBe('https://vibe.com/featured-1');
      expect(res.body[0].comment).toBe('Nice design');
      expect(res.body[0].submissionId).toBe(f1.insertedId.toString());
      expect(res.body[0].projectId).toBe(projectId.toString());

      // Ensure NO private fields (email, userId, name, grades, feedback, internal state, etc.)
      const keys = Object.keys(res.body[0]);
      expect(keys.sort()).toEqual(['submissionId', 'projectId', 'submissionURL', 'comment'].sort());
    });

    it('isolates gallery by cohort when cohortId query param is supplied', async () => {
      const projectId = new ObjectId();
      const cohortA = new ObjectId();
      const cohortB = new ObjectId();
      const col = await db.getCollection<IProjectSubmission>('project_submissions');

      // Submission in cohort A
      await col.insertOne({
        projectId,
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        cohortId: cohortA,
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/cohort-a',
        createdAt: new Date(),
        featured: true,
      });

      // Submission in cohort B
      await col.insertOne({
        projectId,
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        cohortId: cohortB,
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/cohort-b',
        createdAt: new Date(),
        featured: true,
      });

      // Query for Cohort A only
      const res = await request(app)
        .get(`/project/${projectId.toString()}/course/${course1}/version/${version1}/gallery?cohortId=${cohortA.toString()}`)
        .set('Authorization', 'Bearer student')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].submissionURL).toBe('https://vibe.com/cohort-a');
    });

    it('returns empty array when there are no featured submissions', async () => {
      const projectId = new ObjectId();
      const res = await request(app)
        .get(`/project/${projectId.toString()}/course/${course1}/version/${version1}/gallery`)
        .set('Authorization', 'Bearer student')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('denies student from unauthorized course/version (403)', async () => {
      const projectId = new ObjectId();
      const otherCourseId = new ObjectId().toString();
      const otherVersionId = new ObjectId().toString();
      // studentUser has enrollments only for course1 / version1
      await request(app)
        .get(`/project/${projectId.toString()}/course/${otherCourseId}/version/${otherVersionId}/gallery`)
        .set('Authorization', 'Bearer student')
        .expect(403);
    });
  });

  describe('Legacy Submissions Compatibility', () => {
    it('behaves as featured: false if the featured field is missing', async () => {
      const projectId = new ObjectId();
      const col = await db.getCollection<any>('project_submissions');

      // Legacy insert without "featured" field
      const insertRes = await col.insertOne({
        projectId,
        courseId: new ObjectId(course1),
        courseVersionId: new ObjectId(version1),
        userId: new ObjectId(studentUser._id),
        submissionURL: 'https://vibe.com/legacy',
        createdAt: new Date(),
      });

      const submissionId = insertRes.insertedId.toString();

      // 1. Should NOT show in student gallery
      const galleryRes = await request(app)
        .get(`/project/${projectId.toString()}/course/${course1}/version/${version1}/gallery`)
        .set('Authorization', 'Bearer student')
        .expect(200);
      expect(galleryRes.body).toHaveLength(0);

      // 2. Can be featured successfully (updates featured to true)
      await request(app)
        .patch(`/project/submission/${submissionId}/featured`)
        .set('Authorization', 'Bearer instructor')
        .send({ featured: true })
        .expect(200);

      const updated = await col.findOne({ _id: new ObjectId(submissionId) });
      expect(updated?.featured).toBe(true);
    });
  });
});
