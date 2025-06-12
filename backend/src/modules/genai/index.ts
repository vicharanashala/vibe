import 'reflect-metadata';
import {RoutingControllersOptions} from 'routing-controllers';
import {Container} from 'typedi';
import {useContainer} from 'routing-controllers';
import GenAIVideoController from './GenAIVideoController.js'; // Remove .ts extension

useContainer(Container);

export const genaiModuleOptions: RoutingControllersOptions = {
  controllers: [GenAIVideoController],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    // For now, allow all requests to GenAI endpoints
    // You can add authentication logic here if needed
    return true;
  },
  validation: true,
};

export * from './GenAIVideoController.js';
