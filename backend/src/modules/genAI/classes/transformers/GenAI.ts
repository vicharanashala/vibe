import { ID } from "#root/shared/index.js";
import { aiConfig } from "#root/config/ai.js";

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
  CONCEPT_MAP = 'CONCEPT_MAP',
  QUESTION_GENERATION = 'QUESTION_GENERATION',
  UPLOAD_CONTENT = 'UPLOAD_CONTENT'
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

export interface TranscriptParameters {
	language?: LanguageType;
	modelSize?: string;
}

export interface SegmentationParameters {
	lam?: number;
	runs?: number;
	noiseId?: number;
}

export interface ConceptMapParameters {
	/** Upper bound on extracted concepts (validation caps at 25 regardless). */
	maxConcepts?: number;
	/** Optional extra guidance appended to the extraction prompt. */
	promptHint?: string;
}

export interface QuestionGenerationParameters {
	model?: string;
	SOL?: number;
	SML?: number;
	NAT?: number;
	DES?: number;
	BIN?: number;
	prompt?: string;
	smartBloom?: {
		enabled?: boolean;
		segmentationStrategy?: 'DEFAULT' | 'CONCEPT_END';
		distribution?: {
			knowledge: number;
			understanding: number;
			application: number;
			analysis?: number;
			evaluation?: number;
			creation?: number;
		};
	};
}

export interface UploadParameters {
	courseId: string;
	versionId: string;
	moduleId?: string;
	sectionId?: string;
	videoItemBaseName?: string;
	quizItemBaseName?: string;
	questionsPerQuiz?: number;
	smartBloomEnabled?: boolean;
	questions?: any[];
}

export interface audioData {
	status: TaskStatus;
	error?: string;
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
	segmentationMap: Array<number>;
	transcriptFileUrl?: string;
	newParameters?: SegmentationParameters;
}

export interface questionGenerationData {
	status: TaskStatus;
	error?: string;
	fileName?: string;
	fileUrl?: string;
	segmentMapUsed: Array<number>;
	newParameters?: QuestionGenerationParameters;
}

export interface contentUploadData {
	status: TaskStatus;
	error?: string;
}

export interface ConceptMapNodeData {
	/** Stable node id (unique within the map). */
	id: string;
	label: string;
	description?: string;
	/**
	 * Anchor: the end-boundary value of the segment where this concept is
	 * taught (same convention as questions[].segmentId). Resolved to a
	 * video item at UPLOAD_CONTENT time.
	 */
	segmentEnd: number;
}

export interface ConceptMapEdgeData {
	/** Prerequisite: `from` must be understood before `to`. */
	from: string;
	to: string;
}

export interface conceptMapData {
	status: TaskStatus;
	error?: string;
	nodes?: ConceptMapNodeData[];
	edges?: ConceptMapEdgeData[];
	modelUsed?: string;
	/** True when produced by the deterministic no-LLM fallback. */
	fallback?: boolean;
	newParameters?: ConceptMapParameters;
}

export class JobStatus {
	audioExtraction: TaskStatus;
	transcriptGeneration: TaskStatus;
	segmentation: TaskStatus;
	/**
	 * Absent on jobs created before the concept-map feature (or with
	 * CONCEPT_MAP_ENABLED=false). `undefined` means the task is not part of
	 * this job and every consumer must skip it — do not default it.
	 */
	conceptMap?: TaskStatus;
	questionGeneration: TaskStatus;
	uploadContent: TaskStatus;

	constructor() {
		this.audioExtraction = TaskStatus.WAITING;
		this.transcriptGeneration = TaskStatus.PENDING;
		this.segmentation = TaskStatus.PENDING;
		if (aiConfig.CONCEPT_MAP_ENABLED) {
			this.conceptMap = TaskStatus.PENDING;
		}
		this.questionGeneration = TaskStatus.PENDING;
		this.uploadContent = TaskStatus.PENDING;
	}
}

export class GenAI {
	type: JobType;
	url: string;
	transcriptParameters?: TranscriptParameters;
	segmentationParameters?: SegmentationParameters;
	conceptMapParameters?: ConceptMapParameters;
	questionGenerationParameters?: QuestionGenerationParameters;
	uploadParameters: UploadParameters;
}

export class GenAIBody extends GenAI {
	_id?: ID;
	userId: ID;
	audioProvided?: boolean;
	transcriptProvided?: boolean;
	createdAt: Date;
	jobStatus: JobStatus;
}

export class TaskData {
	_id?: ID;
	jobId: ID;
	audioExtraction?: audioData[];
	transcriptGeneration?: trascriptGenerationData[]
	segmentation?: segmentationData[];
	conceptMap?: conceptMapData[];
	questionGeneration?: questionGenerationData[];
	uploadContent?: contentUploadData[];
}

export class JobState {
	currentTask: TaskType;
	taskStatus: TaskStatus;
	url?: string;
	parameters?: TranscriptParameters | SegmentationParameters | ConceptMapParameters | QuestionGenerationParameters | UploadParameters;
	file?: string;
	segmentMap?: Array<number>;
}