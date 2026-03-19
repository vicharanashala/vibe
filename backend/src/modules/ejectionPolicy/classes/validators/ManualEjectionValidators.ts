import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  MinLength,
  MaxLength,
  IsDate,
} from 'class-validator';

// ─── Params ───────────────────────────────────────────────────────────────────

export class ManualEjectionParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Learner user ID to eject'})
  userId: string;
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export class ManualEjectionBody {
  @IsNotEmpty()
  @IsString()
  @MinLength(10, {message: 'Reason must be at least 10 characters'})
  @MaxLength(500, {message: 'Reason must not exceed 500 characters'})
  @JSONSchema({
    description:
      'Reason for ejection — required and will be shown to the learner',
    example: 'Student has been inactive for over 60 days despite two warnings.',
    minLength: 10,
    maxLength: 500,
  })
  reason: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description: 'Cohort ID if the enrollment is cohort-scoped',
    type: 'string',
  })
  cohortId?: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description:
      'Policy ID this ejection is based on (optional for manual ejection)',
    type: 'string',
  })
  policyId?: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

@Expose()
export class ManualEjectionResponse {
  @IsString()
  @Expose()
  @JSONSchema({description: 'Success message'})
  message: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Enrollment ID that was ejected'})
  enrollmentId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'User ID of the ejected learner'})
  userId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsString()
  @Expose()
  @JSONSchema({description: 'Reason provided for ejection'})
  reason: string;

  @IsDate()
  @Type(() => Date)
  @Expose()
  @JSONSchema({description: 'Timestamp of ejection'})
  ejectedAt: Date;
}
