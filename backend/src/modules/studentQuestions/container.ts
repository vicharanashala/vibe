import {ContainerModule} from 'inversify';
import {STUDENT_QUESTION_TYPES} from './types.js';
import {StudentQuestionService} from './services/StudentQuestionService.js';
import {ScreeningService} from './services/screening/ScreeningService.js';
import {SegmentContextProvider} from './services/context/SegmentContextProvider.js';
import {StudentQuestionController} from './controllers/StudentQuestionController.js';
import {StudentQuestionRepository} from './repositories/providers/mongodb/StudentQuestionRepository.js';

export const studentQuestionsContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(StudentQuestionRepository).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    .to(StudentQuestionRepository);

  // Screening filter
  options.bind(ScreeningService).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.ScreeningService)
    .to(ScreeningService);

  // Lesson-context provider for the screening relevance/correctness checks
  options.bind(SegmentContextProvider).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.SegmentContextProvider)
    .to(SegmentContextProvider);

  // Service
  options.bind(StudentQuestionService).toSelf().inSingletonScope();
  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionService)
    .to(StudentQuestionService);

  // Controller
  options.bind(StudentQuestionController).toSelf().inSingletonScope();
});
