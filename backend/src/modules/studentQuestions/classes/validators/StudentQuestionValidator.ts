import {Type} from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

const QUESTION_TYPES = ['SELECT_ONE_IN_LOT'] as const;
type QuestionTypeLiteral = (typeof QUESTION_TYPES)[number];
const STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type StatusLiteral = (typeof STATUS_VALUES)[number];

export class StudentQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  @JSONSchema({
    description: 'Text content of the MCQ option (1-150 characters).',
    example: 'It allows us to repeatedly halve the search space.',
  })
  text!: string;
}

export class CreateStudentQuestionBody {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Question type. Only SELECT_ONE_IN_LOT (single-answer MCQ) is supported in v1.',
    enum: [...QUESTION_TYPES],
    default: 'SELECT_ONE_IN_LOT',
  })
  questionType!: QuestionTypeLiteral;

  @IsString()
  @IsNotEmpty()
  @Length(10, 300)
  @JSONSchema({
    description: 'The MCQ prompt (10-300 characters after trimming).',
    example: 'Why must the input be sorted for binary search to work?',
  })
  questionText!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({each: true})
  @Type(() => StudentQuestionOptionDto)
  @JSONSchema({
    description: 'Between 2 and 8 answer options.',
  })
  options!: StudentQuestionOptionDto[];

  @IsInt()
  @Min(0)
  @Max(7)
  @JSONSchema({
    description: 'Zero-based index of the correct option in the options array.',
    example: 0,
  })
  correctOptionIndex!: number;
}

export class StudentQuestionPathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  courseVersionId!: string;

  @IsMongoId()
  segmentId!: string;
}

export class StudentQuestionStatusPathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  courseVersionId!: string;

  @IsMongoId()
  segmentId!: string;

  @IsMongoId()
  questionId!: string;
}

export class StudentQuestionListQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class UpdateStudentQuestionStatusBody {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    enum: [...STATUS_VALUES],
    description: 'Target status. REJECTED requires a non-empty `reason`.',
  })
  status!: StatusLiteral;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  @JSONSchema({
    description: 'Required when status is REJECTED. 3-500 characters.',
  })
  reason?: string;
}

export class StudentQuestionCreateResponse {
  @IsString()
  questionId!: string;
}

export class StudentQuestionListItemResponse {
  @IsString()
  _id!: string;

  @IsString()
  questionText!: string;

  @IsArray()
  options!: {text: string}[];

  @IsInt()
  correctOptionIndex!: number;

  @IsString()
  status!: StatusLiteral;

  @IsString()
  source!: string;

  @IsString()
  createdBy!: string;

  @IsString()
  createdAt!: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @IsOptional()
  @IsString()
  reviewedAt?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class StudentQuestionListResponse {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => StudentQuestionListItemResponse)
  items!: StudentQuestionListItemResponse[];
}
