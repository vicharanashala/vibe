import { DESQuestion, NATQuestion, OTLQuestion, SMLQuestion, SOLQuestion } from "#root/modules/quizzes/classes/index.js";
import { ID, QuestionType } from "#root/shared/index.js";

// Enum for job types
export enum JobType {
  VIDEO = 'VIDEO',
  PLAYLIST = 'PLAYLIST'
}

// Enum for task types
export enum TaskType {
  AUDIO_EXTRACTION = 'AUDIO_EXTRACTION',
  TRANSCRIPT_GENERATION = 'TRANSCRIPT_GENERATION',
  SEGMENTATION = 'SEGMENTATION',
  QUESTION_GENERATION = 'QUESTION_GENERATION',
  UPLOAD_QUESTION = 'UPLOAD_QUESTION'
}

export enum LanguageType {
  ENGLISH = 'en',
  HINDI = 'hi',
}

// Job status enum
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ABORTED = 'ABORTED'
}

interface TranscriptParameters {
	language?: LanguageType;
	model?: string;
}

interface SegmentationParameters {
	lambda?: number;
	epochs?: number;
}

interface QuestionGenerationParameters {
	prompt: string;
	model?: string;
}

interface UploadParameters {
	courseId: string;
	versionId: string;
	moduleId: string;
	sectionId: string;
	afterItemId?: string;
	beforeItemId?: string;
}

interface audioData {
	status: TaskStatus;
	fileName?: string;
	fileUrl?: string;
}

interface trascriptGenerationData {
	status: TaskStatus;
	fileName?: string;
	fileUrl?: string;
	newParamers?: TranscriptParameters;
}

interface segmentationData {
	status: TaskStatus;
	fileName?: string;
	fileUrl?: string;
	newParameters?: SegmentationParameters;
}

interface questionGenerationData {
	status: TaskStatus;
	questionType?: QuestionType;
	question?: SOLQuestion | SMLQuestion | NATQuestion | OTLQuestion | DESQuestion;
	newParameters?: QuestionGenerationParameters;
}

export class JobStatus {
	audioExtraction: TaskStatus;
	transcriptGeneration: TaskStatus;
	segmentation: TaskStatus;
	questionGeneration: TaskStatus;
	uploadQuestion: TaskStatus;

	constructor() {
		this.audioExtraction = TaskStatus.PENDING;
		this.transcriptGeneration = TaskStatus.PENDING;
		this.segmentation = TaskStatus.PENDING;
		this.questionGeneration = TaskStatus.PENDING;
		this.uploadQuestion = TaskStatus.PENDING;
	}
}

export class GenAI {
	type: JobType;
	url: string;
	transcriptParameters?: TranscriptParameters;
	segmentationParameters?: SegmentationParameters;
	questionGenerationParameters?: QuestionGenerationParameters;
	uploadParameters?: UploadParameters;
}

export class GenAIBody extends GenAI {
	_id?: ID;
	userId: string;
	createdAt: Date;
	jobStatus: JobStatus;
}

export class TaskData {
	_id?: ID;
	jobId: string;
	audioExtraction?: audioData[];
	transcriptGeneration?: trascriptGenerationData[]
	segmentation?: segmentationData[];
	questionGeneration?: questionGenerationData[];
}