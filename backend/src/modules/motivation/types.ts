/**
 * Inversify DI token symbols for the motivation module.
 *
 * Added 2026-07-25: UserDirectoryRepo (for student-name resolution in
 * the leaderboard + mentor view; previously these endpoints used
 * `studentId` as the placeholder).
 *
 * Added 2026-07-25: OptOutRepo (for Pillar 3 public opt-out — high-
 * retention students can step off the leaderboard per course).
 */
const TYPES = {
  MotivationController: Symbol.for('MotivationController'),
  UserDirectoryRepo: Symbol.for('Motivation.UserDirectoryRepo'),
  OptOutRepo: Symbol.for('Motivation.OptOutRepo'),
};

export { TYPES as MOTIVATION_TYPES };
