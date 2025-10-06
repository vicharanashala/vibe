import {ContainerModule} from 'inversify';
import { CourseRegistrationService } from './services/CourseRegistrationService.js';
import { COURSE_REGISTRATION_TYPES } from './types.js';
import { CourseRegistrationController } from './controllers/CourseRegistrationController.js';
import { CourseRegistrationRepository } from './repositories/index.js';

export const courseRegistrationContainerModule = new ContainerModule(options => {
    // Repositories

    options.bind(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository).to(CourseRegistrationRepository).inSingletonScope();

    // Services

    options.bind(COURSE_REGISTRATION_TYPES.CourseRegistrationService).to(CourseRegistrationService).inSingletonScope();

    // Controllers

    options.bind(CourseRegistrationController).toSelf().inSingletonScope();

});
