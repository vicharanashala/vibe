const TYPES = {
  // Services
  CourseSettingService: Symbol.for('CourseSettingService'),
  UserSettingService: Symbol.for('UserSettingService'),
  TimeSlotService: Symbol.for('TimeSlotService'),

  // Repositories
  SettingRepo: Symbol.for('SettingRepo'),
};

export { TYPES as SETTING_TYPES };
