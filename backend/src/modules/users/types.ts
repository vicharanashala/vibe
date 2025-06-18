const TYPES = {
  //Services
  EnrollmentService: Symbol.for('EnrollmentService'),
  ProgressService: Symbol.for('ProgressService'),
  UserService: Symbol.for('UserService'),

  //Repositories
  ProgressRepo: Symbol.for('ProgressRepo'),
  EnrollmentRepo: Symbol.for('EnrollmentRepo'),
  ItemRepo: Symbol.for('ItemRepo'),
};

export {TYPES as USERS_TYPES};
