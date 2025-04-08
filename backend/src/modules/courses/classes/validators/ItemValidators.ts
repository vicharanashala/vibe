import 'reflect-metadata';
import {Type} from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  IsDecimal,
  IsPositive,
  IsDateString,
  IsEmpty,
  IsOptional,
  IsMongoId,
  IsEnum,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IVideoDetails,
  IQuizDetails,
  IBlogDetails,
  IBaseItem,
  ItemType,
} from 'shared/interfaces/IUser';

/**
 * @category Courses/Validators/ItemValidators
 */
class VideoDetailsPayloadValidator implements IVideoDetails {
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  URL: string;

  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  startTime: string;

  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  endTime: string;

  @IsNotEmpty()
  @IsDecimal()
  points: number;
}

/**
 * @category Courses/Validators/ItemValidators
 */
class QuizDetailsPayloadValidator implements IQuizDetails {
  @IsNotEmpty()
  @IsPositive()
  questionVisibility: number;

  @IsNotEmpty()
  @IsDateString()
  releaseTime: Date;

  @IsEmpty()
  questions: string[];

  @IsNotEmpty()
  @IsDateString()
  deadline: Date;
}

/**
 * @category Courses/Validators/ItemValidators
 */
class BlogDetailsPayloadValidator implements IBlogDetails {
  @IsEmpty()
  tags: string[];

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsDecimal()
  points: number;
}

/**
 * @category Courses/Validators/ItemValidators
 */
class CreateItemBody implements IBaseItem {
  @IsEmpty()
  _id?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEmpty()
  sectionId: string;

  @IsEmpty()
  order: string;

  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;

  @IsNotEmpty()
  @IsEnum(ItemType)
  type: ItemType;

  // Conditional validation based on type
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

/**
 * @category Courses/Validators/ItemValidators
 */
class UpdateItemBody implements IBaseItem {
  @IsEmpty()
  _id?: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsEmpty()
  sectionId: string;

  @IsEmpty()
  order: string;

  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;

  @IsOptional()
  @IsEnum(ItemType)
  type: ItemType;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  // Conditional validation based on type
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

/**
 * @category Courses/Validators/ItemValidators
 */
class MoveItemBody {
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @ValidateIf(o => !o.afterItemId && !o.beforeItemId)
  @IsNotEmpty({
    message: 'At least one of "afterItemId" or "beforeItemId" must be provided',
  })
  onlyOneAllowed: string;

  @ValidateIf(o => o.afterItemId && o.beforeItemId)
  @IsNotEmpty({
    message: 'Only one of "afterItemId" or "beforeItemId" must be provided',
  })
  bothNotAllowed: string;
}

class CreateItemParams {
  @IsMongoId()
  @IsString()
  versionId: string;

  @IsMongoId()
  @IsString()
  moduleId: string;

  @IsMongoId()
  @IsString()
  sectionId: string;
}

class ReadAllItemsParams {
  @IsMongoId()
  @IsString()
  versionId: string;

  @IsMongoId()
  @IsString()
  moduleId: string;

  @IsMongoId()
  @IsString()
  sectionId: string;
}

class UpdateItemParams {
  @IsMongoId()
  @IsString()
  versionId: string;

  @IsMongoId()
  @IsString()
  moduleId: string;

  @IsMongoId()
  @IsString()
  sectionId: string;

  @IsMongoId()
  @IsString()
  itemId: string;
}

class MoveItemParams {
  @IsMongoId()
  @IsString()
  versionId: string;

  @IsMongoId()
  @IsString()
  moduleId: string;

  @IsMongoId()
  @IsString()
  sectionId: string;

  @IsMongoId()
  @IsString()
  itemId: string;
}

export {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
  VideoDetailsPayloadValidator,
  QuizDetailsPayloadValidator,
  BlogDetailsPayloadValidator,
  CreateItemParams,
  ReadAllItemsParams,
  UpdateItemParams,
  MoveItemParams,
};
