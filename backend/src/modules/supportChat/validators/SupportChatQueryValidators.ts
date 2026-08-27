import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

// Real classes (not inline object types) for every `@QueryParams()`/`@Params()`
// route in this module — routing-controllers-openapi builds a JSON-schema
// $ref from class-validator metadata, and crashes generating the spec for a
// plain TS object-literal type (there is no metadata to reflect on).

export class SupportQuestionIdParams {
  @JSONSchema({ description: 'Unique identifier for the support question', type: 'string' })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
}

export class FAQIdParams {
  @JSONSchema({ description: 'Unique identifier for the FAQ', type: 'string' })
  @IsMongoId()
  @IsNotEmpty()
  faqId: string;
}

export class AdminDashboardQuery {
  @JSONSchema({ description: 'Restrict stats to one course', type: 'string' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @JSONSchema({ description: 'ISO date lower bound', type: 'string' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @JSONSchema({ description: 'ISO date upper bound', type: 'string' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class AdminQuestionsQuery {
  @JSONSchema({ description: 'Filter by question status', type: 'string' })
  @IsOptional()
  @IsString()
  status?: string;

  @JSONSchema({ description: 'Page number (unused by the current implementation)', type: 'string' })
  @IsOptional()
  @IsString()
  page?: string;

  @JSONSchema({ description: 'Max number of questions to return', type: 'string' })
  @IsOptional()
  @IsString()
  limit?: string;

  @JSONSchema({ description: 'Restrict to one course', type: 'string' })
  @IsOptional()
  @IsString()
  courseId?: string;
}

export class AdminFAQsQuery {
  @JSONSchema({ description: 'Filter by FAQ category', type: 'string' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class ChatSendMessageQuery {
  @JSONSchema({ description: 'Course the question was asked from', type: 'string' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @JSONSchema({ description: 'Course version the question was asked from', type: 'string' })
  @IsOptional()
  @IsString()
  courseVersionId?: string;

  @JSONSchema({ description: 'Cohort the question was asked from', type: 'string' })
  @IsOptional()
  @IsString()
  cohortId?: string;
}

export class ChatHistoryQuery {
  @JSONSchema({ description: 'Max number of questions to return', type: 'string' })
  @IsOptional()
  @IsString()
  limit?: string;
}

export class ChatFAQSearchQuery {
  @JSONSchema({ description: 'Free-text search term', type: 'string' })
  @IsOptional()
  @IsString()
  search?: string;

  @JSONSchema({ description: 'Filter by FAQ category', type: 'string' })
  @IsOptional()
  @IsString()
  category?: string;
}
