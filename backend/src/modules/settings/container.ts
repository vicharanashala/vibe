import {SettingsRepository} from '#root/shared/index.js';
import {ContainerModule} from 'inversify';
import {SETTINGS_TYPES} from './types.js';
import {CourseSettingsService} from './services/CourseSettingsService.js';
import {CourseSettingsController} from './controllers/CourseSettingsController.js';
import {UserSettingsController} from './controllers/UserSettingsController.js';
import {UserSettingsService} from './services/UserSettingsService.js';

export const settingsContainerModule = new ContainerModule(options => {
  // Services
  options.bind(SETTINGS_TYPES.CourseSettingsService).to(CourseSettingsService);
  options.bind(SETTINGS_TYPES.UserSettingsService).to(UserSettingsService);

  // Controllers
  options.bind(CourseSettingsController).toSelf().inSingletonScope();
  options.bind(UserSettingsController).toSelf().inSingletonScope();
});
