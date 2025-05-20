if (process.env.NODE_ENV === 'production') {
  import('./instrument');
}
import Express from 'express';
import Sentry from '@sentry/node';
import {loggingHandler} from 'shared/middleware/loggingHandler';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import Container from 'typedi';
import {IDatabase} from 'shared/database';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {dbConfig} from 'config/db';
import * as firebase from 'firebase-admin';
import {app} from 'firebase-admin';
import {apiReference} from '@scalar/express-api-reference';
import {OpenApiSpecService} from './modules/docs';

// Import all module options
import {authModuleOptions} from './modules/auth';
import {coursesModuleOptions} from './modules/courses';
import {usersModuleOptions} from './modules/users';

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
  const openApiSpecService = Container.get(OpenApiSpecService);

  // Register the /docs route before routing-controllers takes over
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

  console.log('--------------------------------------------------------');
  console.log('Routes Handler');
  console.log('--------------------------------------------------------');
  //After Adding Routes
  if (process.env.NODE_ENV === 'production') {
    Sentry.setupExpressErrorHandler(service);
  }

  console.log('--------------------------------------------------------');
  console.log('Starting Server');
  console.log('--------------------------------------------------------');

  // Create combined routing controllers options
  const routingControllersOptions = {
    ...options,
    controllers: [
      ...(authModuleOptions.controllers as Function[]),
      ...(coursesModuleOptions.controllers as Function[]),
      ...(usersModuleOptions.controllers as Function[]),
    ],
  };

  useExpressServer(service, routingControllersOptions);

  return service;
};

// Create a main function where multiple services are created

useContainer(Container);

if (!Container.has('Database')) {
  Container.set<IDatabase>('Database', new MongoDatabase(dbConfig.url, 'vibe'));
}

export const main = () => {
  const service = ServiceFactory(application, authModuleOptions);
  service.listen(4001, () => {
    console.log('--------------------------------------------------------');
    console.log('Started Server at http://localhost:' + 4001);
    console.log('--------------------------------------------------------');
  });
};

main();
