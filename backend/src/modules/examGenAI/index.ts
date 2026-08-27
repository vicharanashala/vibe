import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { examsContainerModule } from '#root/modules/exams/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { RoutingControllersOptions, useContainer } from 'routing-controllers';
import { ExamGenAIController } from './controllers/ExamGenAIController.js';
import { examGenAIContainerModule } from './container.js';
import { GenerateQuestionsBody, JobIdParams, SaveGeneratedQuestionsBody } from './classes/validators/ExamGenAIValidators.js';

// This module's directory name is `examGenAI`, so bootstrap/loadModules.ts
// looks for exactly these four export names (`examGenAIModuleControllers`,
// `examGenAIModuleValidators`, `examGenAIContainerModules`,
// `setupExamGenAIContainer`) — see exams/index.ts for the identical pattern
// this was copied from.
//
// Deliberately depends on `examsContainerModule` (for EXAMS_TYPES.ExamService
// — saving generated questions embeds them into an exam via
// `ExamService.appendQuestions`) and `sharedContainerModule` (for
// GLOBAL_TYPES.Database, used by this module's own Mongo repositories).
// Only those two modules' *bindings* are used; their controllers are not
// added to `examGenAIModuleControllers`, so this does not expose `/exams` or
// any other module's routes.
export const examGenAIModuleControllers: Function[] = [ExamGenAIController];

export const examGenAIContainerModules: ContainerModule[] = [
    examGenAIContainerModule,
    sharedContainerModule,
    examsContainerModule,
];

export async function setupExamGenAIContainer(): Promise<void> {
    const container = new Container();
    await container.load(...examGenAIContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const examGenAIModuleOptions: RoutingControllersOptions = {
    controllers: examGenAIModuleControllers,
    middlewares: [],
    defaultErrorHandler: true,
    authorizationChecker: async function () {
        return true;
    },
    validation: true,
};

export const examGenAIModuleValidators: Function[] = [
    GenerateQuestionsBody,
    JobIdParams,
    SaveGeneratedQuestionsBody,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './container.js';
