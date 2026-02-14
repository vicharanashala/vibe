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
    createdBy?: string | ObjectId;
    createdAt?: Date;
    response?: string
}

interface IReport {
    _id?: string | ObjectId;
    courseId?: string | ObjectId;
    versionId?: string | ObjectId;
    entityId?: string | ObjectId;
    entityType?: EntityType;
    questionId?: string | ObjectId;
    reportedBy?: string | ObjectId;
    reason?: string;
    satisfied?: string;
    status?: IStatus[];
    createdAt?: Date;
    updatedAt?: Date;
    moduleName?: string;
    sectionName?: string;
    itemName?: string;
}


export {
    IReport, EntityType, IStatus, ReportStatus
};
