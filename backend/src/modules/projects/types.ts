const TYPES = {
  // Controllers
  ProjectController: Symbol.for('ProjectController'),
  RubricController: Symbol.for('RubricController'),
  AssessmentController: Symbol.for('AssessmentController'),

  // Services
  ProjectService: Symbol.for('ProjectService'),
  RubricService: Symbol.for('RubricService'),
  AssessmentService: Symbol.for('AssessmentService'),

  // Repositories
  ProjectRespository: Symbol.for('ProjectRespository'),
  projectSubmissionRepository: Symbol.for('projectSubmissionRepository'),
  RubricRepository: Symbol.for('RubricRepository'),
  AssessmentRepository: Symbol.for('AssessmentRepository'),
};

export {TYPES as PROJECTS_TYPES};
