import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsMongoId,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { ID } from '#root/shared/interfaces/models.js';
import { EntityType, IReport, ReportStatus } from '#root/shared/index.js';
import { ENTITY_TYPE_VALUES, EntityTypeEnum, REPORT_STATUS_VALUES, ReportStatusEnum } from '../../constants.js';
import { ReportStatusEntry } from '../transformers/Report.js';



class ReportBody implements Partial<IReport>{

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course associated with the report',
    example: '64bfcaf6e13e3547e90c1234',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  courseId: ID;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version associated with the report',
    example: '64bfcaf6e13e3547e90c5678',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: ID;

  @JSONSchema({
    title: 'Entity ID',
    description: 'ID of the content being reported (e.g., quiz, video)',
    example: '64bfcb05e13e3547e90c8765',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  entityId: ID;

  @JSONSchema({
    title: 'Entity Type',
    description: 'Type of the reported entity',
    example: 'quiz',
    type: 'string',
    enum: ENTITY_TYPE_VALUES
  })
  @IsNotEmpty()
  @IsEnum(EntityTypeEnum)
  entityType: EntityType;

  @JSONSchema({
    title: 'Report Reason',
    description: 'Reason for submitting the report',
    example: 'Question is incorrect',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

class UpdateReportStatusBody {
  @JSONSchema({
    title: 'New Status',
    description: 'Updated status of the report',
    example: 'RESOLVED',
    type: 'string',
    enum: REPORT_STATUS_VALUES,
  })
  @IsNotEmpty()
  @IsEnum(ReportStatusEnum)
  status: ReportStatus;

  @JSONSchema({
    title: 'Status Change Comment',
    description: 'Reason/comment for changing the status',
    example: 'Report reviewed and resolved by moderator',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  comment: string;
}

class ReportIdParams {
  @JSONSchema({
    description: 'Object ID of the report',
    example: '64bfcd02e13e3547e90c9876',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  reportId: string;
}

// Filter query params for instructor dashboard
export class ReportFiltersQuery {
  @JSONSchema({
    description: 'Type of the reported entity (optional)',
    example: 'quiz',
    type: 'string',
    enum: ENTITY_TYPE_VALUES,
  })
  @IsOptional()
  @IsEnum(EntityTypeEnum)
  entityType?: EntityType;

  @JSONSchema({
    description: 'Status of the report (optional)',
    example: 'REPORTED',
    type: 'string',
    enum: REPORT_STATUS_VALUES,
  })
  @IsOptional()
  @IsEnum(ReportStatusEnum)
  status?: ReportStatus;

  @JSONSchema({
    description: 'Limit for pagination',
    example: 10,
    type: 'integer',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @JSONSchema({
    description: 'Offset for pagination',
    example: 0,
    type: 'integer',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

class ReportDataResponse implements IReport{
  @JSONSchema({ description: 'Report ID', type: 'string', readOnly: true })
  _id: ID;

  @JSONSchema({ description: 'Course ID', type: 'string' })
  courseId: ID;

  @JSONSchema({ description: 'Course Version ID', type: 'string' })
  courseVersionId: ID;

  @JSONSchema({ description: 'Reported Entity ID', type: 'string' })
  entityId: ID;

  @JSONSchema({
    description: 'Entity Type',
    enum: ENTITY_TYPE_VALUES,
    type: 'string',
  })
  entityType: EntityType;

  @JSONSchema({ description: 'User who reported', type: 'string' })
  reportedBy: ID;

  @JSONSchema({ description: 'Reason for the report', type: 'string' })
  reason: string;

  @ValidateNested({ each: true })
  @Type(() => ReportStatusEntry)
  @JSONSchema({
    title: 'Status History',
    description: 'List of status updates for the report',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: REPORT_STATUS_VALUES,
        },
        comment: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  status: ReportStatusEntry[];

  @JSONSchema({
    description: 'Created timestamp',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date;

  @JSONSchema({
    description: 'Updated timestamp',
    type: 'string',
    format: 'date-time',
  })
  updatedAt: Date;
}

class ReportNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example: 'No report found with the given ID.',
    type: 'string',
  })
  @IsNotEmpty()
  message: string;
}

export {
  ReportBody,
  UpdateReportStatusBody,
  ReportIdParams,
  ReportDataResponse,
  ReportNotFoundErrorResponse,
};

export const REPORT_VALIDATORS = [
  ReportBody,
  UpdateReportStatusBody,
  ReportFiltersQuery,
  ReportIdParams,
  ReportDataResponse,
  ReportNotFoundErrorResponse,
];
