
export type EntityType =
    | 'QUIZ'
    | 'VIDEO'
    | 'ARTICLE'
    | 'QUESTION';

export enum ReportEntityEntity {
  VIDEO = 'VIDEO',
  QUIZ = 'QUIZ',
  ARTICLE= "ARTICLE",
  QUESTION="QUESTION"
}
export type ReportStatus = 'REPORTED' | 'IN_REVIEW' | 'RESOLVED' | 'DISCARDED' | 'CLOSED';

export interface IStatus {
 status: ReportStatus;
 comment: string;
}

export interface IReport {
    _id?: string ;
    courseId?: string ;
    versionId?: string ;
    entityId?: string ;
    entityType?: EntityType;
    reportedBy?: string ;
    reason?: string;
    status?: IStatus[];
    createdAt?: Date;
    updatedAt?: Date;
}
