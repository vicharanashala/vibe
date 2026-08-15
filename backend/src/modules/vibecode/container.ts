import { ContainerModule } from 'inversify';
import { VIBECODE_TYPES } from './types.js';
import { CodingProblemRepository } from './repositories/providers/mongodb/CodingProblemRepository.js';
import { CodingSubmissionRepository } from './repositories/providers/mongodb/CodingSubmissionRepository.js';
import { CodeExecutionService } from './services/CodeExecutionService.js';
import { CodeExecutionController } from './controllers/CodeExecutionController.js';

export const vibecodeContainerModule = new ContainerModule((options) => {
  // Repositories
  options.bind<CodingProblemRepository>(VIBECODE_TYPES.CodingProblemRepo)
    .to(CodingProblemRepository)
    .inSingletonScope();

  options.bind<CodingSubmissionRepository>(VIBECODE_TYPES.CodingSubmissionRepo)
    .to(CodingSubmissionRepository)
    .inSingletonScope();

  // Services
  options.bind<CodeExecutionService>(VIBECODE_TYPES.CodeExecutionService)
    .to(CodeExecutionService)
    .inSingletonScope();

  // Controllers
  options.bind(CodeExecutionController).toSelf().inSingletonScope();
});
