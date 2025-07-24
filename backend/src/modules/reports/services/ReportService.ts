import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject} from 'inversify';
import {REPORT_TYPES} from '../types.js';

class ReportService extends BaseService {
  constructor(
    // @inject(REPORT_TYPES.ReportRepo)
    // private readonly courseRepo: ,
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }
}

export {ReportService};
