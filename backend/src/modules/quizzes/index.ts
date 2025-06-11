import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {quizzesContainerModule} from './container.js';
import {QuestionController} from './controllers/QuestionController.js';
import {QuestionBankController} from './controllers/QuestionBankController.js';
import {coursesContainerModule} from '#courses/container.js';
import {Attempt, Question} from './classes/index.js';
import {AttemptController} from './controllers/AttemptController.js';
import {QuizController} from './controllers/QuizController.js';

export async function setupQuizzesContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    quizzesContainerModule,
    coursesContainerModule,
  );
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const quizzesModuleOptions: RoutingControllersOptions = {
  controllers: [
    QuestionController,
    QuestionBankController,
    AttemptController,
    QuizController,
  ],
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
