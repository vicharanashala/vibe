import { notesContainerModule } from './container.js';
import { NotesController } from './controllers/NotesController.js';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'routing-controllers';
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#auth/container.js';
import { usersContainerModule } from '../users/container.js';
import { quizzesContainerModule } from '../quizzes/container.js';
import { notificationsContainerModule } from '../notifications/container.js';

export const notesContainerModules = [
  notesContainerModule,
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
  quizzesContainerModule,
  notificationsContainerModule
];

export const notesModuleControllers = [
  NotesController,
];

export const notesModuleValidators = [];

export async function setupNotesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...notesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}
