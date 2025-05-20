import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {Container} from 'typedi';
import {OpenApiSpecService} from './services/OpenApiSpecService';

// Set up TypeDI container
useContainer(Container);

// Export empty array for controllers since we're handling docs differently
export const docsModuleOptions: RoutingControllersOptions = {
  controllers: [],
  routePrefix: '',
  defaultErrorHandler: true,
};

export * from './services/OpenApiSpecService';
