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
  UPLOAD_CONTENT = 'UPLOAD_CONTENT'
}

export enum LanguageType {
  ENGLISH = 'English',
  HINDI = 'Hindi',
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

export interface TranscriptParameters {
	usePrevious?: number;
	language?: LanguageType;
	model?: string;
	modelSize?: string;
}

export interface SegmentationParameters {
	usePrevious?: number;
	lambda?: number;
	epochs?: number;
}

export interface QuestionGenerationParameters {
	usePrevious?: number;
	model?: string;
	SOL?: number;
	SML?: number;
	NAT?: number;
	DES?: number;
}

export interface UploadParameters {
	usePrevious?: number;
	courseId: string;
	versionId: string;
	moduleId: string;
	sectionId: string;
	afterItemId?: string;
	beforeItemId?: string;
}

export interface audioData {
	status: TaskStatus;
	error: string;
	fileName?: string;
	fileUrl?: string;
}

export interface trascriptGenerationData {
	status: TaskStatus;
	error?: string;
	fileName?: string;
	fileUrl?: string;
	newParamers?: TranscriptParameters;
}

export interface segmentationData {
	status: TaskStatus;
	error?: string;
	fileName?: string;
	fileUrl?: string;
	newParameters?: SegmentationParameters;
}

export interface questionGenerationData {
	status: TaskStatus;
	error?: string;
	questionType?: QuestionType;
	question?: SOLQuestion | SMLQuestion | NATQuestion | OTLQuestion | DESQuestion;
	newParameters?: QuestionGenerationParameters;
}

export interface contentUploadData {
	status: TaskStatus;
	error?: string;
}

export class JobStatus {
	audioExtraction: TaskStatus;
	transcriptGeneration: TaskStatus;
	segmentation: TaskStatus;
	questionGeneration: TaskStatus;
	uploadContent: TaskStatus;

	constructor() {
		this.audioExtraction = TaskStatus.WAITING;
		this.transcriptGeneration = TaskStatus.PENDING;
		this.segmentation = TaskStatus.PENDING;
		this.questionGeneration = TaskStatus.PENDING;
		this.uploadContent = TaskStatus.PENDING;
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
	uploadContent?: contentUploadData[];
}

export class JobState {
	currentTask: TaskType;
	taskStatus: TaskStatus;
	url?: string;
	parameters?: TranscriptParameters | SegmentationParameters | QuestionGenerationParameters;
	file?: string;
}