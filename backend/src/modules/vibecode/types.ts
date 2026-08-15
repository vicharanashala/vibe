const TYPES = {
  // Controllers
  CodeExecutionController: Symbol.for('CodeExecutionController'),

  // Services
  CodeExecutionService: Symbol.for('CodeExecutionService'),

  // Repositories
  CodingProblemRepo: Symbol.for('CodingProblemRepo'),
  CodingSubmissionRepo: Symbol.for('CodingSubmissionRepo'),
};

export { TYPES as VIBECODE_TYPES };
