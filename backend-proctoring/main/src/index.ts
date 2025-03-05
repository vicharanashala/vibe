import './instrument';

import HTTP from 'http';
import Express from 'express';
import Sentry from '@sentry/node';
import { loggingHandler } from 'middleware/loggingHandler';
import { corsHandler } from 'middleware/corsHandler';
import { appConfig } from '@config/app';
import { routeNotFound } from 'middleware/routeNotFound';

export const application = Express();
export let server: ReturnType<typeof HTTP.createServer>;

export const Main = () => {
  console.log('--------------------------------------------------------');
  console.log('Initializing server');
  console.log('--------------------------------------------------------');

  application.use(Express.urlencoded({ extended: true }));
  application.use(Express.json());

  console.log('--------------------------------------------------------');
  console.log('Logging and Configuration Setup');
  console.log('--------------------------------------------------------');

  application.use(loggingHandler);
  application.use(corsHandler);

  console.log('--------------------------------------------------------');
  console.log('Define Routing');
  console.log('--------------------------------------------------------');
  application.get('/', (req, res) => {
    res.send('Hello World');
  }
  );
  application.get("/debug-sentry", (req, res) => {
    throw new Error("My first Sentry error!");
  });

  console.log('--------------------------------------------------------');
  console.log('Routes Handler');
  console.log('--------------------------------------------------------');
    //After Adding Routes
  Sentry.setupExpressErrorHandler(application);
  application.use(routeNotFound)

  console.log('--------------------------------------------------------');
  console.log('Starting Server');
  console.log('--------------------------------------------------------');
  server = HTTP.createServer(application);
  server.listen(appConfig.port, () => {
    console.log(`Server is running on port ${appConfig.port}`);
  }
  );



}

Main();