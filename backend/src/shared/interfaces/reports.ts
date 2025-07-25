import { ObjectId } from 'mongodb';

type EntityType =
    | 'QUIZ'
    | 'VIDEO'
    | 'ARTICLE'
    | 'QUESTION';

type ReportStatus = 'REPORTED' | 'IN_REVIEW' | 'RESOLVED' | 'DISCARDED' | 'CLOSED';

interface IStatus {
    status: ReportStatus;
    comment: string;

}

interface IReport {
    _id?: string | ObjectId;
    courseId?: string | ObjectId;
    versionId?: string | ObjectId;
    entityId?: string | ObjectId;
    entityType?: EntityType;
    reportedBy?: string | ObjectId;
    reason?: string;
    status?: IStatus[];
    createdAt?: Date;
    updatedAt?: Date;
}


export {
    IReport, EntityType, IStatus, ReportStatus
};
