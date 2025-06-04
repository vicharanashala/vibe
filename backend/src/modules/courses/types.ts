import {CourseVersion, Module} from './classes/transformers';

const TYPES = {
  //Services
  CourseService: Symbol.for('CourseService'),
  CourseVersionService: Symbol.for('CourseVersionService'),
  ModuleService: Symbol.for('ModuleService'),
  SectionService: Symbol.for('SectionService'),
  ItemService: Symbol.for('ItemService'),

  //Repositories
  CourseRepo: Symbol.for('CourseRepo'),
  ItemRepo: Symbol.for('ItemRepo'),
};

export default TYPES;
