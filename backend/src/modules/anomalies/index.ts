import { AnomalyController } from './controllers/AnomalyController.js';
import { 
  CreateAnomalyBody, 
  AnomalyIdParams, 
  UserIdParams,
  AnomalyDataResponse,
  AnomalyStatsResponse 
} from './classes/validators/AnomalyValidators.js';
import { anomaliesContainerModule } from './container.js';
import { sharedContainerModule } from '#root/container.js';
import { ContainerModule } from 'inversify';
import { coursesContainerModule } from '../courses/container.js';
import { authContainerModule } from '../auth/container.js';
import { notificationsContainerModule } from '../notifications/container.js';
import { usersContainerModule } from '../users/container.js';
import { quizzesContainerModule } from '../quizzes/container.js';

// Export names that loadAppModules expects
export const anomaliesModuleControllers: Function[] = [
  AnomalyController,
];

export const anomaliesModuleValidators: Function[] = [
  CreateAnomalyBody,
  AnomalyIdParams,
  UserIdParams,
  AnomalyDataResponse,
  AnomalyStatsResponse,
];

// Export container modules for loadAppModules
export const anomaliesContainerModules: ContainerModule[] = [
  anomaliesContainerModule,
  sharedContainerModule,
]

// This sets up Inversify bindings for the anomaly module
export async function setupAnomaliesContainer(): Promise<void> {
  // Bindings are handled in the main container.ts file
}

// Export all the main components for external use
export * from './controllers/AnomalyController.js';
export * from './services/AnomalyService.js';
export * from './services/CloudStorageService.js';
export * from './repositories/providers/mongodb/AnomalyRepository.js';
export * from './classes/transformers/Anomaly.js';
export * from './classes/validators/AnomalyValidators.js';
export * from './types.js';