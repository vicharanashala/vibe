import { ContainerModule } from 'inversify';
import { askBetalContainerModule } from './container.js';
import { AskBetalController } from './controllers/AskBetalController.js';
import { AskQuestionDto, PriorTurnDto } from './validators/AskQuestionDto.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container } from 'inversify';
import { useContainer } from 'routing-controllers';

export const askBetalContainerModules: ContainerModule[] = [
  askBetalContainerModule,
];

export const askBetalModuleControllers: Function[] = [
  AskBetalController,
];

export const askBetalModuleValidators: Function[] = [
  AskQuestionDto,
  PriorTurnDto,
];

export async function setupAskBetalContainer(): Promise<void> {
  const container = new Container();
  await container.load(...askBetalContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export * from './types.js';
export * from './container.js';
export * from './services/AskBetalService.js';
export * from './controllers/AskBetalController.js';
