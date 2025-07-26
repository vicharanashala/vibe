export interface flagInfo {
    courseId: string;
    versionId: string | null;
    moduleId: string | null;
    sectionId: string | null;
    itemId: string | null;
    watchItemId: string | null;
}

export interface FlagState {
    currentCourseFlag: flagInfo | null;
    setCurrentCourseFlag: (courseInfo: flagInfo) => void;
    setWatchItemId: (watchItemId: string) => void;
    clearCurrentCourseFlag: () => void;
}


import { components } from "./schema";

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
    courseId?: string | components['schemas']['CourseDataResponse'];
    versionId?: string ;
    entityId?: string ;
    entityType?: EntityType;
    reportedBy?: string | components['schemas']['UserByFirebaseUIDResponse'];
    reason?: string;
    status?: IStatus[];
    createdAt?: Date;
    updatedAt?: Date;
}
