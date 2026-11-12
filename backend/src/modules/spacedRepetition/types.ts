/**
 * Inversify DI token symbols for the spacedRepetition module.
 *
 * Follows the same pattern as QUIZZES_TYPES — one Symbol.for() entry
 * per injectable class. Import SPACED_REPETITION_TYPES wherever you
 * need to @inject() or .bind() something from this module.
 */
const TYPES = {
  // Repository
  ReviewItemRepo: Symbol.for('ReviewItemRepo'),
  StudentSRStatusRepo: Symbol.for('StudentSRStatusRepo'),

  // Service
  SpacedRepetitionService: Symbol.for('SpacedRepetitionService'),

  // Controller
  SpacedRepetitionController: Symbol.for('SpacedRepetitionController'),
};

export { TYPES as SPACED_REPETITION_TYPES };