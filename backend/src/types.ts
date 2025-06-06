const TYPES = {
  //Database
  Database: Symbol.for('Database'),

  //Repositories
  UserRepository: Symbol.for('UserRepository'),
  CourseRepo: Symbol.for('CourseRepo'),

  //Constants
  uri: Symbol.for('dbURI'),
  dbName: Symbol.for('dbName'),
};

export {TYPES as GLOBAL_TYPES};
