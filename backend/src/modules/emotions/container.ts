import { ContainerModule } from 'inversify';
import { EmotionController } from './controllers/EmotionController.js';
import { EmotionService } from './services/EmotionService.js';
import { EmotionRepository } from './repositories/EmotionRepository.js';
import { EMOTIONS_TYPES } from './types.js';

export const emotionsContainerModule = new ContainerModule(options => {
	options
		.bind(EMOTIONS_TYPES.EmotionRepository)
		.to(EmotionRepository)
		.inSingletonScope();

	options
		.bind(EMOTIONS_TYPES.EmotionService)
		.to(EmotionService)
		.inSingletonScope();

	options.bind(EmotionController).toSelf().inSingletonScope();
});
