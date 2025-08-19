import { ID } from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsObject,
  ValidateNested,
  IsUrl,
  IsNumber,
  IsArray,
  IsJSON,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type, Transform } from 'class-transformer';
import { LanguageType, JobType, TaskType, TaskStatus, audioData, contentUploadData, questionGenerationData, segmentationData, trascriptGenerationData } from '../transformers/GenAI.js';

@JSONSchema({ title: 'TranscriptParameters' })
class TranscriptParameters {
  @JSONSchema({
    title: 'Language',
    description: 'Language for the job',
    example: 'en',
    type: 'string',
  })
  @IsOptional()
  @IsEnum(LanguageType)
  language?: LanguageType;

  @JSONSchema({
    title: 'Model Size',
    description: 'Model size to use for the job',
    example: 'large',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  modelSize?: string;
}

@JSONSchema({ title: 'SegmentationParameters' })
class SegmentationParameters {
  @JSONSchema({
    title: "Lambda",
    description: 'Lambda parameter for segmentation',
    example: 4.6,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  lam?: number;

  @JSONSchema({
    title: "Runs",
    description: 'Number of runs for segmentation',
    example: 25,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  runs?: number;
  
  @JSONSchema({
    title: 'Noise ID',
    description: 'ID of the noise to be used for segmentation',
    example: -1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  noiseId?: number;
}

@JSONSchema({ title: 'QuestionGenerationParameters' })
class QuestionGenerationParameters {
  @JSONSchema({
    title: 'Model',
    description: 'Model to use for question generation',
    example: 'deepseek-r1:70b',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @JSONSchema({
    title: 'SOL Number',
    description: 'Number of select one in lot questions to be generated',
    example: 2,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  SOL?: number;

  @JSONSchema({
    title: 'SML Number',
    description: 'Number of select multiple in lot questions to be generated',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  SML?: number;

  @JSONSchema({
    title: 'NAT Number',
    description: 'Number of natural questions to be generated',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  NAT?: number;

  @JSONSchema({
    title: 'DES Number',
    description: 'Number of descriptive questions to be generated',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  DES?: number;

  @JSONSchema({
    title: 'Prompt',
    description: 'Prompt to use for question generation',
    example: "Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead",
    type: 'string',
  })
  @IsOptional()
  @IsString()
  prompt?: string
}

@JSONSchema({ title: 'UploadParameters' })
class UploadParameters {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b2',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b3',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  moduleId?: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b4',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  sectionId?: string;

  @JSONSchema({
    title: 'Video Item Base Name',
    description: 'Base name for the video item to be created',
    example: 'video_item',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  videoItemBaseName?: string;

  @JSONSchema({
    title: 'Quiz Item Base Name',
    description: 'Base name for the quiz item to be created',
    example: 'quiz_item',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
	quizItemBaseName?: string;

  @JSONSchema({
    title: 'Questions Per Quiz',
    description: 'Number of questions to show per quiz item',
    example: 5,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
	questionsPerQuiz?: number;
}

@JSONSchema({ title: 'PartialUploadParameters' })
class PartialUploadParameters {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b1',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  courseId?: string;

  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b2',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  versionId?: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b3',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  moduleId?: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section to upload the content to',
    example: '60d5f484f1c4d8b3c8f8e4b4',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  sectionId?: string;

  @JSONSchema({
    title: 'Video Item Base Name',
    description: 'Base name for the video item to be created',
    example: 'video_item',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  videoItemBaseName?: string;

  @JSONSchema({
    title: 'Quiz Item Base Name',
    description: 'Base name for the quiz item to be created',
    example: 'quiz_item',
    type: 'string',
  })
  @IsOptional()
  @IsString()
	quizItemBaseName?: string;

  @JSONSchema({
    title: 'Questions Per Quiz',
    description: 'Number of questions to show per quiz item',
    example: 5,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
	questionsPerQuiz?: number;
}

class Chunk {
  @JSONSchema({
    description: 'Timestamps of the chunk',
    example: [0, 5],
    type: 'array',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  timestamp: Array<number>;

  @JSONSchema({
    description: 'Text content of the chunk',
    example: 'This is a sample chunk of text.',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  text: string;
}

class Transcript {
  @JSONSchema({
    description: 'Chunks of the transcript',
    type: 'array'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Chunk)
  chunks: Array<Chunk>;
}

class GenAIResponse{
  @JSONSchema({
    description: 'Unique identifier for the genAI job',
    type: 'string',
    readOnly: true,
  })
  @IsOptional()
  @IsMongoId()
  _id?: ID;

  @JSONSchema({
    description: 'Type of genAI job',
    enum: Object.values(JobType),
    example: 'VIDEO',
  })
  @IsNotEmpty()
  @IsEnum(JobType)
  @IsString()
  type: JobType;

  @JSONSchema({
    description: 'url of the video or playlist to process',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  url: string;
}
// Request body for creating a genAI job
class JobBody {
  @JSONSchema({
    title: 'Job Type',
    description: 'Type of genAI job to create',
    example: 'VIDEO',
    enum: Object.values(JobType),
  })
  @IsNotEmpty()
  @IsEnum(JobType)
  type: JobType;

  @JSONSchema({
    title: 'Source URL',
    description: 'URL of the video or playlist to process',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  url: string;

  @JSONSchema({
    title: 'Transcript',
    description: 'Transcript of the video',
    example: {},
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Transcript)
  transcript?: Transcript;

  @JSONSchema({
    title: 'Transcript Parameters',
    description: 'Parameters for generating transcripts',
    type: 'object',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value; // Let validation handle the error
      }
    }
    return value;
  })
  @IsObject()
  @ValidateNested()
  @Type(() => TranscriptParameters)
  transcriptParameters?: TranscriptParameters;

  @JSONSchema({
    title: 'Segmentation Parameters',
    description: 'Parameters for segmenting the video',
    type: 'object',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value; // Let validation handle the error
      }
    }
    return value;
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SegmentationParameters)
  segmentationParameters?: SegmentationParameters;

  @JSONSchema({
    title: 'Question Generation Parameters',
    description: 'Parameters for generating questions from the transcript',
    type: 'object',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value; // Let validation handle the error
      }
    }
    return value;
  })
  @IsObject()
  @ValidateNested()
  @Type(() => QuestionGenerationParameters)
  questionGenerationParameters?: QuestionGenerationParameters;

  @JSONSchema({
    title: 'Upload Parameters',
    description: 'Parameters for uploading the content to a course',
    type: 'object',
  })
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value; // Let validation handle the error
      }
    }
    return value;
  })
  @IsObject()
  @ValidateNested()
  @Type(() => UploadParameters)
  uploadParameters: UploadParameters;
}

// Parameters for job ID
class GenAIIdParams {
  @JSONSchema({
    description: 'Object ID of the genAI job',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  id: string;
}

class TaskStatusParams extends GenAIIdParams {
  @JSONSchema({
    description: 'Type of task to get status for',
    enum: Object.values(TaskType),
    example: 'TRANSCRIPT_GENERATION',
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  type: TaskType;
}

// Request body for approving task start
class ApproveStartBody {
  @JSONSchema({
    title: 'Task Type',
    description: 'Type of task to start',
    enum: Object.values(TaskType),
    example: 'TRANSCRIPT_GENERATION',
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  type: TaskType;

  @JSONSchema({
    title: 'Task Parameters',
    description: 'Parameters for the task to start',
    oneOf: [
      {
        $ref: '#/components/schemas/TranscriptParameters',
      },
      {
        $ref: '#/components/schemas/SegmentationParameters',
      },
      {
        $ref: '#/components/schemas/QuestionGenerationParameters',
      },
      {
        $ref: '#/components/schemas/UploadParameters',
      },
    ],
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object;
    if (!object) return Object;
    switch (object.type) {
      case TaskType.TRANSCRIPT_GENERATION:
        return TranscriptParameters;
      case TaskType.SEGMENTATION:
        return SegmentationParameters;
      case TaskType.QUESTION_GENERATION:
        return QuestionGenerationParameters;
      case TaskType.UPLOAD_CONTENT:
        return PartialUploadParameters;
      default:
        return Object;
    }
  })
  parameters?: Partial<TranscriptParameters | SegmentationParameters | QuestionGenerationParameters | PartialUploadParameters>;

  @JSONSchema({
    title: 'Use Previous',
    description: 'Which previous task output to use for this task',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  usePrevious?: number;
}

class RerunTaskBody {
  @JSONSchema({
    title: 'Task Type',
    description: 'Type of task to rerun',
    enum: Object.values(TaskType),
    example: 'TRANSCRIPT_GENERATION',
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  type: TaskType;

  @JSONSchema({
    title: 'Rerun Task Parameters',
    description: 'Parameters for the task to rerun',
    oneOf: [
      {
        $ref: '#/components/schemas/TranscriptParameters',
      },
      {
        $ref: '#/components/schemas/SegmentationParameters',
      },
      {
        $ref: '#/components/schemas/QuestionGenerationParameters',
      },
      {
        $ref: '#/components/schemas/UploadParameters',
      },
    ],
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object;
    if (!object) return Object;
    switch (object.type) {
      case TaskType.TRANSCRIPT_GENERATION:
        return TranscriptParameters;
      case TaskType.SEGMENTATION:
        return SegmentationParameters;
      case TaskType.QUESTION_GENERATION:
        return QuestionGenerationParameters;
      case TaskType.UPLOAD_CONTENT:
        return PartialUploadParameters;
      default:
        return Object;
    }
  })
  parameters?: Partial<TranscriptParameters | SegmentationParameters | QuestionGenerationParameters | PartialUploadParameters>;
  
  @JSONSchema({
    title: 'Use Previous',
    description: 'Which previous task output to use for this task',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  usePrevious?: number;
}

// Task status
class TaskStatusResponse {
  @JSONSchema({
    title: 'Task type',
    enum: Object.values(TaskType),
    example: 'TRANSCRIPT_GENERATION',
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  type: TaskType;

  @JSONSchema({
    description: 'Task status',
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
    example: 'RUNNING',
  })
  @IsNotEmpty()
  @IsEnum(TaskStatus)
  status: TaskStatus;
}

// Response schema for job data
class JobStatusResponse {
  @JSONSchema({
    description: 'Unique identifier for the genAI job',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  _id?: ID;

  @JSONSchema({
    description: 'Type of genAI job',
    enum: Object.values(JobType),
    example: 'VIDEO',
  })
  @IsNotEmpty()
  @IsEnum(JobType)
  type: JobType;

  @JSONSchema({
    description: 'Current status of the job',
    enum: Object.values(TaskStatus),
    example: 'RUNNING',
  })
  @IsNotEmpty()
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @JSONSchema({
    description: 'Source URL for the job',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  sourceUrl: string;

  @JSONSchema({
    description: 'Current task in the process',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskStatusResponse)
  currentTask?: TaskStatusResponse;

  @JSONSchema({
    description: 'Overall tasks completed in the job',
    type: 'number',
    example: 2,
  })
  @IsOptional()
  tasksCompleted?: number;

  @JSONSchema({
    title: 'Job Created At',
    description: 'Timestamp when the job was created',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsNotEmpty()
  createdAt?: Date | null;

  @JSONSchema({
    title: 'Job Updated At',
    description: 'Timestamp when the job was last updated',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsNotEmpty()
  updatedAt?: Date | null;
}

// Error response for not found jobs
class GenAINotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example: 'No genAI job found with the specified ID. Please verify the ID and try again.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

class WebhookBody {
  @JSONSchema({
    title: 'Task',
    description: 'The task type that the webhook is reporting on',
    enum: Object.values(TaskType),
    example: 'TRANSCRIPT_GENERATION',
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  task: TaskType;

  @JSONSchema({
    title: 'Job ID',
    description: 'The unique identifier for the genAI job',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  jobId: string;

  @JSONSchema({
    title: 'Data',
    description: 'Additional data related to the task status',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  data: audioData | trascriptGenerationData | segmentationData | questionGenerationData | contentUploadData;
}

class EditSegmentMapBody {
  @JSONSchema({
    title: 'Segment Map',
    description: 'Map of segments to edit',
    type: 'object',
  })
  @IsNotEmpty()
  @IsArray()
  segmentMap: Array<number>;

  @JSONSchema({
    title: 'Index',
    description: 'Index of the segment to edit',
    type: 'number',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  index: number;
}

class EditQuestionData {
  @JSONSchema({
    title: 'Question Data',
    description: 'The question data to edit',
    type: 'object',
  })
  @IsNotEmpty()
  questionData: JSON;

  @JSONSchema({
    title: 'Index',
    description: 'Index of the question to edit',
    type: 'number',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  index: number;
}

class EditTranscript {
  @JSONSchema({
    title: 'Transcript',
    description: 'The transcript to edit',
    type: 'object',
  })
  @IsNotEmpty()
  transcript: JSON;

  @JSONSchema({
    title: 'Index',
    description: 'Index of the transcript to edit',
    type: 'number',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  index: number;
}

export {
  JobType,
  GenAIResponse,
  JobStatusResponse,
  JobBody,
  GenAIIdParams,
  TaskStatusParams,
  ApproveStartBody,
  RerunTaskBody,
  TaskStatus,
  GenAINotFoundErrorResponse,
  WebhookBody,
  EditSegmentMapBody,
  EditQuestionData,
  EditTranscript,
};

export const GENAI_VALIDATORS = [
  JobType,
  GenAIResponse,
  JobStatusResponse,
  JobBody,
  GenAIIdParams,
  ApproveStartBody,
  RerunTaskBody,
  TaskStatus,
  GenAINotFoundErrorResponse,
  WebhookBody,
  EditSegmentMapBody,
  EditQuestionData,
  EditTranscript,
];
