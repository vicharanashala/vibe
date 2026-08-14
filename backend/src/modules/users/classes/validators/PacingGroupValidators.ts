import { IsISO8601, IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsMongoId, ArrayMinSize } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';

export class CourseSelectionEntry {
  @JSONSchema({ description: 'Course ID', type: 'string' })
  @IsMongoId()
  courseId!: string;

  @JSONSchema({ description: 'Course version ID', type: 'string' })
  @IsMongoId()
  courseVersionId!: string;

  @JSONSchema({ description: 'Cohort ID', type: 'string' })
  @IsOptional()
  @IsMongoId()
  cohortId?: string;
}

export class SetCombinedPacingTargetBody {
  @JSONSchema({ description: 'Target completion date in ISO8601 format', type: 'string' })
  @IsISO8601()
  targetCompletionDate!: string;

  @JSONSchema({ description: 'Course selections', type: 'array', items: { $ref: '#/components/schemas/CourseSelectionEntry' } })
  @IsArray()
  @ArrayMinSize(1, { message: 'select at least one course' })
  @ValidateNested({ each: true })
  @Type(() => CourseSelectionEntry)
  courseSelections!: CourseSelectionEntry[];
}

export class CombinedPacingCourseEntry {
  @JSONSchema({ description: 'Course ID', type: 'string' })
  @IsString()
  courseId!: string;

  @JSONSchema({ description: 'Course version ID', type: 'string' })
  @IsString()
  courseVersionId!: string;

  @JSONSchema({ description: 'Course name', type: 'string' })
  @IsString()
  courseName!: string;

  @JSONSchema({ description: 'Items remaining', type: 'number' })
  @IsNumber()
  itemsRemaining!: number;

  @JSONSchema({ description: 'Effort minutes remaining', type: 'number' })
  @IsNumber()
  effortMinutesRemaining!: number;

  @JSONSchema({ description: 'Share of total remaining work', type: 'number' })
  @IsNumber()
  shareOfTotal!: number;
}

export class CombinedPacingPlanResponse {
  @JSONSchema({ description: 'Has selection', type: 'boolean' })
  @IsBoolean()
  hasSelection!: boolean;

  @JSONSchema({ description: 'Target completion date', type: ['string', 'null'], format: 'date-time' })
  @IsOptional()
  @IsString()
  targetCompletionDate!: string | null;

  @JSONSchema({ description: 'Days left', type: 'number' })
  @IsNumber()
  daysLeft!: number;

  @JSONSchema({ description: 'Total effort minutes remaining', type: 'number' })
  @IsNumber()
  totalEffortMinutesRemaining!: number;

  @JSONSchema({ description: 'Required minutes per day', type: 'number' })
  @IsNumber()
  requiredMinutesPerDay!: number;

  @JSONSchema({ description: 'Pace status', enum: ['ahead', 'on_track', 'behind', 'no_data'] })
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

  @JSONSchema({ description: 'Course breakdown entries', type: 'array', items: { $ref: '#/components/schemas/CombinedPacingCourseEntry' } })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombinedPacingCourseEntry)
  courses!: CombinedPacingCourseEntry[];
}

export const PACING_GROUP_VALIDATORS = [
  CourseSelectionEntry,
  SetCombinedPacingTargetBody,
  CombinedPacingCourseEntry,
  CombinedPacingPlanResponse,
];

