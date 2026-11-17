import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'class-validator';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {sharedContainerModule} from '#root/container.js';
import {analyticsContainerModule} from './container.js';
import {AnalyticsController} from './controllers/AnalyticsController.js';
import {ANALYTICS_VALIDATORS} from './classes/validators.js';

// Names loadAppModules expects (see bootstrap/loadModules.ts).
export const analyticsModuleControllers: Function[] = [AnalyticsController];

export const analyticsContainerModules: ContainerModule[] = [
  analyticsContainerModule,
  sharedContainerModule,
];

export const analyticsModuleValidators: Function[] = ANALYTICS_VALIDATORS;

export async function setupAnalyticsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...analyticsContainerModules);
  useContainer(new InversifyAdapter(container));
}

export * from './types.js';
export * from './interfaces.js';
