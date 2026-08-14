import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {CASE_STUDY_RESPONSE_MAX_WORDS} from '../../constants.js';

export class CaseStudyCoursePathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  versionId!: string;
}

export class CaseStudyIdPathParams {
  @IsMongoId()
  caseStudyId!: string;
}

export class ComparisonIdPathParams {
  @IsMongoId()
  comparisonId!: string;
}

export class SubmitCaseResponseBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @JSONSchema({
    description: `The participant's response to the case study, capped at ${CASE_STUDY_RESPONSE_MAX_WORDS} words (checked server-side by Unicode-aware word count, not character count).`,
    example:
      'I would start by asking the student what specifically confused them...',
  })
  text!: string;
}

export class SubmitPickBody {
  @IsIn(['A', 'B', 'BOTH_WEAK', 'FLAGGED'])
  @JSONSchema({
    description:
      "The reviewer's forced-choice verdict. 'BOTH_WEAK' is a substantive " +
      "judgment ('neither response is strong') and counts toward the " +
      "reviewer's quota; 'FLAGGED' marks the pair as unjudgeable " +
      '(garbled/broken) and does not.',
    example: 'A',
  })
  outcome!: 'A' | 'B' | 'BOTH_WEAK' | 'FLAGGED';
}

export class CreateCaseStudyBody {
  @IsInt()
  @Min(1)
  @JSONSchema({description: 'Position in the write-unlock sequence, 1-indexed.'})
  sequenceIndex!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description:
      'Plain-prose case-study prompt. No answer/rubric field exists on ' +
      'this or any case-study document — cases are scored only by peer ' +
      'pairwise comparison.',
  })
  bodyMarkdown!: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description: 'The video item this case follows, if any. Informational only.',
  })
  linkedItemId?: string;
}

export class UpdateCaseStudyBody {
  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceIndex?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bodyMarkdown?: string;

  @IsOptional()
  @IsMongoId()
  linkedItemId?: string;
}
