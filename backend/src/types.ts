import { Invite, MailService } from "./modules/notifications/index.js";

const TYPES = {
  //Database
  Database: Symbol.for('Database'),

  //Services
  MailService: Symbol.for('MailService'),

  //Repositories
  UserRepo: Symbol.for('UserRepo'),
  CourseRepo: Symbol.for('CourseRepo'),
  InviteRepo: Symbol.for('InviteRepo'),
  EnrollmentRepo: Symbol.for('EnrollmentRepo'),
  CourseVersionService: Symbol.for('CourseVersionService'),
  SettingRepo: Symbol.for('SettingRepo'),
  

  //Constants
  uri: Symbol.for('dbURI'),
  dbName: Symbol.for('dbName'),
};

export {TYPES as GLOBAL_TYPES};
