import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PeerReviewLinkKind } from '#shared/interfaces/models.js';

/**
 * One student-submitted link. `kind` is optional in input (server
 * auto-detects from the URL host via urlKindDetector if missing).
 */
export class StudentLinkDto {
  @Expose()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  url!: string;

  @Expose()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @Expose()
  @IsOptional()
  @IsEnum([
    'drive',
    'github',
    'youtube',
    'oneDrive',
    'dropbox',
    'other',
  ])
  kind?: PeerReviewLinkKind;
}

/**
 * Body for POST /courses/:courseId/versions/:versionId/items/:itemId/submit
 *
 * Idempotency: keyed on (assessmentId, studentId). Re-submitting updates
 * the same row in place (PATCH semantics, no new doc).
 */
export class SubmitPeerReviewBody {
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentLinkDto)
  @ArrayMaxSize(20)
  links!: StudentLinkDto[];
}
