import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {quizzesContainerModule} from './container.js';
import {QuestionController} from './controllers/QuestionController.js';
import {QuestionBankController} from './controllers/QuestionBankController.js';
import {coursesContainerModule} from '#courses/container.js';
import {AttemptController} from './controllers/AttemptController.js';
import {QuizController} from './controllers/QuizController.js';
import { } from './classes/validators/QuestionBankValidator.js';
import { QUESTIONBANK_VALIDATORS, QUESTION_VALIDATORS, QUIZ_VALIDATORS } from './classes/validators/index.js';
import { } from './classes/validators/QuizValidator.js';
import { authContainerModule } from '../auth/container.js';
import { notificationsContainerModule } from '../notifications/container.js';
import { usersContainerModule } from '../users/container.js';

export const quizzesContainerModules: ContainerModule[] = [
  quizzesContainerModule,
  sharedContainerModule,
  coursesContainerModule,
  authContainerModule,
  notificationsContainerModule,
  usersContainerModule
];

export const quizzesModuleControllers: Function[] = [
  QuestionController,
  QuestionBankController,
  AttemptController,
  QuizController,
];

export async function setupQuizzesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...quizzesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const quizzesModuleOptions: RoutingControllersOptions = {
  controllers: quizzesModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const quizzesModuleValidators: Function[] = [
  ...QUESTIONBANK_VALIDATORS,
  ...QUESTION_VALIDATORS,
  ...QUIZ_VALIDATORS
]
