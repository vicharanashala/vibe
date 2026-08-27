import { ContainerModule } from 'inversify';
import { NOTES_TYPES } from './types.js';
import { NotesRepository } from './repositories/NotesRepository.js';
import { NotesService } from './services/NotesService.js';
import { NotesController } from './controllers/NotesController.js';
import { STUDY_NOTES_TYPES } from './types/studyNotesTypes.js';
import { StudyNotesRepository } from './repositories/StudyNotesRepository.js';
import { StudyNotesService } from './services/StudyNotesService.js';
import { StudyNotesController } from './controllers/StudyNotesController.js';

export const notesContainerModule = new ContainerModule((options) => {
  options.bind(NOTES_TYPES.NotesRepository).to(NotesRepository);
  options.bind(NOTES_TYPES.NotesService).to(NotesService);
  options.bind(NotesController).toSelf();
  options.bind(STUDY_NOTES_TYPES.StudyNotesRepository).to(StudyNotesRepository).inSingletonScope();
  options.bind(STUDY_NOTES_TYPES.StudyNotesService).to(StudyNotesService).inSingletonScope();
  options.bind(StudyNotesController).toSelf();
});

