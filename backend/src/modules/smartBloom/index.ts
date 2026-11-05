import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {coursesContainerModules} from '../courses/index.js';
import {smartBloomContainerModule} from './container.js';
import {SmartBloomDirectController} from './controllers/SmartBloomDirectController.js';
import {SMART_BLOOM_VALIDATORS} from './classes/validators/SmartBloomValidators.js';

// The direct path creates course items, question banks and quizzes, so it loads
// the courses module's container (which brings in quizzes and users).
export const smartBloomContainerModules: ContainerModule[] = [
  smartBloomContainerModule,
  ...coursesContainerModules,
];

export const smartBloomModuleControllers: Function[] = [
  SmartBloomDirectController,
];

export const smartBloomModuleValidators: Function[] = SMART_BLOOM_VALIDATORS;

export async function setupSmartBloomContainer(): Promise<void> {
  const container = new Container();
  await container.load(...smartBloomContainerModules);
  useContainer(new InversifyAdapter(container));
}
