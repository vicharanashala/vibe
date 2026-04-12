const TYPES = {
  //Services
  ReportService: Symbol.for('ReportService'),

  //Repositories
  ReportRepo: Symbol.for('ReportRepo'),
};

export type ReportSortColumn =
  | 'reason'
  | 'entityType'
  | 'latestStatus'
  | 'reportedBy.firstName'
  | 'createdAt';

  
export {TYPES as REPORT_TYPES};
