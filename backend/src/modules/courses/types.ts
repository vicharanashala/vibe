const TYPES = {
  //Services
  CourseService: Symbol.for('CourseService'),
  CourseVersionService: Symbol.for('CourseVersionService'),
  ModuleService: Symbol.for('ModuleService'),
  SectionService: Symbol.for('SectionService'),
  ItemService: Symbol.for('ItemService'),
  CourseTransferService: Symbol.for('CourseTransferService'),
  DeleteCronService: Symbol.for('DeleteCronService'),

  //Repositories
  ItemRepo: Symbol.for('ItemRepo'),
};

export {TYPES as COURSES_TYPES};
