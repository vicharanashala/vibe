import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsPositive,
} from 'class-validator';
import {Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';

// ─── Rubric DTOs ──────────────────────────────────────────────────────────

/**
 * Criterion DTO used inside CreateRubricBody.
 * There is no `id` field — criterion IDs are always generated server-side.
 */
export class CreateCriterionDto {
  @IsNotEmpty({message: 'Criterion name is required'})
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @JSONSchema({description: 'Maximum points for this criterion (must be > 0)'})
  @IsNumber({}, {message: 'maxPoints must be a number'})
  @IsPositive({message: 'maxPoints must be greater than 0'})
  maxPoints!: number;
}

export class CreateRubricBody {
  @IsNotEmpty({message: 'Rubric title is required'})
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray({message: 'criteria must be an array'})
  @ValidateNested({each: true})
  @Type(() => CreateCriterionDto)
  criteria!: CreateCriterionDto[];
}

/**
 * Criterion DTO for PATCH rubric updates.
 * `id` is REQUIRED here — the client must echo back the server-generated criterion IDs.
 * This prevents silent criterion-ID drift between create and update.
 */
export class UpdateCriterionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty({message: 'Criterion name is required'})
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({}, {message: 'maxPoints must be a number'})
  @IsPositive({message: 'maxPoints must be greater than 0'})
  maxPoints!: number;
}

export class UpdateRubricBody {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray({message: 'criteria must be an array'})
  @ValidateNested({each: true})
  @Type(() => UpdateCriterionDto)
  criteria?: UpdateCriterionDto[];
}

export class CourseVersionRubricParams {
  @IsNotEmpty()
  @IsString()
  courseId!: string;

  @IsNotEmpty()
  @IsString()
  versionId!: string;
}

export class RubricIdParam {
  @IsNotEmpty()
  @IsString()
  rubricId!: string;
}

export class CriterionResponseDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  maxPoints!: number;
}

export class RubricResponse {
  @IsString()
  id!: string;

  @IsString()
  courseId!: string;

  @IsString()
  courseVersionId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  criteria!: CriterionResponseDto[];

  /**
   * Number of assessments that reference this rubric.
   * > 0 means the rubric is locked — it cannot be edited or deleted.
   */
  @IsNumber()
  assessmentCount!: number;
}

// ─── Assessment DTOs ──────────────────────────────────────────────────────

export class AssessmentCriterionDto {
  @IsNotEmpty({message: 'criterionId is required'})
  @IsString()
  criterionId!: string;

  @IsNumber({}, {message: 'points must be a number'})
  @Min(0, {message: 'points cannot be negative'})
  points!: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class SaveAssessmentBody {
  @IsNotEmpty({message: 'rubricId is required'})
  @IsString()
  rubricId!: string;

  @IsArray({message: 'criteria must be an array'})
  @ValidateNested({each: true})
  @Type(() => AssessmentCriterionDto)
  criteria!: AssessmentCriterionDto[];

  @IsOptional()
  @IsString()
  overallFeedback?: string;
}

export class SubmissionIdAssessmentParam {
  @IsNotEmpty()
  @IsString()
  submissionId!: string;
}

export class AssessmentCriterionResponseDto {
  @IsString()
  criterionId!: string;

  @IsNumber()
  points!: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class AssessmentResponse {
  @IsString()
  id!: string;

  @IsString()
  submissionId!: string;

  @IsString()
  rubricId!: string;

  @IsString()
  assessedBy!: string;

  @IsArray()
  criteria!: AssessmentCriterionResponseDto[];

  @IsNumber()
  totalPoints!: number;

  @IsNumber()
  maxPoints!: number;

  @IsNumber()
  percentage!: number;

  @IsOptional()
  @IsString()
  overallFeedback?: string;

  assessedAt!: Date;

  @IsOptional()
  updatedAt?: Date;
}

// ─── My Submission ────────────────────────────────────────────────────────

export class MySubmissionParams {
  @IsNotEmpty()
  @IsString()
  projectId!: string;
}

export class MySubmissionResponse {
  @IsString()
  submissionId!: string;

  @IsString()
  submissionURL!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  assessment?: AssessmentResponse;
}

// ─── Exports ──────────────────────────────────────────────────────────────

export const RUBRIC_VALIDATORS = [
  CreateCriterionDto,
  CreateRubricBody,
  UpdateCriterionDto,
  UpdateRubricBody,
  CourseVersionRubricParams,
  RubricIdParam,
  CriterionResponseDto,
  RubricResponse,
  AssessmentCriterionDto,
  SaveAssessmentBody,
  SubmissionIdAssessmentParam,
  AssessmentCriterionResponseDto,
  AssessmentResponse,
  MySubmissionParams,
  MySubmissionResponse,
];
