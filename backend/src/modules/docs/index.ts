import {RoutingControllersOptions} from 'routing-controllers';
import {DocsController} from './DocsController.js';
import {OpenApiSpecService} from './services/OpenApiSpecService.js';

// Export empty array for controllers since we're handling docs differently
export const docsModuleOptions: RoutingControllersOptions = {
  controllers: [DocsController],
  routePrefix: '',
  defaultErrorHandler: true,
};

export {OpenApiSpecService};
export * from './services/index.js';
export * from './DocsController.js';
