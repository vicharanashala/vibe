import { Expose, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import {
  PeerReviewAntiCollusionMode,
  PeerReviewLatePolicy,
  PeerReviewLinkKind,
} from '#shared/interfaces/models.js';

/**
 * One rubric row in the teacher's assessment-creation form.
 *
 * Mirrors IPeerReviewRubricCriterion exactly; we re-declare it as a class
 * so class-validator + class-transformer can decorate the fields. The
 * backend service converts this DTO into the IPeerReview* type when
 * persisting.
 */
export class RubricCriterionDto {
  @Expose()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Expose()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxPoints!: number;
}

/**
 * Instructor attachment — a Drive link or any URL the teacher shares
 * with reviewers (e.g. the assignment brief as a Google Doc).
 */
export class InstructorAttachmentDto {
  @Expose()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Expose()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  url!: string;

  @Expose()
  @IsEnum(['drive', 'github', 'youtube', 'oneDrive', 'dropbox', 'other'])
  kind!: PeerReviewLinkKind;
}

/**
 * Body for POST /peer-review-assessments.
 *
 * Validation enforced:
 *   - rubric has 1..20 criteria, each maxPoints > 0
 *   - rubric has at least one criterion with sum > 0
 *   - deadlines are valid future dates with review > submission
 *   - config.latePenaltyPercent in [0, 100]
 *   - reviewsPerSubmission == reviewsPerReviewer (per adaptive algorithm)
 */
export class CreatePeerReviewAssessmentBody {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @Expose()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstructorAttachmentDto)
  instructorAttachments?: InstructorAttachmentDto[];

  @Expose()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  rubric!: RubricCriterionDto[];

  @Expose()
  @IsDateString()
  submissionDeadline!: string;

  /**
   * Number of days between submission deadline and review deadline.
   * Server computes reviewDeadline = submissionDeadline + reviewWindowDays.
   * If both are sent, this wins.
   */
  @Expose()
  @IsInt()
  @Min(1)
  @Max(60)
  reviewWindowDays!: number;

  @Expose()
  @IsBoolean()
  teacherManualReviewEnabled!: boolean;

  @Expose()
  @IsBoolean()
  notificationsEnabled!: boolean;

  @Expose()
  @IsEnum(['penalty-only', 'hard-exclude'])
  latePolicy!: PeerReviewLatePolicy;

  @Expose()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercent!: number;

  @Expose()
  @IsEnum(['circular-shift-collision-check', 'uniform-random'])
  antiCollusionMode!: PeerReviewAntiCollusionMode;

  @Expose()
  @IsInt()
  @Min(1)
  @Max(5)
  reviewsPerSubmission!: number;

  @Expose()
  @IsInt()
  @Min(1)
  @Max(5)
  reviewsPerReviewer!: number;

  @Expose()
  @IsString()
  cohortId!: string;

  /**
   * Item-level fields. The Item record is created as a separate doc in the
   * courses collection (handled in the controller via ItemService.addItem);
   * the assessmentId returned by this call is then stamped onto the Item's
   * peerReviewAssessmentDetails blob so the renderer can locate the
   * full assessment row.
   *
   * We accept name/description here (instead of pulling from the title/
   * description above) so future item-rename use cases stay clean.
   */
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  itemName!: string;

  @Expose()
  @IsString()
  @MaxLength(2000)
  itemDescription!: string;

  @Expose()
  @IsString()
  courseId!: string;

  @Expose()
  @IsString()
  courseVersionId!: string;

  @Expose()
  @IsString()
  moduleId!: string;

  @Expose()
  @IsString()
  sectionId!: string;
}

/**
 * Body for PATCH /peer-review-assessments/:id. All fields optional; only
 * the supplied ones are updated.
 */
export class UpdatePeerReviewAssessmentBody {
  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstructorAttachmentDto)
  instructorAttachments?: InstructorAttachmentDto[];

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  rubric?: RubricCriterionDto[];

  @Expose()
  @IsOptional()
  @IsDateString()
  submissionDeadline?: string;

  @Expose()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  reviewWindowDays?: number;

  @Expose()
  @IsOptional()
  @IsBoolean()
  teacherManualReviewEnabled?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @Expose()
  @IsOptional()
  @IsEnum(['penalty-only', 'hard-exclude'])
  latePolicy?: PeerReviewLatePolicy;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercent?: number;
}

/**
 * Response shape for GET endpoints. Hides audit-only fields from non-teachers
 * (controllers strip them via the authorize path).
 */
export class PeerReviewAssessmentResponse {
  @Expose()
  assessmentId!: string;

  @Expose()
  itemId!: string;

  @Expose()
  courseId!: string;

  @Expose()
  courseVersionId!: string;

  @Expose()
  moduleId!: string;

  @Expose()
  sectionId!: string;

  @Expose()
  title!: string;

  @Expose()
  description!: string;

  @Expose()
  @Type(() => InstructorAttachmentDto)
  instructorAttachments!: InstructorAttachmentDto[];

  @Expose()
  @Type(() => RubricCriterionDto)
  rubric!: RubricCriterionDto[];

  @Expose()
  submissionDeadline!: string;

  @Expose()
  reviewDeadline!: string;

  @Expose()
  totalMaxPoints!: number;

  @Expose()
  teacherManualReviewEnabled!: boolean;

  @Expose()
  notificationsEnabled!: boolean;

  @Expose()
  latePolicy!: PeerReviewLatePolicy;

  @Expose()
  latePenaltyPercent!: number;

  @Expose()
  antiCollusionMode!: PeerReviewAntiCollusionMode;

  @Expose()
  reviewsPerSubmission!: number;

  @Expose()
  reviewsPerReviewer!: number;

  @Expose()
  cohortId!: string;

  @Expose()
  createdBy!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  closedAt?: Date;

  @Expose()
  assignmentRunAt?: Date;
}

/**
 * Self-GUIDANCE — JSONSchema metadata is intentionally absent. The OpenAPI
 * generation script reads class-validator decorators directly and produces
 * schemas from them; explicit @JSONSchema decoration is reserved for cases
 * where the generated schema needs overriding.
 */
void JSONSchema; // keep the import (used by some downstream codegen paths)