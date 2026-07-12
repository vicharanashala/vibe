import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenAIService } from '../services/GenAIService.js';
import {
  JobStatus,
  TaskStatus,
  TaskType,
} from '../classes/transformers/GenAI.js';
import { aiConfig } from '#root/config/ai.js';

// ---------------------------------------------------------------------------
// Task-flow tests for the CONCEPT_MAP pipeline stage: continue-chain order,
// the legacy-job skip rule (jobStatus.conceptMap === undefined), the
// CONCEPT_MAP_ENABLED kill switch, and the backend-executed dispatch (the
// task must never be forwarded to the webhook/AI-server path).
// ---------------------------------------------------------------------------

const SEGMENT_MAP = [60, 120, 180];
const TRANSCRIPT_URL = 'http://localhost:9090/transcript.json?jobId=j1';

/** In-memory MongoDatabase stand-in so _withTransaction runs the callback. */
const fakeDb = {
  getClient: async () => ({
    startSession: () => ({
      startTransaction() {},
      async commitTransaction() {},
      async abortTransaction() {},
      async endSession() {},
      inTransaction: () => false,
    }),
  }),
} as any;

/** A job whose pipeline has advanced through segmentation. */
function makeJob(overrides: Partial<Record<keyof JobStatus, TaskStatus>> & { legacy?: boolean } = {}) {
  const { legacy, ...statusOverrides } = overrides;
  const jobStatus: any = {
    audioExtraction: TaskStatus.COMPLETED,
    transcriptGeneration: TaskStatus.COMPLETED,
    segmentation: TaskStatus.COMPLETED,
    questionGeneration: TaskStatus.PENDING,
    uploadContent: TaskStatus.PENDING,
  };
  if (!legacy) {
    jobStatus.conceptMap = TaskStatus.PENDING;
  }
  Object.assign(jobStatus, statusOverrides);
  return {
    _id: 'j1',
    userId: 'u1',
    url: 'https://youtu.be/x',
    jobStatus,
    uploadParameters: { courseId: 'c1', versionId: 'v1' },
    segmentationParameters: undefined,
    conceptMapParameters: undefined,
    questionGenerationParameters: undefined,
  } as any;
}

function makeTaskData() {
  return {
    _id: 't1',
    jobId: 'j1',
    audioExtraction: [{ status: TaskStatus.COMPLETED, fileUrl: 'http://x/audio.wav' }],
    transcriptGeneration: [{ status: TaskStatus.COMPLETED, fileUrl: 'http://x/tr.json' }],
    segmentation: [
      {
        status: TaskStatus.COMPLETED,
        transcriptFileUrl: TRANSCRIPT_URL,
        segmentationMap: SEGMENT_MAP,
      },
    ],
    questionGeneration: [
      { status: TaskStatus.COMPLETED, fileUrl: 'http://x/q.json', segmentMapUsed: SEGMENT_MAP },
    ],
  } as any;
}

function makeService(job: any, taskData: any) {
  const repo = {
    getById: vi.fn(async () => job),
    getTaskDataByJobId: vi.fn(async () => taskData),
    update: vi.fn(async (_id: string, j: any) => j),
    updateTaskData: vi.fn(async (_id: string, t: any) => t),
  };
  const webhookService = {
    approveTaskStart: vi.fn(async () => ({ message: 'webhook' })),
    rerunTask: vi.fn(async () => ({ message: 'webhook-rerun' })),
  };
  const conceptMapService = {
    fetchTranscriptChunks: vi.fn(async () => [
      { text: 'chunk one', timestamp: [0, 60] },
      { text: 'chunk two', timestamp: [60, 120] },
      { text: 'chunk three', timestamp: [120, 180] },
    ]),
    generate: vi.fn(async () => ({
      status: TaskStatus.COMPLETED,
      nodes: [{ id: 'c1', label: 'Concept', segmentEnd: 60 }],
      edges: [],
      fallback: true,
    })),
  };
  const service = new GenAIService(
    webhookService as any,
    conceptMapService as any,
    {} as any, // conceptMapRepository (publish path not under test here)
    repo as any,
    {} as any, // itemService
    {} as any, // questionBankService
    {} as any, // questionService
    {} as any, // quizService
    fakeDb,
    {} as any, // cloudStorageService
    {} as any, // storage (skip the GCS default)
  );
  return { service, repo, webhookService, conceptMapService };
}

describe('JobStatus construction (kill switch)', () => {
  const original = aiConfig.CONCEPT_MAP_ENABLED;
  afterEach(() => {
    aiConfig.CONCEPT_MAP_ENABLED = original;
  });

  it('includes conceptMap: PENDING when the feature is enabled', () => {
    aiConfig.CONCEPT_MAP_ENABLED = true;
    expect(new JobStatus().conceptMap).toBe(TaskStatus.PENDING);
  });

  it('omits the field entirely when CONCEPT_MAP_ENABLED=false', () => {
    aiConfig.CONCEPT_MAP_ENABLED = false;
    const status = new JobStatus();
    expect(status.conceptMap).toBeUndefined();
    expect('conceptMap' in status).toBe(false);
  });
});

describe('approveTaskContinue chain order', () => {
  it('segmentation COMPLETED → conceptMap WAITING on new jobs (questions untouched)', async () => {
    const job = makeJob();
    const { service } = makeService(job, makeTaskData());
    await service.approveTaskContinue('j1');
    expect(job.jobStatus.conceptMap).toBe(TaskStatus.WAITING);
    expect(job.jobStatus.questionGeneration).toBe(TaskStatus.PENDING);
  });

  it('segmentation COMPLETED → questionGeneration WAITING on legacy jobs (no field added)', async () => {
    const job = makeJob({ legacy: true });
    const { service } = makeService(job, makeTaskData());
    await service.approveTaskContinue('j1');
    expect(job.jobStatus.questionGeneration).toBe(TaskStatus.WAITING);
    expect('conceptMap' in job.jobStatus).toBe(false);
  });

  it('conceptMap COMPLETED → questionGeneration WAITING', async () => {
    const job = makeJob({ conceptMap: TaskStatus.COMPLETED });
    const { service } = makeService(job, makeTaskData());
    await service.approveTaskContinue('j1');
    expect(job.jobStatus.questionGeneration).toBe(TaskStatus.WAITING);
  });

  it('is idempotent while conceptMap is WAITING (UI may re-continue)', async () => {
    const job = makeJob({ conceptMap: TaskStatus.WAITING });
    const { service } = makeService(job, makeTaskData());
    await service.approveTaskContinue('j1');
    expect(job.jobStatus.conceptMap).toBe(TaskStatus.WAITING);
    expect(job.jobStatus.questionGeneration).toBe(TaskStatus.PENDING);
  });
});

describe('getJobState task resolution', () => {
  it('resolves CONCEPT_MAP as current task when its status is WAITING', async () => {
    const job = makeJob({ conceptMap: TaskStatus.WAITING });
    const { service } = makeService(job, makeTaskData());
    const state = await service.getJobState('j1');
    expect(state.currentTask).toBe(TaskType.CONCEPT_MAP);
    expect(state.taskStatus).toBe(TaskStatus.WAITING);
    expect(state.file).toBe(TRANSCRIPT_URL);
    expect(state.segmentMap).toEqual(SEGMENT_MAP);
  });

  it('legacy jobs skip CONCEPT_MAP in the task cascade', async () => {
    const job = makeJob({ legacy: true, questionGeneration: TaskStatus.WAITING });
    const { service } = makeService(job, makeTaskData());
    const state = await service.getJobState('j1');
    // A WAITING webhook task resolves to the previous completed task (its
    // outputs are the inputs the AI server starts the next task from). The
    // point here: CONCEPT_MAP never appears in a legacy job's cascade.
    expect(state.currentTask).toBe(TaskType.SEGMENTATION);
    expect(state.currentTask).not.toBe(TaskType.CONCEPT_MAP);
  });

  it('legacy jobs reach UPLOAD_CONTENT with the field absent', async () => {
    const job = makeJob({
      legacy: true,
      questionGeneration: TaskStatus.COMPLETED,
      uploadContent: TaskStatus.WAITING,
    });
    const { service } = makeService(job, makeTaskData());
    const state = await service.getJobState('j1');
    expect(state.currentTask).toBe(TaskType.UPLOAD_CONTENT);
  });

  it('new jobs reach UPLOAD_CONTENT once conceptMap is COMPLETED', async () => {
    const job = makeJob({
      conceptMap: TaskStatus.COMPLETED,
      questionGeneration: TaskStatus.COMPLETED,
      uploadContent: TaskStatus.WAITING,
    });
    const { service } = makeService(job, makeTaskData());
    const state = await service.getJobState('j1');
    expect(state.currentTask).toBe(TaskType.UPLOAD_CONTENT);
  });

  it('a PENDING conceptMap does not hijack the current task', async () => {
    const job = makeJob({ segmentation: TaskStatus.WAITING });
    const { service } = makeService(job, makeTaskData());
    const state = await service.getJobState('j1');
    // Same WAITING convention as above: segmentation WAITING resolves to
    // TRANSCRIPT_GENERATION. What matters is that the PENDING conceptMap
    // field is never picked up as the current task.
    expect(state.currentTask).toBe(TaskType.TRANSCRIPT_GENERATION);
    expect(state.currentTask).not.toBe(TaskType.CONCEPT_MAP);
  });
});

describe('approveTaskToStart dispatch for CONCEPT_MAP', () => {
  it('runs the task in the backend and never calls the webhook path', async () => {
    const job = makeJob({ conceptMap: TaskStatus.WAITING });
    const taskData = makeTaskData();
    const { service, webhookService, conceptMapService } = makeService(job, taskData);

    const result = await service.approveTaskToStart('j1', 'u1');

    expect(webhookService.approveTaskStart).not.toHaveBeenCalled();
    expect(conceptMapService.generate).toHaveBeenCalledOnce();
    expect(job.jobStatus.conceptMap).toBe(TaskStatus.COMPLETED);
    expect(taskData.conceptMap).toHaveLength(1);
    expect(taskData.conceptMap[0].nodes).toHaveLength(1);
    expect(result?.data?.status).toBe(TaskStatus.COMPLETED);
  });

  it('stores FAILED (instead of throwing) when generation errors', async () => {
    const job = makeJob({ conceptMap: TaskStatus.WAITING });
    const taskData = makeTaskData();
    const { service, conceptMapService } = makeService(job, taskData);
    conceptMapService.generate.mockRejectedValueOnce(new Error('llm exploded'));

    await service.approveTaskToStart('j1', 'u1');

    expect(job.jobStatus.conceptMap).toBe(TaskStatus.FAILED);
    expect(taskData.conceptMap[0].status).toBe(TaskStatus.FAILED);
    expect(taskData.conceptMap[0].error).toContain('llm exploded');
  });

  it('other tasks still go through the webhook path', async () => {
    const job = makeJob({
      segmentation: TaskStatus.WAITING,
      conceptMap: TaskStatus.PENDING,
    });
    const { service, webhookService, conceptMapService } = makeService(job, makeTaskData());

    await service.approveTaskToStart('j1', 'u1');

    expect(webhookService.approveTaskStart).toHaveBeenCalledOnce();
    expect(conceptMapService.generate).not.toHaveBeenCalled();
  });
});

describe('rerunTask dispatch for CONCEPT_MAP', () => {
  it('reruns in the backend (appending a run) and never calls the webhook path', async () => {
    const job = makeJob({ conceptMap: TaskStatus.COMPLETED });
    const taskData = makeTaskData();
    taskData.conceptMap = [
      { status: TaskStatus.COMPLETED, nodes: [], edges: [], fallback: true },
    ];
    const { service, webhookService, conceptMapService } = makeService(job, taskData);

    await service.rerunTask('j1', 'u1', 0);

    expect(webhookService.rerunTask).not.toHaveBeenCalled();
    expect(conceptMapService.generate).toHaveBeenCalledOnce();
    expect(taskData.conceptMap).toHaveLength(2);
  });
});
