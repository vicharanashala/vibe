import {ItemRepository} from '#shared/index.js';
import {ContainerModule} from 'inversify';
import {
  CourseController,
  CourseVersionController,
  ItemController,
  ModuleController,
  SectionController,
} from './controllers/index.js';
import {
  CourseService,
  CourseVersionService,
  ItemService,
  ModuleService,
  SectionService,
} from './services/index.js';
import {COURSES_TYPES} from './types.js';

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
