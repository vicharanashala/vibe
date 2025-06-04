import './instrument';
import Express from 'express';
import Sentry from '@sentry/node';
import {loggingHandler} from './shared/middleware/loggingHandler';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import {IDatabase} from './shared/database';
import {MongoDatabase} from './shared/database/providers/MongoDatabaseProvider';
import {dbConfig} from './config/db';
import * as firebase from 'firebase-admin';
import {app} from 'firebase-admin';
import {apiReference} from '@scalar/express-api-reference';
import {OpenApiSpecService} from './modules/docs';

// Import all module options
import {authModuleOptions, setupAuthContainer} from './modules/auth';
import {coursesModuleOptions, setupCoursesContainer} from './modules/courses';
import {setupUsersContainer, usersModuleOptions} from './modules/users';
import {quizzesModuleOptions, setupQuizzesContainer} from './modules/quizzes';
import {rateLimiter} from './shared/middleware/rateLimiter';
import {sharedContainerModule} from './container';
import {authContainerModule} from './modules/auth/container';
import {InversifyAdapter} from './inversify-adapter';
import {Container} from 'inversify';
import {coursesContainerModule} from 'modules/courses/container';
import {quizzesContainerModule} from 'modules/quizzes/container';
import {usersContainerModule} from 'modules/users/container';
import {getFromContainer} from 'class-validator';
import {appConfig} from 'config/app';

export const application = Express();

export const ServiceFactory = (
  service: typeof application,
  options: RoutingControllersOptions,
): typeof application => {
  console.log('--------------------------------------------------------');
  console.log('Initializing service server');
  console.log('--------------------------------------------------------');

  service.use(Express.urlencoded({extended: true}));
  service.use(Express.json());
  if (process.env.NODE_ENV === 'production') {
    service.use(rateLimiter);
  }

  console.log('--------------------------------------------------------');
  console.log('Logging and Configuration Setup');
  console.log('--------------------------------------------------------');

  service.use(loggingHandler);

  console.log('--------------------------------------------------------');
  console.log('Define Routing');
  console.log('--------------------------------------------------------');
  service.get('/main/healthcheck', (req, res) => {
    res.send('Hello World');
  });

  // Set up the API documentation route
  const openApiSpecService =
    getFromContainer<OpenApiSpecService>(OpenApiSpecService);

  // Register the /docs route before routing-controllers takes over
  if (process.env.NODE_ENV !== 'production') {
    service.get('/docs', (req, res) => {
      try {
        const openApiSpec = openApiSpecService.generateOpenAPISpec();

        const handler = apiReference({
          spec: {
            content: openApiSpec,
          },
          theme: {
            title: 'ViBe API Documentation',
            primaryColor: '#3B82F6',
            sidebar: {
              groupStrategy: 'byTagGroup',
              defaultOpenLevel: 0,
            },
          },
        });

        // Call the handler to render the documentation
        handler(req as any, res as any);
      } catch (error) {
        console.error('Error serving API documentation:', error);
        res
          .status(500)
          .send(`Failed to load API documentation: ${error.message}`);
      }
    });
  }
  console.log('--------------------------------------------------------');
  console.log('Routes Handler');
  console.log('--------------------------------------------------------');

  console.log('--------------------------------------------------------');
  console.log('Starting Server');
  console.log('--------------------------------------------------------');

  useExpressServer(service, options);
  if (process.env.NODE_ENV === 'production') {
    Sentry.setupExpressErrorHandler(service);
  }
  return service;
};

const setupAllModulesContainer = async () => {
  const container = new Container();
  const modules = [
    sharedContainerModule,
    usersContainerModule,
    authContainerModule,
    coursesContainerModule,
    quizzesContainerModule,
  ];
  await container.load(...modules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
};

const allModuleOptions: RoutingControllersOptions = {
  controllers: [
    ...(authModuleOptions.controllers as Function[]),
    ...(coursesModuleOptions.controllers as Function[]),
    ...(usersModuleOptions.controllers as Function[]),
    ...(quizzesModuleOptions.controllers as Function[]),
  ],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const main = async () => {
  let module;
  switch (process.env.MODULE) {
    case 'auth':
      await setupAuthContainer();
      module = ServiceFactory(application, authModuleOptions);
      break;
    case 'courses':
      await setupCoursesContainer();
      module = ServiceFactory(application, coursesModuleOptions);
      break;
    case 'users':
      await setupUsersContainer();
      module = ServiceFactory(application, usersModuleOptions);
      break;
    case 'quizzes':
      await setupQuizzesContainer();
      module = ServiceFactory(application, quizzesModuleOptions);
      break;
    case 'all':
      await setupAllModulesContainer();
      module = ServiceFactory(application, allModuleOptions);
  }
  module.listen(appConfig.port, () => {
    console.log('--------------------------------------------------------');
    console.log(
      `Started ${process.env.MODULE} Server at http://localhost:` +
        appConfig.port,
    );
  });
};

main().catch(error => {
  console.error('Error starting the application:', error);
  throw error;
});
