import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  IsDate,
  IsNumber,
  IsEnum,
} from 'class-validator';

export enum EjectionTriggerType {
  MANUAL = 'MANUAL',
  POLICY = 'POLICY',
  APPEAL = 'APPEAL',
}

export class EjectionHistoryQuery {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Filter by cohort ID'})
  cohortId?: string;

  @IsOptional()
  @IsEnum(EjectionTriggerType)
  @JSONSchema({description: 'Filter by trigger type (MANUAL or POLICY)'})
  triggerType?: EjectionTriggerType;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @JSONSchema({description: 'Filter by start date'})
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @JSONSchema({description: 'Filter by end date'})
  endDate?: Date;

  @IsOptional()
  @IsString()
  @JSONSchema({description: 'Search by student name or email'})
  search?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @JSONSchema({description: 'User timezone offset in minutes'})
  timezoneOffset?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @JSONSchema({description: 'Page number for pagination'})
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @JSONSchema({description: 'Number of items per page'})
  limit?: number = 10;
}

@Expose()
export class EjectionHistoryEntryResponse {
  @Expose()
  @Transform(({value}) => value?.toString())
  enrollmentId: string;

  @Expose()
  @Transform(({value}) => value?.toString())
  userId: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  @Transform(({value}) => value?.toString())
  cohortId?: string;

  @Expose()
  cohortName?: string;

  @Expose()
  type: string;

  @Expose()
  @IsDate()
  @Type(() => Date)
  ejectedAt: Date;

  @Expose()
  ejectionReason: string;

  @Expose()
  @Transform(({value}) => value?.toString())
  ejectedBy: string;

  @Expose()
  ejectedByName?: string;

  @Expose()
  @Transform(({value}) => value?.toString())
  policyId?: string;

  @Expose()
  policyName?: string;

  @Expose()
  triggerType: EjectionTriggerType;

  @Expose()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  reinstatedAt?: Date;

  @Expose()
  @Transform(({value}) => value?.toString())
  @IsOptional()
  reinstatedBy?: string;
}

@Expose()
export class EjectionHistoryResponse {
  @Expose()
  @Type(() => EjectionHistoryEntryResponse)
  history: EjectionHistoryEntryResponse[];

  @Expose()
  totalDocuments: number;

  @Expose()
  totalPages: number;
}
