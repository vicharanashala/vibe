import request from 'supertest';
import {
  useExpressServer,
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
import {useContainer} from 'class-validator';
import {ReportBody} from '../classes/index.js';

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
    await container.load(...reportsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

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

        console.log('Response body:', response.body);
        expect(response.status).toBe(201);
      }, 60000);
    });
  });
});
