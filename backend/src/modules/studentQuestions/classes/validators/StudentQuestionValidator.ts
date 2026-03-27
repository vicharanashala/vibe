import {JSONSchema} from 'class-validator-jsonschema';
import {Type} from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StudentQuestionPathParams {
  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({example: '65b7c8c8c8c8c8c8c8c8c8c8'})
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({example: '65b7c8c8c8c8c8c8c8c8c8c9'})
  courseVersionId: string;

  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({example: '65b7c8c8c8c8c8c8c8c8c8ca'})
  segmentId: string;
}

export class StudentQuestionStatusPathParams extends StudentQuestionPathParams {
  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({example: '65b7c8c8c8c8c8c8c8c8c8cb'})
  questionId: string;
}

export class CreateStudentQuestionBody {
  @IsNotEmpty()
  @IsString()
  @Length(10, 300)
  @JSONSchema({
    description: 'Student submitted question text',
    minLength: 10,
    maxLength: 300,
    example: 'Can someone explain why binary search needs sorted input?',
  })
  questionText: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['SELECT_ONE_IN_LOT'])
  @JSONSchema({example: 'SELECT_ONE_IN_LOT'})
  questionType: 'SELECT_ONE_IN_LOT';

  @IsOptional()
  @IsString()
  @MaxLength(400000)
  @JSONSchema({
    description: 'Optional question image as URL or data URL',
    example: 'https://example.com/question-image.png',
  })
  questionImageUrl?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({each: true})
  @Type(() => StudentQuestionOptionBody)
  options: StudentQuestionOptionBody[];

  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  @Min(0)
  correctOptionIndex: number;
}

export class StudentQuestionOptionBody {
  @IsNotEmpty()
  @IsString()
  @Length(1, 150)
  @JSONSchema({example: 'Sorted arrays'})
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(400000)
  @JSONSchema({
    description: 'Optional option image as URL or data URL',
    example: 'https://example.com/option-a.png',
  })
  imageUrl?: string;
}

export class StudentQuestionCreateResponse {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({example: '65b7c8c8c8c8c8c8c8c8c8cb'})
  questionId: string;
}

export class UpdateStudentQuestionStatusBody {
  @IsNotEmpty()
  @IsString()
  @IsIn(['UNVERIFIED', 'TO_BE_VALIDATED', 'VALIDATED', 'REJECTED'])
  @JSONSchema({example: 'VALIDATED'})
  status: 'UNVERIFIED' | 'TO_BE_VALIDATED' | 'VALIDATED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @Length(3, 500)
  @JSONSchema({example: 'Question is conceptually incorrect for this segment.'})
  reason?: string;
}

export class StudentQuestionListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class StudentQuestionListItem {
  @IsString()
  @IsNotEmpty()
  _id: string;

  @IsString()
  @IsNotEmpty()
  questionType: string;

  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsOptional()
  @IsString()
  questionImageUrl?: string;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => StudentQuestionOptionItem)
  options: StudentQuestionOptionItem[];

  @IsInt()
  correctOptionIndex: number;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @IsString()
  @IsNotEmpty()
  createdAt: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @IsOptional()
  @IsString()
  reviewedAt?: string;
}

export class StudentQuestionListResponse {
  items: StudentQuestionListItem[];
}

export class StudentQuestionOptionItem {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
