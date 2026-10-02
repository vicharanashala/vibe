import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import {
    RoutingControllersOptions,
    useContainer,
} from 'routing-controllers';
// Import order here drives routing-controllers' actual route registration
// order (it registers routes in the order controller decorators evaluated
// at import time, NOT the order of `examsModuleControllers` below) — so
// QuestionBankController must be imported before ExamController, or its
// literal `/exams/question-bank` routes get swallowed by ExamController's
// `/exams/:examId` param route. See QuestionBankController's class doc.
import { QuestionBankController } from './controllers/QuestionBankController.js';
import { AttemptController } from './controllers/AttemptController.js';
import { ExamController } from './controllers/ExamController.js';
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
// QuestionBankController vs. ExamController: `GET/POST /exams/question-bank`
// are single-segment literal routes, the exact same shape as ExamController's
// single-segment `GET /exams/:examId` param route — see QuestionBankController's
// class doc for the full analysis. This array's order is NOT what determines
// registration order (routing-controllers registers routes in decorator/import
// order, not in this array's order) — the load-bearing fix is the import
// order above, which must list QuestionBankController before ExamController.
// This array is kept in the same order purely for readability.
export const examsModuleControllers: Function[] = [
    QuestionBankController,
    AttemptController,
    ExamController,
];

export const examsContainerModules: ContainerModule[] = [
    examsContainerModule,
    sharedContainerModule,
    // Needed for GLOBAL_TYPES.EnrollmentRepo (= USERS_TYPES.EnrollmentRepo,
    // same Symbol.for token) — ExamService.isEligibleForStudent looks up a
    // student's course-completion % via EnrollmentRepository for exams that
    // gate visibility on it. Only its DI bindings are used here; its
    // controllers are never added to `examsModuleControllers`, so this does
    // not expose any `/users` or `/enrollments` routes on the exams app.
    usersContainerModule,
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
