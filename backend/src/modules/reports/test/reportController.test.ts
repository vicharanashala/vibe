import request from 'supertest';
import {
  useExpressServer,
  useContainer,
  Action,
  RoutingControllersOptions,
} from 'routing-controllers';
import {Container} from 'inversify';
import Express from 'express';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import {faker} from '@faker-js/faker';
import {reportsContainerModules, reportsModuleOptions} from '../index.js';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {ReportBody} from '../classes/index.js';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';

describe('Report Controller Integration Test', () => {
  const App = Express();
  let app;
  let currentUserCheckerSpy;
  const user1 = {
    _id: faker.database.mongodbObjectId(),
    firebaseUID: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    roles: 'admin',
  };
  const user2 = {
    _id: faker.database.mongodbObjectId(),
    firebaseUID: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    roles: 'user',
  };

  beforeAll(async () => {
    const container = new Container();
    await container.load(
      ...reportsContainerModules,
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      notificationsContainerModule,
      anomaliesContainerModule,
      settingContainerModule,
      courseRegistrationContainerModule,
      projectsContainerModule,
      hpSystemContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    currentUserCheckerSpy = vi
      .spyOn(Current, 'currentUserChecker')
      .mockImplementation(async (action: Action) => {
        if (action.request.headers.authorization) {
          const token = action.request.headers.authorization.split(' ')[1];
          if (token === 'user1') {
            return user1;
          } else if (token === 'user2') {
            return user2;
          }
        }
        return user2;
      });

    const options: RoutingControllersOptions = {
      controllers: reportsModuleOptions.controllers,
      middlewares: reportsModuleOptions.middlewares,
      defaultErrorHandler: reportsModuleOptions.defaultErrorHandler,
      authorizationChecker: () => true,
      //   authorizationChecker: reportsModuleOptions.authorizationChecker,
      currentUserChecker: Current.currentUserChecker,
      validation: reportsModuleOptions.validation,
    };

    app = useExpressServer(App, options);
  });

  afterEach(() => {
    currentUserCheckerSpy.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Report Creation', () => {
    describe('success', () => {
      it('should create a report', async () => {
        const reportPayload: ReportBody = {
          courseId: faker.database.mongodbObjectId(),
          entityId: faker.database.mongodbObjectId(),
          versionId: faker.database.mongodbObjectId(),
          entityType: 'ARTICLE',
          reason: 'test flag reason',
        };

        const response = await request(app)
          .post('/reports')
          .set('Authorization', 'Bearer user1')
          .send(reportPayload);

        expect(response.status).toBe(201);
      }, 60000);
    });
  });
});
