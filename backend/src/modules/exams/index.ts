import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import {
    RoutingControllersOptions,
    useContainer,
} from 'routing-controllers';
import { ExamController } from './controllers/ExamController.js';
import { AttemptController } from './controllers/AttemptController.js';
import { QuestionBankController } from './controllers/QuestionBankController.js';
import { examsContainerModule } from './container.js';
import {
    ExamIdParams,
    QuestionIdParams,
    TimeGrantIdParams,
    CreateExamBody,
    UpdateExamBody,
    AddQuestionBody,
    UpdateQuestionBody,
    AddTimeGrantBody,
    RedeemGrantBody,
    BulkAddQuestionsBody,
    AttemptIdParams,
    SubmitAttemptBody,
    QuestionBankIdParams,
    AddQuestionsFromBankBody,
} from './classes/validators/index.js';

// AttemptController vs. ExamController: its two-segment `/attempts/mine` and
// `/attempts/:attemptId` routes are already disambiguated from
// ExamController's single-segment `/:examId` by Express's exact
// segment-count matching (see the comment atop AttemptController.ts), so
// their relative order doesn't change behavior — kept for readability only.
//
// QuestionBankController vs. ExamController: THIS ordering IS load-bearing.
// `GET/POST /exams/question-bank` are single-segment literal routes, the
// exact same shape as ExamController's single-segment `GET /exams/:examId`
// param route — see QuestionBankController's class doc for the full
// analysis. QuestionBankController must be registered before ExamController
// or `/exams/question-bank` would be swallowed by `/exams/:examId`.
export const examsModuleControllers: Function[] = [
    QuestionBankController,
    AttemptController,
    ExamController,
];

export const examsContainerModules: ContainerModule[] = [
    examsContainerModule,
    sharedContainerModule,
];

export async function setupExamsContainer(): Promise<void> {
    const container = new Container();
    await container.load(...examsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const examsModuleOptions: RoutingControllersOptions = {
    controllers: examsModuleControllers,
    middlewares: [],
    defaultErrorHandler: true,
    authorizationChecker: async function () {
        return true;
    },
    validation: true,
};

export const examsModuleValidators: Function[] = [
    ExamIdParams,
    QuestionIdParams,
    TimeGrantIdParams,
    CreateExamBody,
    UpdateExamBody,
    AddQuestionBody,
    UpdateQuestionBody,
    AddTimeGrantBody,
    RedeemGrantBody,
    BulkAddQuestionsBody,
    AttemptIdParams,
    SubmitAttemptBody,
    QuestionBankIdParams,
    AddQuestionsFromBankBody,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './container.js';
