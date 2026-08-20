import { ContainerModule } from 'inversify';
import { duelsContainerModule } from './container.js';
import { DuelController } from './controllers/DuelController.js';
import { CreateDuelDto } from './validators/CreateDuelDto.js';
import { JoinDuelDto } from './validators/JoinDuelDto.js';
import { SubmitAnswerDto } from './validators/SubmitAnswerDto.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container } from 'inversify';
import { useContainer } from 'routing-controllers';

export const duelsContainerModules: ContainerModule[] = [
  duelsContainerModule,
];

export const duelsModuleControllers: Function[] = [
  DuelController,
];

export const duelsModuleValidators: Function[] = [
  CreateDuelDto,
  JoinDuelDto,
  SubmitAnswerDto,
];

export async function setupDuelsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...duelsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}
