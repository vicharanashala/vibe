import {
  IVideoDetails,
  IQuizDetails,
  IBlogDetails,
  IBaseItem,
  ItemType,
} from '#shared/index.js';
import {Type} from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  IsNumber,
  IsPositive,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsEmpty,
  IsDecimal,
  IsMongoId,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {CourseVersion} from '../transformers/CourseVersion.js';
import {
  ItemsGroup,
  QuizItem,
  BlogItem,
  VideoItem,
} from '../transformers/Item.js';

class VideoDetailsPayloadValidator implements IVideoDetails {
  @JSONSchema({
    title: 'Video URL',
    description: 'Public video URL (e.g., YouTube or Vimeo link)',
    example: 'https://youtu.be/ta99S6Fh53c',
    type: 'string',
    format: 'uri',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  URL: string;

  @JSONSchema({
    title: 'Start Time',
    description: 'Start time of the video clip in HH:MM:SS format',
    example: '00:01:30',
    type: 'string',
  })
  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  startTime: string;

  @JSONSchema({
    title: 'End Time',
    description: 'End time of the video clip in HH:MM:SS format',
    example: '00:10:15',
    type: 'string',
  })
  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  endTime: string;

  @JSONSchema({
    title: 'Video Points',
    description: 'Points assigned to the video interaction',
    example: 10,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  points: number;
}

class QuizDetailsPayloadValidator
  implements Omit<IQuizDetails, 'questionBankRefs'>
{
  @JSONSchema({
    title: 'Pass Threshold',
    description: 'Minimum percentage required to pass, between 0 and 1',
    example: 0.7,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsPositive()
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsNotEmpty()
  passThreshold: number; // 0-1

  @JSONSchema({
    title: 'Maximum Attempts',
    description:
      'Maximum number of attempts allowed for the quiz, -1 for unlimited',
    example: 3,
    type: 'integer',
    minimum: -1,
  })
  @IsNumber()
  @Min(-1)
  @IsNotEmpty()
  maxAttempts: number;

  @JSONSchema({
    title: 'Quiz Type',
    description: 'Type of quiz: DEADLINE or NO_DEADLINE',
    example: 'DEADLINE',
    type: 'string',
    enum: ['DEADLINE', 'NO_DEADLINE'],
  })
  @IsString()
  @IsNotEmpty()
  quizType: 'DEADLINE' | 'NO_DEADLINE';

  @JSONSchema({
    title: 'Approximate Time to Complete',
    description: 'Approximate time to complete the quiz in HH:MM:SS format',
    example: '00:30:00',
    type: 'string',
  })
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, {
    message: 'Invalid time format, it should be HH:MM:SS',
  })
  @IsNotEmpty()
  approximateTimeToComplete: string;

  @JSONSchema({
    title: 'Allow Partial Grading',
    description:
      'Whether to allow partial grading for questions, particularly for MSQ/SML type of questions.',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsNotEmpty()
  allowPartialGrading: boolean;

  @JSONSchema({
    title: 'Allow Hint',
    description: 'Whether to allow students to see the hints for questions',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsNotEmpty()
  allowHint: boolean;

  @JSONSchema({
    title: 'Show Correct Answers After Submission',
    description:
      'Whether to return and show correct answers after successful submission of an attempt',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsNotEmpty()
  showCorrectAnswersAfterSubmission: boolean;

  @JSONSchema({
    title: 'Show Explanation After Submission',
    description:
      'Whether to return and show explanations for correct answers after successful submission of an attempt',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsNotEmpty()
  showExplanationAfterSubmission: boolean;

  @JSONSchema({
    title: 'Show Score After Submission',
    description:
      'Whether to return and show score after successful submission of an attempt',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsNotEmpty()
  showScoreAfterSubmission: boolean;

  @JSONSchema({
    title: 'Question Visibility',
    description: 'Number of quiz questions visible to students in an attempt',
    example: 5,
    type: 'integer',
    minimum: 1,
  })
  @IsNotEmpty()
  @IsPositive()
  questionVisibility: number;

  @JSONSchema({
    title: 'Quiz Release Time',
    description: 'ISO date string representing quiz release time',
    example: '2023-10-15T14:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  @IsDateString()
  releaseTime: Date;

  @JSONSchema({
    title: 'Quiz Deadline',
    description: 'ISO date string for quiz deadline',
    example: '2023-10-22T23:59:59Z',
    type: 'string',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  deadline: Date;
}

class BlogDetailsPayloadValidator implements IBlogDetails {
  @JSONSchema({
    title: 'Blog Tags',
    description: 'Tags for categorizing the blog (auto-managed)',
    example: ['programming', 'algorithms'],
    type: 'array',
    items: {
      type: 'string',
    },
    readOnly: true,
  })
  @IsEmpty()
  tags: string[];

  @JSONSchema({
    title: 'Blog Content',
    description: 'Full blog content in markdown or plain text',
    example:
      '# Introduction\n\nThis is a sample blog post about programming...',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @JSONSchema({
    title: 'Blog Points',
    description: 'Points assigned to the blog submission',
    example: 20,
    type: 'number',
  })
  @IsNotEmpty()
  @IsDecimal()
  points: number;

  @JSONSchema({
    title: 'Estimated Read Time',
    description: 'Estimated time to complete reading the blog in minutes',
    example: 15,
    type: 'integer',
    minimum: 1,
  })
  @IsNotEmpty()
  @IsPositive()
  estimatedReadTimeInMinutes: number;
}

class CreateItemBody implements Partial<IBaseItem> {
  @JSONSchema({
    title: 'Item Name',
    description: 'Title of the item',
    example: 'Introduction to Data Structures',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @JSONSchema({
    title: 'Item Description',
    description: 'Description of the item',
    example:
      'Learn about basic data structures like arrays, linked lists, and stacks.',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @JSONSchema({
    title: 'After Item ID',
    description: 'Place item after this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @JSONSchema({
    title: 'Before Item ID',
    description: 'Place item before this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @JSONSchema({
    title: 'Item Type',
    description: 'Type of the item: VIDEO, BLOG, or QUIZ',
    example: 'VIDEO',
    type: 'string',
    enum: ['VIDEO', 'BLOG', 'QUIZ'],
  })
  @IsNotEmpty()
  type: ItemType;

  @JSONSchema({
    title: 'Video Details',
    description: 'Details specific to video items',
  })
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  @JSONSchema({
    title: 'Blog Details',
    description: 'Details specific to blog items',
  })
  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  @JSONSchema({
    title: 'Quiz Details',
    description: 'Details specific to quiz items',
    type: 'object',
  })
  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

class UpdateItemBody implements Partial<IBaseItem> {
  @JSONSchema({
    title: 'Item Name',
    description: 'Updated title of the item',
    example: 'Advanced Data Structures',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  name: string;

  @JSONSchema({
    title: 'Item Description',
    description: 'Updated description of the item',
    example:
      'Learn about advanced data structures like trees, graphs, and hash tables.',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  description: string;

  @JSONSchema({
    title: 'Item Order',
    description: 'Order key for item placement (auto-managed)',
    example: 'a1b2c3',
    type: 'string',
    readOnly: true,
  })
  @IsEmpty()
  order: string;

  @JSONSchema({
    title: 'Item Details',
    description: 'Item details (depends on type) – video, blog, or quiz',
    type: 'object',
    readOnly: true,
  })
  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  @JSONSchema({
    title: 'Created At',
    description: 'Item creation timestamp (auto-managed)',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsEmpty()
  createdAt: Date;

  @JSONSchema({
    title: 'Updated At',
    description: 'Item update timestamp (auto-managed)',
    example: '2023-10-05T15:30:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsEmpty()
  updatedAt: Date;

  @JSONSchema({
    title: 'Item Type',
    description: 'Updated type of the item: VIDEO, BLOG, or QUIZ',
    example: 'BLOG',
    type: 'string',
    enum: ['VIDEO', 'BLOG', 'QUIZ'],
  })
  @IsOptional()
  type: ItemType;

  @JSONSchema({
    title: 'After Item ID',
    description: 'Place item after this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @JSONSchema({
    title: 'Before Item ID',
    description: 'Place item before this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @JSONSchema({
    title: 'Video Details',
    description: 'Updated details specific to video items',
    type: 'object',
  })
  @ValidateIf(o => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayloadValidator)
  videoDetails?: VideoDetailsPayloadValidator;

  @JSONSchema({
    title: 'Blog Details',
    description: 'Updated details specific to blog items',
    type: 'object',
  })
  @ValidateIf(o => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayloadValidator)
  blogDetails?: BlogDetailsPayloadValidator;

  @JSONSchema({
    title: 'Quiz Details',
    description: 'Updated details specific to quiz items',
    type: 'object',
  })
  @ValidateIf(o => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayloadValidator)
  quizDetails?: QuizDetailsPayloadValidator;
}

class MoveItemBody {
  @JSONSchema({
    title: 'After Item ID',
    description: 'Move the item after this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @JSONSchema({
    title: 'Before Item ID',
    description: 'Move the item before this item ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] Validation helper. Either afterItemId or beforeItemId must be provided.',
    readOnly: true,
    type: 'string',
  })
  @ValidateIf(o => !o.afterItemId && !o.beforeItemId)
  @IsNotEmpty({
    message: 'At least one of "afterItemId" or "beforeItemId" must be provided',
  })
  onlyOneAllowed: string;

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] Validation helper. Both afterItemId and beforeItemId should not be provided together.',
    readOnly: true,
    type: 'string',
  })
  @ValidateIf(o => o.afterItemId && o.beforeItemId)
  @IsNotEmpty({
    message: 'Only one of "afterItemId" or "beforeItemId" must be provided',
  })
  bothNotAllowed: string;
}

class CreateItemParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module inside the version',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section inside the module',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  sectionId: string;
}

class ReadAllItemsParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the items',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module containing the section',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section containing the items',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  sectionId: string;
}

class UpdateItemParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module containing the section',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  sectionId: string;

  @JSONSchema({
    title: 'Item ID',
    description: 'ID of the item to be updated',
    example: '60d5ec49b3f1c8e4a8f8b8f8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  itemId: string;
}

class MoveItemParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module containing the section',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  sectionId: string;

  @JSONSchema({
    title: 'Item ID',
    description: 'ID of the item to be moved',
    example: '60d5ec49b3f1c8e4a8f8b8f8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  itemId: string;
}

class DeleteItemParams {
  @JSONSchema({
    title: 'Items Group ID',
    description: 'ID of the items group containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8g9',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  itemsGroupId: string;

  @JSONSchema({
    title: 'Item ID',
    description: 'ID of the item to delete',
    example: '60d5ec49b3f1c8e4a8f8b8f8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  itemId: string;
}
class GetItemParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course in which user is enrolled',
    example: '60d5ec49b3f1c8e4a8f8b8g9',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version containing the item',
    example: '60d5ec49b3f1c8e4a8f8b8f8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  courseVersionId: string;

  @JSONSchema({
    title: 'Item ID',
    description: 'ID of the item',
    example: '60d5ec49b3f1c8e4a8f8b8f8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  itemId: string;
}

class ItemNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message',
    example:
      'No item found with the specified ID. Please verify the ID and try again.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

class ItemDataResponse {
  @JSONSchema({
    description: 'The item data',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  itemsGroup: ItemsGroup;

  @JSONSchema({
    description: 'The updated version data (when applicable)',
    type: 'object',
    readOnly: true,
  })
  @IsOptional()
  version?: CourseVersion;
}

class DeletedItemResponse {
  @JSONSchema({
    description: 'The deleted item data',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  deletedItem: Record<string, any>;

  @JSONSchema({
    description: 'The updated items group after deletion',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  updatedItemsGroup: Record<string, any>;
}

class GetItemResponse {
  @JSONSchema({
    description: 'The item data',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  item: VideoItem | QuizItem | BlogItem;
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
  ItemNotFoundErrorResponse,
  ItemDataResponse,
  DeletedItemResponse,
  GetItemParams,
  GetItemResponse,
};
