const TYPES = {
  //Services
  EnrollmentService: Symbol.for('EnrollmentService'),
  ProgressService: Symbol.for('ProgressService'),
  UserService: Symbol.for('UserService'),
  UserActivityEventService: Symbol.for('UserActivityEventService'),

  //Repositories
  ProgressRepo: Symbol.for('ProgressRepo'),
  EnrollmentRepo: Symbol.for('EnrollmentRepo'),
  ItemRepo: Symbol.for('ItemRepo'),
};

export {TYPES as USERS_TYPES};

export interface EnrollmentStats {
  totalEnrollments: number;
  completedCount: number;
  averageProgressPercent: number;
  averageWatchHoursPerUser: number; // average hours watched per enrolled user
  // When averageWatchHoursPerUser was last recomputed. Null means the stats
  // job has not reached this course version yet, so the figure beside it is a
  // placeholder rather than a measurement.
  watchHoursComputedAt?: Date | null;
}
