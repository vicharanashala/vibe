import {
  EntityType,
  ID,
  IReport,
  IStatus,
  ObjectIdToString,
  ReportStatus,
  StringToObjectId,
} from '#root/shared/index.js';
import {Expose, Transform, Type} from 'class-transformer';
import {IsEnum, IsIn, IsString, ValidateNested} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  EntityTypeEnum,
  REPORT_STATUS_VALUES,
  ReportStatusEnum,
} from '../../constants.js';
import {
  ReportBody,
  UpdateReportStatusBody,
} from '../validators/ReportValidators.js';

class ReportStatusEntry implements IStatus {
  @Expose()
  @IsEnum(ReportStatusEnum)
  @JSONSchema({
    title: 'Status',
    description: 'Status of the report at a given point',
    example: ReportStatusEnum.REPORTED,
    type: 'string',
    enum: REPORT_STATUS_VALUES,
  })
  status: ReportStatus;

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'Comment',
    description: 'Comment or note for the status change',
    example: 'Report submitted for review',
    type: 'string',
  })
  comment: string;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Timestamp',
    description: 'Timestamp of the status change',
    example: '2025-07-24T11:22:00Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date;

  constructor(status: ReportStatus, comment: string) {
    this.status = status;
    this.comment = comment;
    this.createdAt = new Date();
  }
}

class Report implements IReport {
  @Expose()
  @JSONSchema({
    title: 'Report ID',
    description: 'Unique identifier for the report',
    example: '60d5ec49b3f1c8e4a8f8b8d1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Identifier of the course associated with the report',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Version ID',
    description: 'Identifier of the course version associated with the report',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  versionId: ID;

  @Expose()
  @JSONSchema({
    title: 'Entity ID',
    description:
      'Identifier of the entity being reported (e.g., quiz, video, article, question)',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  entityId: ID;

  @Expose()
  @JSONSchema({
    title: 'Entity Type',
    description: 'Type of the reported entity',
    example: EntityTypeEnum.QUIZ,
    type: 'string',
    enum: REPORT_STATUS_VALUES,
  })
  entityType: EntityType;

  @Expose()
  @JSONSchema({
    title: 'Reported By',
    description: 'Identifier of the user who submitted the report',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  reportedBy: ID;

  @Expose()
  @JSONSchema({
    title: 'Reason',
    description: 'Reason for the report',
    example: 'Inappropriate content in quiz question',
    type: 'string',
  })
  reason: string;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => ReportStatusEntry)
  @JSONSchema({
    title: 'Status History',
    description: 'Array of status entries tracking the report’s lifecycle',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: REPORT_STATUS_VALUES,
        },
        comment: {type: 'string'},
        timestamp: {type: 'string', format: 'date-time'},
      },
    },
  })
  status: ReportStatusEntry[];

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Created At',
    description: 'Timestamp when the report was created',
    example: '2025-07-24T10:44:00Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Updated At',
    description: 'Timestamp when the report was last updated',
    example: '2025-07-24T10:44:00Z',
    type: 'string',
    format: 'date-time',
  })
  updatedAt?: Date;

  constructor(
    reportBody: ReportBody | UpdateReportStatusBody,
    reportedBy?: ID,
  ) {
    if ('courseId' in reportBody) {
      this.courseId = reportBody.courseId;
      this.versionId = reportBody.courseVersionId;
      this.entityId = reportBody.entityId;
      this.entityType = reportBody.entityType;
      this.reason = reportBody.reason;
      this.reportedBy = reportedBy || ('' as ID);

      this.status = [
        new ReportStatusEntry(
          ReportStatusEnum.REPORTED,
          'Initial report created',
        ),
      ];
    } else {
      this.status = [
        new ReportStatusEntry(reportBody.status, reportBody.comment),
      ];
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  }
}

export {Report, ReportStatusEntry};
