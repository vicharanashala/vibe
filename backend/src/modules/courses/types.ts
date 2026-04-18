const TYPES = {
  //Services
  CourseService: Symbol.for('CourseService'),
  CourseVersionService: Symbol.for('CourseVersionService'),
  ModuleService: Symbol.for('ModuleService'),
  SectionService: Symbol.for('SectionService'),
  ItemService: Symbol.for('ItemService'),

  //Repositories
  ItemRepo: Symbol.for('ItemRepo'),
};

export {TYPES as COURSES_TYPES};
