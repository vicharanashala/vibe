import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {coursesContainerModule} from '../courses/container.js';
import {usersContainerModule} from '../users/container.js';
import {mediaContainerModule} from './container.js';
import {VideoAssetController} from './controllers/VideoAssetController.js';
import {
  CreateVideoUploadUrlBody,
  CreateVideoUploadUrlResponse,
  ListVideoAssetsQuery,
  UpdateVideoAssetBody,
  VideoAssetIdParams,
  VideoAssetListResponse,
  VideoAssetResponse,
  VideoPlaybackGrantResponse,
} from './classes/validators/VideoAssetValidator.js';

export const mediaContainerModules: ContainerModule[] = [
  mediaContainerModule,
  sharedContainerModule,
  authContainerModule,
  coursesContainerModule,
  usersContainerModule,
];

export const mediaModuleControllers: Function[] = [VideoAssetController];

export async function setupMediaContainer(): Promise<void> {
  const container = new Container();
  await container.load(...mediaContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const mediaModuleOptions: RoutingControllersOptions = {
  controllers: mediaModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const mediaModuleValidators: Function[] = [
  CreateVideoUploadUrlBody,
  CreateVideoUploadUrlResponse,
  VideoAssetIdParams,
  ListVideoAssetsQuery,
  UpdateVideoAssetBody,
  VideoAssetResponse,
  VideoAssetListResponse,
  VideoPlaybackGrantResponse,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './types.js';
export * from './container.js';
