import { Expose, Transform, Type } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { ObjectIdToString, StringToObjectId } from '#root/shared/index.js';
import { AuditAction, AuditCategory, InstructorAuditTrail, OutComeStatus } from '../../interfaces/IAuditTrails.js';
import { JSONSchema } from 'class-validator-jsonschema';

export class AuditTrails implements InstructorAuditTrail {

    @Expose()
    @JSONSchema({
        title: 'Audit Trail ID',
        description: 'Unique identifier for the audit trail',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
        type: 'string',
    })
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true }) // Convert ObjectId -> string when serializing
    @Transform(StringToObjectId.transformer, { toClassOnly: true }) // Convert string -> ObjectId when deserializing
    _id?: string | ObjectId;

    @Expose()
    @JSONSchema({
        title: "Category of the audit trail",
        description: "Category of the audit trail",
        example: "COURSE",
        type: "string",
    })
    category: AuditCategory;

    @Expose()
    @JSONSchema({
        title: "Action performed",
        description: "Action performed",
        example: "COURSE_CREATE",
        type: "string",
    })
    action: AuditAction;

    @Expose()
    @JSONSchema({
        title: "User ID of the actor",
        description: "User ID of the actor who performed the action",
        example: {"id": "60d5ec49b3f1c8e4a8f8b8c1", "name": "John Doe", "email": "john.doe@example.com"},
        type: "object",
    })
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true }) // Convert ObjectId -> string when serializing
    @Transform(StringToObjectId.transformer, { toClassOnly: true }) // Convert string -> ObjectId when deserializing
    actor: {
        id: string | ObjectId;
        name: string;
        email: string;
        role?: string;
    };

    @Expose()
    @JSONSchema({
        title: "Context of the audit trail",
        description: "Context of the audit trail with relevant identifiers",
        example: {
            courseId: "60d5ec49b3f1c8e4a8f8b8c1",
            moduleId: "60d5ec49b3f1c8e4a8f8b8c2",
            relatedIds: {
                submissionId: "60d5ec49b3f1c8e4a8f8b8c3"
            }
        },
        type: "object",
    })
    context: {
        courseId?: ObjectId;
        courseVersionId?: ObjectId;
        moduleId?: ObjectId;
        sectionId?: ObjectId;
        itemId?: ObjectId;
        quizId?: ObjectId;
        questionId?: ObjectId;
        questionBankId?: ObjectId;
        flagId?: ObjectId;
        enrollmentId?: ObjectId;
        registrationId?: ObjectId;
        inviteId?: ObjectId;
        announcementId?: ObjectId;
        relatedIds?: Record<string, ObjectId | string>;
    };

    @Expose()
    @JSONSchema({
        title: "Changes made",
        description: "Details of the changes made in the action",
        example: {
            before: {
                title: "Old Course Title"
            },
            after: {
                title: "New Course Title"
            }
        },
        type: "object",
    })
    changes: {
        before?: Record<string, any>;
        after?: Record<string, any>;
    }

    @Expose()
    @JSONSchema({
        title: "Outcome of the action",
        description: "Outcome of the action",
        example: {
            status: OutComeStatus.SUCCESS,
            errorCode: "500",
            errorMessage: "Unable to create audit logs for this action"
        },
        type: "object",
    })
    outcome: {
        status: OutComeStatus;
        errorCode?: string;
        errorMessage?: string;
    }

    @Expose()
    @Type(() => Date)
    @JSONSchema({
        title: "Creation timestamp",
        description: "Timestamp when the audit trail was created",
        example: "2023-10-05T14:48:00.000Z",
        type: "string",
        format: "date-time",
    })
    createdAt: Date;
    constructor(userId?: string) {
        this.category = AuditCategory.COURSE;
        this.action = AuditAction.COURSE_CREATE;
        this.actor = {
            id: userId,
            name: "",
            email: "",
            role: ""
        };
        this.context = {};
        this.changes = {};
        this.outcome = { status: OutComeStatus.PARTIAL };
        this.createdAt = new Date();
    }
}