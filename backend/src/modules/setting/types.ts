const TYPES = {
  // Services
  CourseSettingService: Symbol.for('CourseSettingService'),
  UserSettingService: Symbol.for('UserSettingService'),
  TimeSlotService: Symbol.for('TimeSlotService'),
  SlotBookingService: Symbol.for('SlotBookingService'),
  FulfillmentService: Symbol.for('FulfillmentService'),

  // Repositories
  SettingRepo: Symbol.for('SettingRepo'),
};

export { TYPES as SETTING_TYPES };
