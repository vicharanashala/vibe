import { ContainerModule } from 'inversify';
import { EXAM_GENAI_TYPES } from './types.js';
import { AiApiLogRepository } from './repositories/providers/mongodb/AiApiLogRepository.js';
import { GeneratedQuestionRepository } from './repositories/providers/mongodb/GeneratedQuestionRepository.js';
import { LlmClient } from './services/LlmClient.js';
import { QuestionGenerationService } from './services/QuestionGenerationService.js';
import { SseService } from './services/SseService.js';
import { ExamGenAIController } from './controllers/ExamGenAIController.js';

export const examGenAIContainerModule = new ContainerModule(options => {
    // Repositories
    options.bind(EXAM_GENAI_TYPES.AiApiLogRepo).to(AiApiLogRepository).inSingletonScope();
    options.bind(EXAM_GENAI_TYPES.GeneratedQuestionRepo).to(GeneratedQuestionRepository).inSingletonScope();

    // Services
    options.bind(EXAM_GENAI_TYPES.LlmClient).to(LlmClient).inSingletonScope();
    options.bind(EXAM_GENAI_TYPES.SseService).to(SseService).inSingletonScope();
    options.bind(EXAM_GENAI_TYPES.QuestionGenerationService).to(QuestionGenerationService).inSingletonScope();

    // Controllers
    options.bind(ExamGenAIController).toSelf().inSingletonScope();
});
