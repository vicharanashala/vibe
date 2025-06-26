import { Invite, MailService } from "./modules/notifications/index.js";

const TYPES = {
  //Database
  Database: Symbol.for('Database'),

  //Repositories
  UserRepo: Symbol.for('UserRepo'),
  CourseRepo: Symbol.for('CourseRepo'),
  InviteRepo: Symbol.for('InviteRepo'),
  EnrollmentRepo: Symbol.for('EnrollmentRepo'),

  //Services
  MailService: Symbol.for('MailService'),
  
  SettingsRepo: Symbol.for('SettingsRepo'),

  //Constants
  uri: Symbol.for('dbURI'),
  dbName: Symbol.for('dbName'),
};

export {TYPES as GLOBAL_TYPES};
