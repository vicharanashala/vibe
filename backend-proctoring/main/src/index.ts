import './instrument';

import HTTP from 'http';
import Express from 'express';
import Sentry from '@sentry/node';
import { loggingHandler } from 'shared/middleware/loggingHandler';
import { appConfig } from '@config/app';
import { RoutingControllersOptions, useExpressServer } from 'routing-controllers';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { serviceOptions } from 'modules/auth';


export const application = Express();

export const ServiceFactory = (service: typeof application, options: RoutingControllersOptions, port: Number) => {
  console.log('--------------------------------------------------------');
  console.log('Initializing service server');
  console.log('--------------------------------------------------------');

  service.use(Express.urlencoded({ extended: true }));
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
  }
  );
  service.get("/debug-sentry", (req, res) => {
    throw new Error("My first Sentry error!");
  });

  console.log('--------------------------------------------------------');
  console.log('Routes Handler');
  console.log('--------------------------------------------------------');
    //After Adding Routes
  Sentry.setupExpressErrorHandler(service);

  console.log('--------------------------------------------------------');
  console.log('Starting Server');
  console.log('--------------------------------------------------------');

  useExpressServer(service, options);

  service.listen(port, () => {
      console.log('--------------------------------------------------------');
      console.log('Started Server at http://localhost:' + port);
      console.log('--------------------------------------------------------');
  });

}

// Create a main function where multiple services are created
export const main = () => {
  ServiceFactory(application, serviceOptions, appConfig.port);
}

main();