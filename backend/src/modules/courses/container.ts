import {ContainerModule} from 'inversify';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import TYPES from './types';
import {ItemRepository} from 'shared/database/providers/mongo/repositories/ItemRepository';
import {
  CourseService,
  CourseVersionService,
  ItemService,
  ModuleService,
  SectionService,
} from './services';
import {
  CourseController,
  CourseVersionController,
  ItemController,
  ModuleController,
  SectionController,
} from './controllers';

export const coursesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(TYPES.CourseRepo).to(CourseRepository).inSingletonScope();
  options.bind(TYPES.ItemRepo).to(ItemRepository).inSingletonScope();

  // Services
  options.bind(TYPES.CourseService).to(CourseService).inSingletonScope();
  options
    .bind(TYPES.CourseVersionService)
    .to(CourseVersionService)
    .inSingletonScope();
  options.bind(TYPES.ModuleService).to(ModuleService).inSingletonScope();
  options.bind(TYPES.SectionService).to(SectionService).inSingletonScope();
  options.bind(TYPES.ItemService).to(ItemService).inSingletonScope();

  // Controllers
  options.bind(CourseController).toSelf().inSingletonScope();
  options.bind(CourseVersionController).toSelf().inSingletonScope();
  options.bind(ModuleController).toSelf().inSingletonScope();
  options.bind(SectionController).toSelf().inSingletonScope();
  options.bind(ItemController).toSelf().inSingletonScope();
});
