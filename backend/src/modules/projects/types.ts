const TYPES = {
  // Controllers
  ProjectController: Symbol.for('ProjectController'),

  // Services
  ProjectService: Symbol.for('ProjectService'),

  // Repositories
  ProjectRespository: Symbol.for('ProjectRespository'),
  projectSubmissionRepository: Symbol.for('projectSubmissionRepository'),
};

export {TYPES as PROJECTS_TYPES};
