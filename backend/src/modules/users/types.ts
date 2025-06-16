const TYPES = {
  //Services
  EnrollmentService: Symbol.for('EnrollmentService'),
  ProgressService: Symbol.for('ProgressService'),

  //Repositories
  ProgressRepo: Symbol.for('ProgressRepo'),
  EnrollmentRepo: Symbol.for('EnrollmentRepo'),
  UserRepo: Symbol.for('UserRepo'),
  ItemRepo: Symbol.for('ItemRepo'),
};

export {TYPES as USERS_TYPES};
