import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import { Action, useContainer, useExpressServer } from 'routing-controllers';
import { faker } from '@faker-js/faker';
import { describe, it, beforeEach, beforeAll, expect, vi, afterAll } from 'vitest';
import { AnomalyController } from '../controllers/AnomalyController.js';
import { HttpErrorHandler, ItemType } from '#shared/index.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container, ContainerModule } from 'inversify';
import { AuthController } from '#root/modules/auth/controllers/AuthController.js';
import { CreateItemBody } from '#root/modules/courses/classes/index.js';
import { CourseController } from '#root/modules/courses/controllers/CourseController.js';
import { CourseVersionController } from '#root/modules/courses/controllers/CourseVersionController.js';
import { ItemController } from '#root/modules/courses/controllers/ItemController.js';
import { ModuleController } from '#root/modules/courses/controllers/ModuleController.js';
import { SectionController } from '#root/modules/courses/controllers/SectionController.js';
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#root/modules/auth/container.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { settingContainerModule } from '#root/modules/setting/container.js';
import { anomaliesContainerModule } from '../container.js';
import { NewAnomalyData } from '../classes/validators/AnomalyValidators.js';
import { AnomalyType } from '../classes/transformers/Anomaly.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { CloudStorageService } from '#root/modules/anomalies/services/CloudStorageService.js';

const ContainerModules: ContainerModule[] = [
  anomaliesContainerModule,
  coursesContainerModule,
  sharedContainerModule,
  authContainerModule,
  notificationsContainerModule,
  usersContainerModule,
  quizzesContainerModule,
  courseRegistrationContainerModule,
  settingContainerModule,
  projectsContainerModule,
  hpSystemContainerModule,
  reportsContainerModule,
  ejectionPolicyContainerModule,
  emotionsContainerModule,
  genAIContainerModule,
  studentQuestionsContainerModule,
  announcementsContainerModule,
  auditTrailsContainerModule
]

// A minimal valid 1x1 PNG image buffer for upload tests
const validImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',);

// Local helpers with auth headers
async function localCreateCourse(app: any): Promise<any> {
  const body = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    versionName: 'v1.0.0',
    versionDescription: 'Initial test version',
  };
  const response = await request(app)
    .post('/courses')
    .set('Authorization', 'Bearer admin')
    .send(body)
    .expect(201);
  return response.body;
}


async function localCreateModule(app: any, versionId: string): Promise<any> {
  const body = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
  };
  const response = await request(app)
    .post(`/courses/versions/${versionId}/modules`)
    .set('Authorization', 'Bearer admin')
    .send(body)
    .expect(201);
  return response.body;
}

async function localCreateSection(app: any, versionId: string, moduleId: string): Promise<any> {
  const body = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
  };
  const response = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
    .set('Authorization', 'Bearer admin')
    .send(body)
    .expect(201);
  return response.body;
}

describe('Anomaly Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let anomalyData: NewAnomalyData;

  // Mock admin user for auth
  const adminUser = {
    _id: faker.database.mongodbObjectId(),
    firebaseUID: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    roles: 'admin',
  };

  // Mock student user for auth
  const studentUser = {
    _id: faker.database.mongodbObjectId(),
    firebaseUID: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    roles: 'user',
  };

  let currentUserCheckerSpy;
  let db: MongoDatabase;
  let mongoServer: MongoMemoryReplSet;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    // 1. Start an in-memory MongoDB replica set (supports transactions)
    mongoServer = await MongoMemoryReplSet.create();
    const mongoUri = mongoServer.getUri();

    // 2. Load all DI container modules (this binds GLOBAL_TYPES.uri to null
    //    because dbConfig.url was read at import-time before DB_URL was set)
    const container = new Container();
    await container.load(...ContainerModules);

    // 3. Rebind uri/dbName, then rebind Database so a fresh MongoDatabase is
    //    constructed with the correct URI. We MUST also rebind the Database
    //    binding because the old MongoDatabase singleton was already created
    //    with the null URI during container.load().
    container.unbind(GLOBAL_TYPES.uri);
    container.bind(GLOBAL_TYPES.uri).toConstantValue(mongoUri);

    container.unbind(GLOBAL_TYPES.dbName);
    container.bind(GLOBAL_TYPES.dbName).toConstantValue('vibe-test');

    container.unbind(GLOBAL_TYPES.Database);
    container.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    // 4. Connect to the in-memory database
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    
    // Override the private client with a non-TLS MongoClient for in-memory server
    const { MongoClient } = await import('mongodb');
    db['client'] = new MongoClient(mongoUri, {
      ssl: false,
      tls: false,
      retryWrites: true,
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 60000,
      connectTimeoutMS: 20000,
      socketTimeoutMS: 30000,
    });

    await db.connect();

    // Mock currentUserChecker — maps Bearer tokens to mock users
    currentUserCheckerSpy = vi.spyOn(Current, 'currentUserChecker').mockImplementation(
      async (action: Action) => {
        if (action.request.headers.authorization) {
          const token = action.request.headers.authorization.split(' ')[1];
          if (token === 'admin') {
            return adminUser;
          } else if (token === 'student') {
            return studentUser;
          }
        }
        return adminUser;
      }
    );

    // Mock FirebaseAuthService.getCurrentUserFromToken — the @Ability decorator
    // calls this directly via getFromContainer, bypassing currentUserChecker.
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string) => {
      if (token === 'admin') {
        return adminUser as any;
      } else if (token === 'student') {
        return studentUser as any;
      }
      return adminUser as any;
    });

    // Mock EnrollmentService.getAllEnrollments — the @Ability decorator fetches
    // enrollments to build CASL abilities. Return empty array so the admin user
    // falls through to globalRole-based abilities.
    vi.spyOn(
      EnrollmentService.prototype,
      'getAllEnrollments',
    ).mockResolvedValue([]);

    // Mock CloudStorageService.prototype.uploadAnomaly to prevent hitting GCS
    vi.spyOn(
      CloudStorageService.prototype,
      'uploadAnomaly',
    ).mockImplementation(async (file, userId, anomalyType, timestamp, type) => {
      const ext = type.split('/')[1];
      return `${userId}/${anomalyType}/${timestamp.toISOString()}.${ext}`;
    });

    app = useExpressServer(appInstance, {
      controllers: [AnomalyController, AuthController, CourseController, CourseVersionController, ModuleController, SectionController, ItemController],
      validation: true,
      defaultErrorHandler: false,
      middlewares: [HttpErrorHandler],
      authorizationChecker: () => true, // Mock authorization for testing
      currentUserChecker: Current.currentUserChecker, // Use the spied function
    });

    console.log('Creating course...');
    // --- Set up test data using local authenticated helpers ---
    const course = await localCreateCourse(app);
    const versionId = course.versions[0].toString();

    console.log('Creating module...');
    const module = await localCreateModule(app, versionId);
    console.log('Module created:', module.version.modules[0].moduleId);

    console.log('Creating section...');
    const section = await localCreateSection(
      app,
      versionId,
      module.version.modules[0].moduleId.toString(),
    );
    console.log('Section created:', section.version.modules[0].sections[0].sectionId);

    const itemPayload: CreateItemBody = {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      type: ItemType.QUIZ,
      quizDetails: {
        questionVisibility: 3,
        allowPartialGrading: true,
        allowSkip: true,
        deadline: faker.date.future(),
        allowHint: true,
        maxAttempts: 5,
        releaseTime: faker.date.future(),
        quizType: 'DEADLINE',
        showCorrectAnswersAfterSubmission: true,
        showExplanationAfterSubmission: true,
        showScoreAfterSubmission: true,
        approximateTimeToComplete: '00:30:00',
        passThreshold: 0.7,
      },
    };

    console.log('Creating quiz item...');
    const itemResponse = await request(app)
      .post(
        `/courses/versions/${versionId}/modules/${module.version.modules[0].moduleId}/sections/${section.version.modules[0].sections[0].sectionId}/items`,
      )
      .set('Authorization', 'Bearer admin')
      .send(itemPayload);
    expect(itemResponse.status).toBe(201);
    expect(itemResponse.body.itemsGroup.items.length).toBe(1);
    console.log('Quiz item created:', itemResponse.body.itemsGroup.items[0]._id);

    // Arrange anomaly data for the tests
    anomalyData = {
      courseId: course._id.toString(),
      versionId: versionId,
      itemId: itemResponse.body.itemsGroup.items[0]._id.toString(),
      type: AnomalyType.VOICE_DETECTION,
    };
    console.log('beforeAll finished successfully');
  }, 60000);

  beforeEach(() => {
    // Clear call counts but preserve the mock implementations
    currentUserCheckerSpy.mockClear();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    // Install a temporary rejection handler so the async MongoClientClosedError
    // that the driver emits while draining the connection pool (after the in-memory
    // mongod is stopped) does not surface as an unhandled rejection in Vitest.
    const suppressMongoClose = (err: Error) => {
      // Suppress all errors that are expected during replica-set shutdown:
      //   - MongoClientClosedError  — pool drain after client.close()
      //   - MongoWriteConcernError  — ShutdownInProgress (code 91)
      //   - MongoServerError        — InterruptedAtShutdown (code 11600)
      const name = err?.constructor?.name ?? '';
      const isMongoShutdownErr =
        name === 'MongoClientClosedError' ||
        name === 'MongoWriteConcernError' ||
        (name === 'MongoServerError' && (err as any).code === 11600);
      if (isMongoShutdownErr) return;
      throw err;
    };
    process.on('unhandledRejection', suppressMongoClose);
    try {
      // Stop the server first — this kills the underlying mongod process.
      if (mongoServer) await mongoServer.stop();
      // Then tell the client to close; it will race the pool drain and may throw.
      if (db) { try { await db.disconnect(); } catch { /* expected */ } }
    } finally {
      process.off('unhandledRejection', suppressMongoClose);
    }
  });

  describe('ANOMALY RECORDING', () => {
    describe('Success Scenario', () => {
      it('should record an anomaly with a valid image and data', async () => {
        // Act — note the correct route is /anomalies/record/image (not /anomalies/record)
        const response = await request(app)
          .post('/anomalies/record/image')
          .set('Authorization', 'Bearer admin')
          .field('courseId', anomalyData.courseId.toString())
          .field('versionId', anomalyData.versionId.toString())
          .field('itemId', anomalyData.itemId.toString())
          .field('type', anomalyData.type)
          .attach('image', validImageBuffer, 'test-image.jpg')
          .expect(201);

        // Assert
        expect(response.body._id).toBeDefined();
        expect(response.body.userId).toBe(adminUser._id.toString());
        expect(response.body.courseId).toBe(anomalyData.courseId);
        expect(response.body.versionId).toBe(anomalyData.versionId);
        expect(response.body.itemId).toBe(anomalyData.itemId);
        expect(response.body.type).toBe(anomalyData.type);
      }, 60000);
    });

    describe('Error Scenarios', () => {
      it('should return 400 when required body fields are missing', async () => {
        // Send an image but omit all required body fields — class-validator should
        // reject the request with 400 Bad Request.
        const response = await request(app)
          .post('/anomalies/record/image')
          .set('Authorization', 'Bearer admin')
          .attach('image', validImageBuffer, 'test-image.jpg')
          .expect(400);

        // Assert — routing-controllers wraps validation errors as "Invalid body"
        expect(response.body.message).toMatch(/invalid body/i);
      });

      it('should return 400 when an invalid anomaly type is supplied', async () => {
        const response = await request(app)
          .post('/anomalies/record/image')
          .set('Authorization', 'Bearer admin')
          .field('courseId', anomalyData.courseId.toString())
          .field('versionId', anomalyData.versionId.toString())
          .field('itemId', anomalyData.itemId.toString())
          .field('type', 'NOT_A_VALID_TYPE')
          .attach('image', validImageBuffer, 'test-image.jpg')
          .expect(400);

        expect(response.body.message).toMatch(/invalid body/i);
      });
    });
  });
});
