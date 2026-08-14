import { ContainerModule } from 'inversify';
import { EXAMS_TYPES } from './types.js';
import { ExamRepository } from './repositories/providers/mongodb/ExamRepository.js';
import { AttemptRepository } from './repositories/providers/mongodb/AttemptRepository.js';
import { QuestionBankRepository } from './repositories/providers/mongodb/QuestionBankRepository.js';
import { ExamService } from './services/ExamService.js';
import { AttemptService } from './services/AttemptService.js';
import { ExamImageStorageService } from './services/ExamImageStorageService.js';
import { QuestionBankService } from './services/QuestionBankService.js';
import { ExamController } from './controllers/ExamController.js';
import { AttemptController } from './controllers/AttemptController.js';
import { QuestionBankController } from './controllers/QuestionBankController.js';

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
