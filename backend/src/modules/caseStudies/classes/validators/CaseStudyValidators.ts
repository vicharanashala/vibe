import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ELEMENT_2A_MIN_WORDS} from '../../constants.js';

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
  @JSONSchema({description: 'Element 1a — what the participant thought going in (~1 sentence).'})
  beat1a!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({description: 'Element 1b — what challenged that position, or what gave most pause (~1 sentence).'})
  beat1b!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({description: 'Element 1c — where the participant ended up (~1 sentence).'})
  beat1c!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: `Element 2a — strongest case against where they landed (≥ ${ELEMENT_2A_MIN_WORDS} words, checked server-side). This is the only field shown to peer reviewers.`,
    example: 'The strongest counterargument is that students who are confused often need direct explanation first, and Socratic questioning can feel frustrating when the student genuinely does not know what they do not know.',
  })
  steelman!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({description: "Element 2b — one perspective from the room; stored but never shown to reviewers. 'Room broadly agreed with me' is a valid answer."})
  roomPerspective!: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({description: 'Element 3 — one concrete thing to change; must answer the cost named in the steelman.'})
  changeCommitment!: string;

  @IsOptional()
  @IsString()
  @JSONSchema({description: 'ISO date string (YYYY-MM-DD) from the Zoom session declaration gate. Stored verbatim, not validated.'})
  zoomSessionDate?: string;
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
    description: 'The item ID (video or article) that unlocks this case when completed. Cases without a linked item are always locked for students.',
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
