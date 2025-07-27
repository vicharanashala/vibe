export enum ReportStatusEnum {
  REPORTED = 'REPORTED',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  DISCARDED = 'DISCARDED',
  CLOSED = 'CLOSED',
}
export const REPORT_STATUS_VALUES: string[] = Object.values(ReportStatusEnum);

export enum EntityTypeEnum {
  QUIZ = 'QUIZ',
  VIDEO = 'VIDEO',
  ARTICLE = 'ARTICLE',
  QUESTION = 'QUESTION',
}
export const ENTITY_TYPE_VALUES = Object.values(EntityTypeEnum);

export enum ReportPermissionSubject  {
  REPORT = 'Report'
}