import {ContainerModule} from 'inversify';
import {COURSES_TYPES} from './types.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {CourseController} from './controllers/CourseController.js';
import {CourseVersionController} from './controllers/CourseVersionController.js';
import {ItemController} from './controllers/ItemController.js';
import {ModuleController} from './controllers/ModuleController.js';
import {SectionController} from './controllers/SectionController.js';
import {CourseService} from './services/CourseService.js';
import {CourseVersionService} from './services/CourseVersionService.js';
import {ItemService} from './services/ItemService.js';
import {ModuleService} from './services/ModuleService.js';
import {SectionService} from './services/SectionService.js';

export const coursesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(COURSES_TYPES.ItemRepo).to(ItemRepository).inSingletonScope();

  // Services
  options
    .bind(COURSES_TYPES.CourseService)
    .to(CourseService)
    .inSingletonScope();
  options
    .bind(COURSES_TYPES.CourseVersionService)
    .to(CourseVersionService)
    .inSingletonScope();
  options
    .bind(COURSES_TYPES.ModuleService)
    .to(ModuleService)
    .inSingletonScope();
  options
    .bind(COURSES_TYPES.SectionService)
    .to(SectionService)
    .inSingletonScope();
  options.bind(COURSES_TYPES.ItemService).to(ItemService).inSingletonScope();

  // Controllers
  options.bind(CourseController).toSelf().inSingletonScope();
  options.bind(CourseVersionController).toSelf().inSingletonScope();
  options.bind(ModuleController).toSelf().inSingletonScope();
  options.bind(SectionController).toSelf().inSingletonScope();
  options.bind(ItemController).toSelf().inSingletonScope();
});
