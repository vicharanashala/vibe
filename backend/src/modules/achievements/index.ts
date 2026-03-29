import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {AchievementController} from './controllers/AchievementController.js';
import {achievementsContainerModule} from './container.js';

export const achievementsModuleControllers: Function[] = [
  AchievementController,
];

export const achievementsContainerModules: ContainerModule[] = [
  achievementsContainerModule,
  sharedContainerModule,
  usersContainerModule,
  notificationsContainerModule,
];

export async function setupAchievementsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...achievementsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './container.js';
export * from './types.js';
