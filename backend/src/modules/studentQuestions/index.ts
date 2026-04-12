import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {studentQuestionsContainerModule} from './container.js';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '../auth/container.js';
import {usersContainerModule} from '../users/container.js';
import {StudentQuestionController} from './controllers/StudentQuestionController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authorizationChecker, HttpErrorHandler} from '#root/shared/index.js';
import {STUDENT_QUESTION_VALIDATORS} from './classes/validators/index.js';

export const studentQuestionsContainerModules: ContainerModule[] = [
  studentQuestionsContainerModule,
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
];

export const studentQuestionsModuleControllers: Function[] = [
  StudentQuestionController,
];

export async function setupStudentQuestionsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...studentQuestionsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const studentQuestionsModuleOptions: RoutingControllersOptions = {
  controllers: studentQuestionsModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};

export const studentQuestionsModuleValidators: Function[] = [
  ...STUDENT_QUESTION_VALIDATORS,
];
