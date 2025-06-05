import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import {Container} from 'inversify';
import {RoutingControllersOptions} from 'routing-controllers';
import {QuestionController, quizzesContainerModule} from '#quizzes/index.js';

export async function setupQuizzesContainer(): Promise<void> {
  const container = new Container();
  await container.load(sharedContainerModule, quizzesContainerModule);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const quizzesModuleOptions: RoutingControllersOptions = {
  controllers: [QuestionController],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './interfaces/index.js';
export * from './repositories/index.js';
export * from './services/index.js';
export * from './container.js';
export * from './types.js';
export * from './utils/index.js';
