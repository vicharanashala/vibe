import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {studentQuestionsContainerModule} from './container.js';
import {StudentQuestionController} from './controllers/StudentQuestionController.js';
import {
  CreateStudentQuestionBody,
  StudentQuestionListQuery,
  StudentQuestionListResponse,
  StudentQuestionOptionDto,
  StudentQuestionPathParams,
  StudentQuestionStatusPathParams,
  UpdateStudentQuestionStatusBody,
} from './classes/validators/StudentQuestionValidator.js';

export const studentQuestionsContainerModules: ContainerModule[] = [
  studentQuestionsContainerModule,
  sharedContainerModule,
  authContainerModule,
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
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const studentQuestionsModuleValidators: Function[] = [
  CreateStudentQuestionBody,
  StudentQuestionOptionDto,
  StudentQuestionPathParams,
  StudentQuestionStatusPathParams,
  StudentQuestionListQuery,
  StudentQuestionListResponse,
  UpdateStudentQuestionStatusBody,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './types.js';
export * from './container.js';
