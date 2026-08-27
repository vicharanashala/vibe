import { ContainerModule } from 'inversify';
import { EXAMS_TYPES } from './types.js';
import { ExamRepository } from './repositories/providers/mongodb/ExamRepository.js';
import { AttemptRepository } from './repositories/providers/mongodb/AttemptRepository.js';
import { QuestionBankRepository } from './repositories/providers/mongodb/QuestionBankRepository.js';
import { ExamService } from './services/ExamService.js';
import { AttemptService } from './services/AttemptService.js';
import { ExamImageStorageService } from './services/ExamImageStorageService.js';
import { QuestionBankService } from './services/QuestionBankService.js';
// Import order matters: routing-controllers registers routes in the order
// controller decorators evaluate (i.e. import order), not in any explicit
// array order. QuestionBankController must be imported before ExamController
// or its literal `/exams/question-bank` routes get swallowed by
// ExamController's `/exams/:examId` param route. This file is reached before
// exams/index.ts's own (correctly-ordered) controller imports whenever
// another module imports this container.js directly (e.g. examGenAI/index.ts
// imports exams/container.js before exams/index.js is ever loaded) — so the
// order must be correct here too, independently.
import { QuestionBankController } from './controllers/QuestionBankController.js';
import { AttemptController } from './controllers/AttemptController.js';
import { ExamController } from './controllers/ExamController.js';

export const examsContainerModule = new ContainerModule(options => {
    // Repositories
    options.bind(EXAMS_TYPES.ExamRepo).to(ExamRepository).inSingletonScope();
    options.bind(EXAMS_TYPES.AttemptRepo).to(AttemptRepository).inSingletonScope();
    options.bind(EXAMS_TYPES.QuestionBankRepo).to(QuestionBankRepository).inSingletonScope();

    // Services
    options.bind(EXAMS_TYPES.ExamImageStorageService).to(ExamImageStorageService).inSingletonScope();
    options.bind(EXAMS_TYPES.ExamService).to(ExamService).inSingletonScope();
    options.bind(EXAMS_TYPES.AttemptService).to(AttemptService).inSingletonScope();
    options.bind(EXAMS_TYPES.QuestionBankService).to(QuestionBankService).inSingletonScope();

    // Controllers
    options.bind(ExamController).toSelf().inSingletonScope();
    options.bind(AttemptController).toSelf().inSingletonScope();
    options.bind(QuestionBankController).toSelf().inSingletonScope();
});
