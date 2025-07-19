import { AnomalyController } from './controllers/AnomalyController.js';
import { anomaliesContainerModule } from './container.js';
import { sharedContainerModule } from '#root/container.js';
import { Container, ContainerModule } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'class-validator';

// Export names that loadAppModules expects
export const anomaliesModuleControllers: Function[] = [
  AnomalyController,
];

// Export container modules for loadAppModules
export const anomaliesContainerModules: ContainerModule[] = [
  anomaliesContainerModule,
  sharedContainerModule,
]

// This sets up Inversify bindings for the anomaly module
export async function setupAnomaliesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...anomaliesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

// Export all the main components for external use
export * from './controllers/AnomalyController.js';
export * from './services/AnomalyService.js';
export * from './services/CloudStorageService.js';
export * from './repositories/providers/mongodb/AnomalyRepository.js';
export * from './classes/transformers/Anomaly.js';
export * from './classes/validators/AnomalyValidators.js';
export * from './types.js';