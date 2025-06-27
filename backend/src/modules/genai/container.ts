import { ContainerModule } from 'inversify';
import GenAIVideoController from './GenAIVideoController.js';
import { VideoService } from './services/VideoService.js';
import { AudioService } from './services/AudioService.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { AIContentService } from './services/AIContentService.js';
import { CleanupService } from './services/CleanupService.js';
import { GENAI_TYPES } from './types.js';

export const genaiContainerModule = new ContainerModule(options => {
  // Controllers
  options.bind(GenAIVideoController).toSelf().inSingletonScope();

  options.bind(VideoService).toSelf().inSingletonScope();
  options.bind(AudioService).toSelf().inSingletonScope();
  options.bind(TranscriptionService).toSelf().inSingletonScope();
  options.bind(AIContentService).toSelf().inSingletonScope();
  options.bind(CleanupService).toSelf().inSingletonScope();
});
