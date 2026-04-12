import {ContainerModule} from 'inversify';
import {STUDENT_QUESTION_TYPES} from './types.js';
import {StudentQuestionRepository} from './repositories/providers/mongodb/StudentQuestionRepository.js';
import {StudentQuestionService} from './services/StudentQuestionService.js';
import {StudentQuestionController} from './controllers/StudentQuestionController.js';

export const studentQuestionsContainerModule = new ContainerModule(options => {
  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    .to(StudentQuestionRepository)
    .inSingletonScope();

  options
    .bind(STUDENT_QUESTION_TYPES.StudentQuestionService)
    .to(StudentQuestionService)
    .inSingletonScope();

  options.bind(StudentQuestionController).toSelf().inSingletonScope();
});
