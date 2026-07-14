import {ContainerModule} from 'inversify';
import {STUDENT_QUESTION_TYPES} from './types.js';
import {StudentQuestionService} from './services/StudentQuestionService.js';
import {ScreeningService} from './services/screening/ScreeningService.js';
import {StudentQuestionController} from './controllers/StudentQuestionController.js';
import {StudentQuestionRepository} from './repositories/providers/mongodb/StudentQuestionRepository.js';
import {QuestionVectorRepository} from './repositories/providers/mongodb/QuestionVectorRepository.js';
import {VectorDedupService} from './services/screening/VectorDedupService.js';

export const studentQuestionsContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(StudentQuestionRepository).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    .to(StudentQuestionRepository);

  // Vector store (its own Atlas cluster — see QuestionVectorRepository).
  options.bind(QuestionVectorRepository).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.QuestionVectorRepo)
    .to(QuestionVectorRepository);

  // Semantic de-duplication (retrieve → LLM judges)
  options.bind(VectorDedupService).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.VectorDedupService)
    .to(VectorDedupService);

  // Screening filter
  options.bind(ScreeningService).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.ScreeningService)
    .to(ScreeningService);

  // Service
  options.bind(StudentQuestionService).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionService)
    .to(StudentQuestionService);

  // Controller
  options.bind(StudentQuestionController).toSelf().inSingletonScope();
});
