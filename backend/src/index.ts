import './instrument.js';
import Express from 'express';
import * as Sentry from '@sentry/node';
import {getFromContainer, useContainer} from 'class-validator';
import {Container} from 'inversify';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {appConfig} from '#config/app.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {
  coursesContainerModule,
  coursesModuleOptions,
  setupCoursesContainer,
} from '#courses/index.js';
import {rateLimiter, loggingHandler} from '#shared/index.js';
import {authContainerModule} from '#auth/container.js';
import {authModuleOptions, setupAuthContainer} from '#auth/index.js';
import {OpenApiSpecService} from '#docs/index.js';
import {quizzesContainerModule} from '#quizzes/container.js';
import {quizzesModuleOptions, setupQuizzesContainer} from '#quizzes/index.js';
import {usersContainerModule} from '#users/container.js';
import {usersModuleOptions, setupUsersContainer} from '#users/index.js';

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
    service.get('/docs', async (req, res) => {
      try {
        const scalar = await import('@scalar/express-api-reference');
        const openApiSpec = openApiSpecService.generateOpenAPISpec();
        const handler = scalar.apiReference({
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
