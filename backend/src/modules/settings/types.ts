const TYPES = {
  // Services
  CourseSettingsService: Symbol.for('CourseSettingsService'),
  UserSettingsService: Symbol.for('UserSettingsService'),

  // Repositories
  SettingsRepo: Symbol.for('SettingsRepo'),
};

export {TYPES as SETTINGS_TYPES};
