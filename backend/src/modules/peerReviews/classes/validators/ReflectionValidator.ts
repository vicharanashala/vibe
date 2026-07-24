import {Type} from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  MAX_LIST_LIMIT,
  MAX_REFLECTION_LENGTH,
  MAX_SCORE,
  MIN_REFLECTION_LENGTH,
  MIN_SCORE,
} from '../../constants.js';

export class ReflectionItemPathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  courseVersionId!: string;

  /** The REFLECTION item itself — the unit a reflection and its peers hang off. */
  @IsMongoId()
  itemId!: string;
}

export class ReflectionIdPathParams {
  @IsMongoId()
  reflectionId!: string;
}

export class InstructorPathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  courseVersionId!: string;
}

export class CreateReflectionBody {
  @IsString()
  @IsNotEmpty()
  @Length(MIN_REFLECTION_LENGTH, MAX_REFLECTION_LENGTH)
  @JSONSchema({
    description:
      'What the student learned or inferred from this section, in their own words.',
    example:
      'Binary search only works on sorted input because each comparison discards a half...',
  })
  text!: string;

  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  @JSONSchema({
    description:
      'The student\'s own rating of how well they understood the section (1-10). Compared against the peer average to surface over- and under-confidence.',
    example: 7,
  })
  confidence!: number;
}

export class ReflectionScoresDto {
  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  @JSONSchema({description: 'Did the author grasp the concept? (1-10)'})
  understanding!: number;

  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  @JSONSchema({description: 'Surface summary versus genuine insight. (1-10)'})
  depth!: number;

  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  @JSONSchema({description: 'Readability and expression. (1-10)'})
  clarity!: number;
}

export class CreateReviewBody {
  @ValidateNested()
  @Type(() => ReflectionScoresDto)
  @JSONSchema({description: 'The three rubric criteria, each scored 1-10.'})
  scores!: ReflectionScoresDto;

  @IsBoolean()
  @JSONSchema({
    description:
      'Whether this reflection helped the reviewer understand the topic better. Tracked separately from the score so a rough but illuminating explanation can be recognised without inflating its grade.',
    example: true,
  })
  helpful!: boolean;
}

export class InstructorReflectionListQuery {
  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Narrow the listing to a single section.'})
  itemId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit?: number;
}

export class InstructorStatsQuery {
  @IsOptional()
  @IsMongoId()
  itemId?: string;
}
