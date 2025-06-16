import express from 'express';
import {useExpressServer, RoutingControllersOptions} from 'routing-controllers';
import {appConfig} from './config/app.js';
import {loggingHandler} from './shared/middleware/loggingHandler.js';
import {HttpErrorHandler} from './shared/index.js';
import {generateOpenAPISpec} from './shared/functions/generateOpenApiSpec.js';
import {apiReference} from '@scalar/express-api-reference';
import {loadAppModules} from './bootstrap/loadModules.js';
import {printStartupSummary} from './utils/logDetails.js';

const app = express();
app.use(loggingHandler);

const {controllers} = await loadAppModules(appConfig.module.toLowerCase());

const moduleOptions: RoutingControllersOptions = {
  controllers: controllers,
  middlewares: [HttpErrorHandler],
  routePrefix: '/api',
  authorizationChecker: async () => true,
  currentUserChecker: async () => true,
  defaultErrorHandler: true,
  development: appConfig.isDevelopment,
  validation: true,
};

const openApiSpec = await generateOpenAPISpec(moduleOptions);
app.use(
  '/reference',
  apiReference({
    content: openApiSpec,
    theme: 'elysiajs',
  }),
);

// Start server
useExpressServer(app, moduleOptions);
app.listen(appConfig.port, () => {
  printStartupSummary();
});
