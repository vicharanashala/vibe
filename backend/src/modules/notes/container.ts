import { ContainerModule } from 'inversify';
import { NOTES_TYPES } from './types.js';
import { NotesRepository } from './repositories/NotesRepository.js';
import { NotesService } from './services/NotesService.js';
import { NotesController } from './controllers/NotesController.js';

export const notesContainerModule = new ContainerModule((options) => {
  options.bind(NOTES_TYPES.NotesRepository).to(NotesRepository);
  options.bind(NOTES_TYPES.NotesService).to(NotesService);
  options.bind(NotesController).toSelf();
});
