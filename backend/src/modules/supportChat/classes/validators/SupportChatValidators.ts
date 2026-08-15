import {Type} from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
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
import {FAQCategory, FAQSource} from '../../types.js';

const RESOLUTION_RATINGS = ['helpful', 'not_helpful'] as const;
type ResolutionRatingLiteral = (typeof RESOLUTION_RATINGS)[number];

const QUESTION_STATUSES = [
  'PENDING',
  'ANSWERED',
  'RESOLVED',
  'ESCALATED',
] as const;
type QuestionStatusLiteral = (typeof QUESTION_STATUSES)[number];

/**
 * Every @QueryParams()/@Body() parameter in this module must be typed with one
 * of these classes rather than an inline object literal. Inline literals reflect
 * as bare `Object`, which makes routing-controllers-openapi's getQueryParams()
 * throw `Cannot read properties of undefined (reading 'split')` at spec
 * generation time and takes down app startup (see commit 89646cbe3).
 */

export class SupportChatContextDto {
  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Path the learner was on when they asked the question.',
    example: '/student/courses/123/items/456',
  })
  page?: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description: 'Item the learner was viewing, when the question came from an item page.',
  })
  itemId?: string;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Module name the learner was in.',
  })
  module?: string;
}

export class ChatMessageBody {
  @IsString()
  @IsNotEmpty()
  @Length(3, 1000)
  @JSONSchema({
    description: 'The learner question (3-1000 characters).',
    example: 'Why does my proctoring check keep failing?',
  })
  question!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SupportChatContextDto)
  @JSONSchema({
    description: 'Where in the app the question was asked from.',
  })
  context?: SupportChatContextDto;
}

export class ChatMessageQuery {
  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Course the question relates to.'})
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Course version the question relates to.'})
  courseVersionId?: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Cohort the learner belongs to.'})
  cohortId?: string;
}

export class ChatHistoryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @JSONSchema({
    description: 'Maximum number of past questions to return (1-200).',
    default: 50,
  })
  limit?: number;
}

export class SupportQuestionPathParams {
  @IsMongoId()
  @JSONSchema({description: 'Support question id.'})
  questionId!: string;
}

export class RateQuestionBody {
  @IsIn([...RESOLUTION_RATINGS])
  @JSONSchema({
    description: 'Whether the answer resolved the learner question.',
    enum: [...RESOLUTION_RATINGS],
  })
  rating!: ResolutionRatingLiteral;
}

export class EscalateQuestionBody {
  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'What kind of issue the learner is reporting.',
    enum: Object.values(FAQCategory),
  })
  category!: FAQCategory;

  @IsString()
  @IsNotEmpty()
  @Length(10, 2000)
  @JSONSchema({
    description: 'What went wrong, in the learner own words (10-2000 characters).',
    example: 'The video player stops at 3:12 and the page freezes on Chrome.',
  })
  details!: string;

  @IsOptional()
  @IsEmail()
  @JSONSchema({
    description: 'Where to reach the learner, when it differs from their account email.',
  })
  contactEmail?: string;
}

export class FAQSearchQuery {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @JSONSchema({description: 'Free-text search over FAQ questions and answers.'})
  search?: string;

  @IsOptional()
  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'Restrict results to a single FAQ category.',
    enum: Object.values(FAQCategory),
  })
  category?: FAQCategory;
}

export class AdminDashboardQuery {
  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Restrict dashboard stats to a single course.'})
  courseId?: string;

  @IsOptional()
  @IsDateString()
  @JSONSchema({
    description: 'Start of the reporting window (ISO 8601).',
    example: '2026-08-01T00:00:00.000Z',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @JSONSchema({
    description: 'End of the reporting window (ISO 8601).',
    example: '2026-08-14T00:00:00.000Z',
  })
  endDate?: string;
}

export class AdminQuestionsQuery {
  @IsOptional()
  @IsIn([...QUESTION_STATUSES])
  @JSONSchema({
    description: 'Filter questions by status.',
    enum: [...QUESTION_STATUSES],
  })
  status?: QuestionStatusLiteral;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @JSONSchema({description: '1-indexed page number.', default: 1})
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @JSONSchema({description: 'Page size (1-200).', default: 50})
  limit?: number;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Restrict results to a single course.'})
  courseId?: string;
}

export class AdminResponseBody {
  @IsString()
  @IsNotEmpty()
  @Length(10, 5000)
  @JSONSchema({
    description: 'The admin answer sent back to the learner (10-5000 characters).',
  })
  response!: string;

  @IsOptional()
  @IsBoolean()
  @JSONSchema({
    description: 'Promote this answer into the FAQ bank as well.',
    default: false,
  })
  createFaq?: boolean;

  @IsOptional()
  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'Category for the FAQ created from this response.',
    enum: Object.values(FAQCategory),
  })
  faqCategory?: FAQCategory;

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  @JSONSchema({description: 'Tags for the FAQ created from this response.'})
  faqTags?: string[];
}

export class FAQPathParams {
  @IsMongoId()
  @JSONSchema({description: 'FAQ id.'})
  faqId!: string;
}

export class AdminFAQListQuery {
  @IsOptional()
  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'Restrict results to a single FAQ category.',
    enum: Object.values(FAQCategory),
  })
  category?: FAQCategory;
}

export class CreateFAQBody {
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  @JSONSchema({description: 'The FAQ question (3-500 characters).'})
  question!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 5000)
  @JSONSchema({description: 'The FAQ answer (3-5000 characters).'})
  answer!: string;

  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'FAQ category.',
    enum: Object.values(FAQCategory),
  })
  category!: FAQCategory;

  @IsArray()
  @IsString({each: true})
  @JSONSchema({description: 'Tags used to help retrieval.'})
  tags!: string[];

  @IsOptional()
  @IsBoolean()
  @JSONSchema({description: 'Whether the FAQ is eligible for retrieval.', default: true})
  isActive?: boolean;

  @IsOptional()
  @IsEnum(FAQSource)
  @JSONSchema({
    description: 'How this FAQ came to exist.',
    enum: Object.values(FAQSource),
  })
  source?: FAQSource;
}

export class UpdateFAQBody {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  @JSONSchema({description: 'The FAQ question (3-500 characters).'})
  question?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(3, 5000)
  @JSONSchema({description: 'The FAQ answer (3-5000 characters).'})
  answer?: string;

  @IsOptional()
  @IsEnum(FAQCategory)
  @JSONSchema({
    description: 'FAQ category.',
    enum: Object.values(FAQCategory),
  })
  category?: FAQCategory;

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  @JSONSchema({description: 'Tags used to help retrieval.'})
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @JSONSchema({description: 'Whether the FAQ is eligible for retrieval.'})
  isActive?: boolean;
}
