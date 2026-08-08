import { IsISO8601, IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';

export class SetPacingTargetBody {
  @JSONSchema({ description: 'Target completion date in ISO8601 format', type: 'string', nullable: true })
  @IsOptional()
  @IsISO8601()
  targetCompletionDate?: string;

  @JSONSchema({ description: 'Cohort ID', type: 'string' })
  @IsOptional()
  @IsString()
  cohortId?: string;
}

export class ModuleBreakdownEntry {
  @JSONSchema({ description: 'Module ID', type: 'string' })
  @IsString()
  moduleId!: string;

  @JSONSchema({ description: 'Module name', type: 'string' })
  @IsString()
  moduleName!: string;

  @JSONSchema({ description: 'Total items in module', type: 'number' })
  @IsNumber()
  totalItems!: number;

  @JSONSchema({ description: 'Completed items count', type: 'number' })
  @IsNumber()
  completedItems!: number;

  @JSONSchema({ description: 'Items remaining', type: 'number' })
  @IsNumber()
  itemsRemaining!: number;

  @JSONSchema({ description: 'Effort minutes remaining', type: 'number' })
  @IsNumber()
  effortMinutesRemaining!: number;

  @JSONSchema({ description: 'Suggested finish by date', type: ['string', 'null'], format: 'date-time' })
  @IsOptional()
  @IsString()
  suggestedFinishByDate!: string | null;
}

export class PacingPlanResponse {
  @JSONSchema({ description: 'Has target set', type: 'boolean' })
  @IsBoolean()
  hasTarget!: boolean;

  @JSONSchema({ description: 'Target completion date', type: ['string', 'null'], format: 'date-time' })
  @IsOptional()
  @IsString()
  targetCompletionDate!: string | null;

  @JSONSchema({ description: 'Items remaining', type: 'number' })
  @IsNumber()
  itemsRemaining!: number;

  @JSONSchema({ description: 'Effort minutes remaining', type: 'number' })
  @IsNumber()
  effortMinutesRemaining!: number;

  @JSONSchema({ description: 'Days left', type: 'number' })
  @IsNumber()
  daysLeft!: number;

  @JSONSchema({ description: 'Items per day', type: 'number' })
  @IsNumber()
  itemsPerDay!: number;

  @JSONSchema({ description: 'Required minutes per day', type: 'number' })
  @IsNumber()
  requiredMinutesPerDay!: number;

  @JSONSchema({ description: 'Is overdue', type: 'boolean' })
  @IsBoolean()
  isOverdue!: boolean;

  @JSONSchema({ description: "Pace status", enum: ['ahead', 'on_track', 'behind', 'no_data'] })
  @IsString()
  paceStatus!: 'ahead' | 'on_track' | 'behind' | 'no_data';

  @JSONSchema({ description: 'Ahead/Behind by days', type: ['number', 'null'] })
  @IsOptional()
  @IsNumber()
  aheadOrBehindByDays!: number | null;

  @JSONSchema({ description: 'Suggested catch-up date', type: ['string', 'null'], format: 'date-time' })
  @IsOptional()
  @IsString()
  suggestedCatchUpDate!: string | null;

  @JSONSchema({ description: 'Teacher deadline', type: ['string', 'null'], format: 'date-time' })
  @IsOptional()
  @IsString()
  teacherDeadline?: string | null;

  @JSONSchema({ description: 'Module breakdown entries', type: 'array', items: { $ref: '#/components/schemas/ModuleBreakdownEntry' } })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleBreakdownEntry)
  moduleBreakdown!: ModuleBreakdownEntry[];
}

export class StudentPacingSummary {
  @JSONSchema({ description: 'User ID', type: 'string' })
  @IsString()
  userId!: string;

  @JSONSchema({ description: 'User name', type: 'string' })
  @IsString()
  name!: string;

  @JSONSchema({ description: 'Has target set', type: 'boolean' })
  @IsBoolean()
  hasTarget!: boolean;

  @JSONSchema({ description: 'Pace status', type: ['string', 'null'], enum: ['ahead', 'on_track', 'behind', 'no_data', null] })
  @IsOptional()
  @IsString()
  paceStatus!: 'ahead' | 'on_track' | 'behind' | 'no_data' | null;

  @JSONSchema({ description: 'Ahead/Behind by days', type: ['number', 'null'] })
  @IsOptional()
  @IsNumber()
  aheadOrBehindByDays!: number | null;

  @JSONSchema({ description: 'Required minutes per day', type: ['number', 'null'] })
  @IsOptional()
  @IsNumber()
  requiredMinutesPerDay!: number | null;

  @JSONSchema({ description: 'Items remaining', type: 'number' })
  @IsNumber()
  itemsRemaining!: number;
}

export class CoursePacingOverviewResponse {
  @JSONSchema({ description: 'Total enrolled students', type: 'number' })
  @IsNumber()
  totalStudents!: number;

  @JSONSchema({ description: 'Ahead count', type: 'number' })
  @IsNumber()
  aheadCount!: number;

  @JSONSchema({ description: 'On track count', type: 'number' })
  @IsNumber()
  onTrackCount!: number;

  @JSONSchema({ description: 'Behind count', type: 'number' })
  @IsNumber()
  behindCount!: number;

  @JSONSchema({ description: 'No data count', type: 'number' })
  @IsNumber()
  noDataCount!: number;

  @JSONSchema({ description: 'No target set count', type: 'number' })
  @IsNumber()
  noTargetSetCount!: number;

  @JSONSchema({ description: 'Enrolled students pacing summary list', type: 'array', items: { $ref: '#/components/schemas/StudentPacingSummary' } })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentPacingSummary)
  students!: StudentPacingSummary[];
}

export const PACING_VALIDATORS = [
  SetPacingTargetBody,
  ModuleBreakdownEntry,
  PacingPlanResponse,
  StudentPacingSummary,
  CoursePacingOverviewResponse
];
