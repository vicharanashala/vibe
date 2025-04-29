import {Type} from 'class-transformer';
import {
  IsDateString,
  IsDecimal,
  IsEmpty,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IBaseItem,
  IBlogDetails,
  IQuizDetails,
  ItemType,
  IVideoDetails,
} from 'shared/interfaces/Models';

/**
 * Video item details for embedded video learning content.
 *
 * @category Courses/Validators/ItemValidators
 */
class VideoDetailsPayloadValidator implements IVideoDetails {
  /**
   * Public video URL (e.g., YouTube or Vimeo link).
   */
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  URL: string;

  /**
   * Start time of the clip in HH:MM:SS format.
   */
  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  startTime: string;

  /**
   * End time of the clip in HH:MM:SS format.
   */
  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  endTime: string;

  /**
   * Points assigned to the video interaction.
   */
  @IsNotEmpty()
  @IsDecimal()
  points: number;
}

/**
 * Quiz item details for scheduled quiz-based evaluation.
 *
 * @category Courses/Validators/ItemValidators
 */
class QuizDetailsPayloadValidator implements IQuizDetails {
  /**
   * Number of quiz questions visible to students.
   */
  @IsNotEmpty()
  @IsPositive()
  questionVisibility: number;

  /**
   * ISO date string representing quiz release time.
   */
  @IsNotEmpty()
  @IsDateString()
  releaseTime: Date;

  /**
   * List of quiz question IDs (auto-managed).
   */
  @IsEmpty()
  questions: string[];

  /**
   * ISO date string for quiz deadline.
   */
  @IsNotEmpty()
  @IsDateString()
  deadline: Date;
}

/**
 * Blog item details for content-based reading or writing activities.
 *
 * @category Courses/Validators/ItemValidators
 */
class BlogDetailsPayloadValidator implements IBlogDetails {
  /**
   * Tags for categorizing the blog (auto-managed).
   */
  @IsEmpty()
  tags: string[];

  /**
   * Full blog content in markdown or plain text.
   */
  @IsNotEmpty()
  @IsString()
  content: string;

  /**
   * Points assigned to the blog submission.
   */
  @IsNotEmpty()
  @IsDecimal()
  points: number;

  /**
   * Estimated time to complete the blog in minutes.
   */
  @IsNotEmpty()
  @IsPositive()
  estimatedReadTimeInMinutes: number;
}

/**
 * Body for creating an item inside a section.
 *
 * @category Courses/Validators/ItemValidators
 */
class CreateItemBody implements IBaseItem {
  /**
   * MongoDB ID (auto-assigned).
   */
  @IsEmpty()
  _id?: string;

  /**
   * Title of the item (required).
   */
  @IsNotEmpty()
  @IsString()
  name: string;

  /**
   * Description of the item (required).
   */
  @IsNotEmpty()
  @IsString()
  description: string;

  /**
   * Section ID to which the item belongs (auto-managed).
   */
  @IsEmpty()
  sectionId: string;

  /**
   * Order key for item placement (auto-managed).
   */
  @IsEmpty()
  order: string;

  /**
   * Item details (depends on type) – video, blog, or quiz.
   */
  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  /**
   * Place item after this item ID (optional).
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  /**
   * Place item before this item ID (optional).
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  /**
   * Item creation timestamp (auto-managed).
   */
  @IsEmpty()
  createdAt: Date;

  /**
   * Item update timestamp (auto-managed).
   */
  @IsEmpty()
  updatedAt: Date;

  /**
   * Type of the item: VIDEO, BLOG, or QUIZ.
   */
  @IsNotEmpty()
  @IsEnum(ItemType)
  type: ItemType;

  /**
   * Nested video details (required if type is VIDEO).
   */
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  /**
   * Nested blog details (required if type is BLOG).
   */
  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  /**
   * Nested quiz details (required if type is QUIZ).
   */
  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

/**
 * Body for updating an item.
 * Allows partial updates to name, description, and details.
 *
 * @category Courses/Validators/ItemValidators
 */
class UpdateItemBody implements IBaseItem {
  /**
   * MongoDB ID of the item (auto-managed).
   */
  @IsEmpty()
  _id?: string;

  /**
   * Updated name (optional).
   */
  @IsOptional()
  @IsString()
  name: string;

  /**
   * Updated description (optional).
   */
  @IsOptional()
  @IsString()
  description: string;

  /**
   * Section ID (auto-managed).
   */
  @IsEmpty()
  sectionId: string;

  /**
   * Order (auto-managed).
   */
  @IsEmpty()
  order: string;

  /**
   * Item details (auto-managed).
   */
  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  /**
   * Created at timestamp (auto-managed).
   */
  @IsEmpty()
  createdAt: Date;

  /**
   * Updated at timestamp (auto-managed).
   */
  @IsEmpty()
  updatedAt: Date;

  /**
   * Updated type, if changing item category.
   */
  @IsOptional()
  @IsEnum(ItemType)
  type: ItemType;

  /**
   * Optional: reorder after this item.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  /**
   * Optional: reorder before this item.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  /**
   * Updated video details (if type is VIDEO).
   */
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  /**
   * Updated blog details (if type is BLOG).
   */
  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  /**
   * Updated quiz details (if type is QUIZ).
   */
  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

/**
 * Body to move an item within its section.
 *
 * @category Courses/Validators/ItemValidators
 */
class MoveItemBody {
  /**
   * Move after this item (optional).
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  /**
   * Move before this item (optional).
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  /**
   * Validation helper – at least one of afterItemId or beforeItemId must be present.
   */
  @ValidateIf(o => !o.afterItemId && !o.beforeItemId)
  @IsNotEmpty({
    message: 'At least one of "afterItemId" or "beforeItemId" must be provided',
  })
  onlyOneAllowed: string;

  /**
   * Validation helper – both afterItemId and beforeItemId cannot be present at the same time.
   */
  @ValidateIf(o => o.afterItemId && o.beforeItemId)
  @IsNotEmpty({
    message: 'Only one of "afterItemId" or "beforeItemId" must be provided',
  })
  bothNotAllowed: string;
}

/**
 * Route parameters for creating a new item.
 *
 * @category Courses/Validators/ItemValidators
 */
class CreateItemParams {
  /** Version ID of the course */
  @IsMongoId()
  @IsString()
  versionId: string;

  /** Module ID inside the version */
  @IsMongoId()
  @IsString()
  moduleId: string;

  /** Section ID inside the module */
  @IsMongoId()
  @IsString()
  sectionId: string;
}

/**
 * Route parameters for retrieving all items in a section.
 *
 * @category Courses/Validators/ItemValidators
 */
class ReadAllItemsParams {
  /** Version ID of the course */
  @IsMongoId()
  @IsString()
  versionId: string;

  /** Module ID inside the version */
  @IsMongoId()
  @IsString()
  moduleId: string;

  /** Section ID inside the module */
  @IsMongoId()
  @IsString()
  sectionId: string;
}

/**
 * Route parameters for updating a specific item.
 *
 * @category Courses/Validators/ItemValidators
 */
class UpdateItemParams {
  /** Version ID of the course */
  @IsMongoId()
  @IsString()
  versionId: string;

  /** Module ID inside the version */
  @IsMongoId()
  @IsString()
  moduleId: string;

  /** Section ID inside the module */
  @IsMongoId()
  @IsString()
  sectionId: string;

  /** Target item ID to update */
  @IsMongoId()
  @IsString()
  itemId: string;
}

/**
 * Route parameters for moving an item.
 *
 * @category Courses/Validators/ItemValidators
 */
class MoveItemParams {
  /** Version ID of the course */
  @IsMongoId()
  @IsString()
  versionId: string;

  /** Module ID inside the version */
  @IsMongoId()
  @IsString()
  moduleId: string;

  /** Section ID inside the module */
  @IsMongoId()
  @IsString()
  sectionId: string;

  /** Item ID to move */
  @IsMongoId()
  @IsString()
  itemId: string;
}

/**
 * Route parameters for deleting an item.
 *
 * @category Courses/Validators/ItemValidators
 */

class DeleteItemParams {
  /** ItemsGroupId */

  @IsMongoId()
  @IsString()
  itemsGroupId: string;

  /** ItemId */
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
  DeleteItemParams,
};
