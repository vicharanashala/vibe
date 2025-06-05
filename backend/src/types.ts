const TYPES = {
  //Database
  Database: Symbol.for('Database'),

  //Repositories
  UserRepo: Symbol.for('UserRepo'),
  CourseRepo: Symbol.for('CourseRepo'),

  //Constants
  uri: Symbol.for('dbURI'),
  dbName: Symbol.for('dbName'),
};

export default TYPES;
