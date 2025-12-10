import { ContainerModule } from "inversify";
import { COURSES_TYPES } from "./types.js";
import { CourseService } from "./services/CourseService.js";
import { CourseVersionService } from "./services/courseVersionService.js";
import { CourseController } from "./controllers/CourseController.js";
import { CourseVersionController } from "./controllers/courseVersionController.js";


export const coursesContainerModule = new ContainerModule(options => {
  // Repositories

  // Services
  options
    .bind(COURSES_TYPES.CourseService)
    .to(CourseService)
    .inSingletonScope();
  options
    .bind(COURSES_TYPES.CourseVersionService)
    .to(CourseVersionService)
    .inSingletonScope();

  // Controllers
  options.bind(CourseController).toSelf().inSingletonScope();
  options.bind(CourseVersionController).toSelf().inSingletonScope()
  
});