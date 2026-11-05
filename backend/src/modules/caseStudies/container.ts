import {ContainerModule} from 'inversify';
import {CASE_STUDIES_TYPES} from './types.js';
import {CaseStudyService} from './services/CaseStudyService.js';
import {CaseStudyController} from './controllers/CaseStudyController.js';
import {CaseStudyRepository} from './repositories/providers/mongodb/CaseStudyRepository.js';

export const caseStudiesContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(CaseStudyRepository).toSelf().inSingletonScope();
  options.bind(CASE_STUDIES_TYPES.CaseStudyRepo).to(CaseStudyRepository);

  // Service
  options.bind(CaseStudyService).toSelf().inSingletonScope();
  options.bind(CASE_STUDIES_TYPES.CaseStudyService).to(CaseStudyService);

  // Controller
  options.bind(CaseStudyController).toSelf().inSingletonScope();
});
