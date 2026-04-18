import { ContainerModule } from 'inversify';
import { CourseSettingController } from './controllers/CourseSettingController.js';import { SETTING_TYPES } from './types.js';
import { CourseSettingService } from './services/CourseSettingService.js';
import { UserSettingController } from './controllers/UserSettingController.js';
import { UserSettingService } from './services/UserSettingService.js';
import { SettingRepository } from '#root/shared/index.js';

export const settingContainerModule = new ContainerModule(options => {
  // Services
  options.bind(SETTING_TYPES.CourseSettingService).to(CourseSettingService);
  options.bind(SETTING_TYPES.UserSettingService).to(UserSettingService);

  // Controllers
  options.bind(CourseSettingController).toSelf().inSingletonScope();
  options.bind(UserSettingController).toSelf().inSingletonScope();
});
