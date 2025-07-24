import { ObjectId } from 'mongodb';

type EntityType =
    | 'QUIZ'
    | 'VIDEO'
    | 'ARTICLE'
    | 'QUESTION';


interface IStatus {
    status: string;
    comment: string;
    createdAt: Date;
}

interface IReport {
    _id?: string | ObjectId;
    courseId: string | ObjectId;
    courseVersionId: string | ObjectId;
    entityId: string | ObjectId;
    entityType: EntityType;
    reportedBy: string | ObjectId;
    status: IStatus[];
    createdAt: Date;
    updatedAt: Date;
}



export {
    IReport, EntityType, IStatus
};
