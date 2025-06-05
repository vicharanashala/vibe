import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {Container} from 'typedi';
import {OpenApiSpecService} from './services/OpenApiSpecService.js';
import {DocsController} from './DocsController.js';

// Export empty array for controllers since we're handling docs differently
export const docsModuleOptions: RoutingControllersOptions = {
  controllers: [DocsController],
  routePrefix: '',
  defaultErrorHandler: true,
};

export {OpenApiSpecService};
