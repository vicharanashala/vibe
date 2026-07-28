import request from 'supertest';
import {
  useExpressServer,
  useContainer as useRoutingControllersContainer,
  Action,
  RoutingControllersOptions,
} from 'routing-controllers';
import {Container} from 'inversify';
import Express from 'express';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import {faker} from '@faker-js/faker';
import {
  certificatesContainerModules,
  certificatesModuleOptions,
} from '../index.js';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer as useClassValidatorContainer, Validator} from 'class-validator';
import {CertificateService} from '../services/CertificateService.js';
import {CERTIFICATE_TYPES} from '../types.js';
import {sharedContainerModule} from '#root/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import type {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';

describe('Certificate Controller Integration Test', () => {
  const App = Express();
  let app;
  let currentUserCheckerSpy;
  let container: Container;

  const user1 = {
    userId: faker.database.mongodbObjectId(),
    globalRole: 'user',
    enrollments: [],
  };

  beforeAll(async () => {
    container = new Container();
    // sharedContainerModule provides GLOBAL_TYPES.Database (MongoDatabase) and
    // other cross-module bindings that CertificateRepository depends on —
    // without it, container.load only knows about this module's own
    // bindings and fails to resolve Database.
    await container.load(...certificatesContainerModules, sharedContainerModule);
    // class-validator needs its own Validator class explicitly bound once
    // you hand it a container via useContainer — otherwise it tries to
    // resolve a binding for "Validator" that nothing registers by default.
    container.bind(Validator).toSelf().inSingletonScope();
    const inversifyAdapter = new InversifyAdapter(container);
    // Two separate useContainer calls, from two separate packages — this is
    // the exact gap that caused certificateService to come through as
    // undefined inside the controller. class-validator's useContainer only
    // wires up custom validator constraint resolution; routing-controllers
    // has its own useContainer that's what actually makes it pull
    // controller instances (with their constructor dependencies) from our
    // Inversify container instead of just calling `new Controller()`.
    useClassValidatorContainer(inversifyAdapter);
    useRoutingControllersContainer(inversifyAdapter);

    // Binding GLOBAL_TYPES.Database only constructs a MongoDatabase
    // instance — it doesn't connect it. The real app's index.ts explicitly
    // calls database.connect() once at startup before serving any
    // requests; our isolated test container needs the same explicit call,
    // or every repository call fails with "Database is not connected".
    const database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await database.connect();

    currentUserCheckerSpy = vi
      .spyOn(Current, 'currentUserChecker')
      .mockImplementation(async (action: Action) => {
        if (action.request.headers.authorization) {
          return user1;
        }
        return null;
      });

    const options: RoutingControllersOptions = {
      controllers: certificatesModuleOptions.controllers,
      middlewares: certificatesModuleOptions.middlewares,
      defaultErrorHandler: certificatesModuleOptions.defaultErrorHandler,
      authorizationChecker: () => true,
      currentUserChecker: Current.currentUserChecker,
      validation: certificatesModuleOptions.validation,
    };

    app = useExpressServer(App, options);
  });

  afterEach(() => {
    currentUserCheckerSpy.mockClear();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await database.disconnect();
  });

  describe('GET /certificates/mine', () => {
    it('returns an empty list before any certificate is issued', async () => {
      const response = await request(app)
        .get('/certificates/mine')
        .set('Authorization', 'Bearer user1');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    }, 30000);
  });

  describe('GET /certificates/:certificateId', () => {
    it('returns 404 for an unknown certificate id', async () => {
      const response = await request(app).get(
        `/certificates/${faker.string.uuid()}`,
      );

      expect(response.status).toBe(404);
    }, 30000);

    it('verifies a certificate once one has been issued', async () => {
      // Issue directly through the service rather than via an HTTP route —
      // there's no public "issue" endpoint by design (issuance only ever
      // happens server-side, from the ProgressService completion hook).
      const certificateService = container.get<CertificateService>(
        CERTIFICATE_TYPES.CertificateService,
      );

      const issued = await certificateService.issueIfNotExists({
        userId: user1.userId,
        courseId: faker.database.mongodbObjectId(),
        courseVersionId: faker.database.mongodbObjectId(),
        studentName: 'Test Student',
        courseName: 'Test Course',
      });

      const response = await request(app).get(
        `/certificates/${issued.certificateId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.certificateId).toBe(issued.certificateId);
      expect(response.body.studentName).toBe('Test Student');
      expect(response.body.courseName).toBe('Test Course');
      // The response DTO must never leak the internal Mongo id or userId.
      expect(response.body._id).toBeUndefined();
      expect(response.body.userId).toBeUndefined();
    }, 30000);

    it('is idempotent — issuing twice for the same enrollment returns the same certificate', async () => {
      const certificateService = container.get<CertificateService>(
        CERTIFICATE_TYPES.CertificateService,
      );

      const courseId = faker.database.mongodbObjectId();
      const courseVersionId = faker.database.mongodbObjectId();

      const first = await certificateService.issueIfNotExists({
        userId: user1.userId,
        courseId,
        courseVersionId,
        studentName: 'Test Student',
        courseName: 'Test Course',
      });

      const second = await certificateService.issueIfNotExists({
        userId: user1.userId,
        courseId,
        courseVersionId,
        studentName: 'Test Student',
        courseName: 'Test Course',
      });

      expect(second.certificateId).toBe(first.certificateId);
    }, 30000);
  });
});
