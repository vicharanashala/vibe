import {describe, it, expect, vi, beforeEach} from 'vitest';

const axiosGet = vi.fn();
vi.mock('axios', () => ({
  default: {get: (...args: unknown[]) => axiosGet(...args)},
}));

const {GenAIService} = await import('../services/GenAIService.js');

const ID = 'dQw4w9WgXcQ';
const URL_A = `https://www.youtube.com/watch?v=${ID}&t=42s`;

/** Minimal MongoDatabase stand-in: _withTransaction only needs a session. */
const fakeDb = {
  getClient: async () => ({
    startSession: () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: async () => undefined,
      inTransaction: () => false,
    }),
  }),
};

function job(id: string, courseId = 'course-1', versionId = 'v1') {
  return {
    _id: id,
    url: URL_A,
    uploadParameters: {courseId, versionId},
  };
}

function makeService(opts: {
  jobs: ReturnType<typeof job>[];
  taskDataByJobId: Record<string, unknown>;
}) {
  const repo = {
    findRecentByVideoKey: vi.fn(async () => opts.jobs),
    getTaskDataByJobId: vi.fn(async (jobId: string) =>
      opts.taskDataByJobId[jobId] ?? null,
    ),
  };
  const service = new (GenAIService as any)(
    null, // webhookService
    repo, // genAIRepository
    null, // itemService
    null, // questionBankService
    null, // questionService
    null, // quizService
    fakeDb, // mongoDatabase
    null, // cloudStorageService
    null, // storage
  );
  return {service, repo};
}

const allowAll = () => true;

beforeEach(() => {
  axiosGet.mockReset();
});

describe('getVideoSnapPoints', () => {
  it('rejects a url it cannot identify, rather than searching for nothing', async () => {
    const {service} = makeService({jobs: [], taskDataByJobId: {}});
    await expect(
      service.getVideoSnapPoints('https://vimeo.com/123', allowAll),
    ).rejects.toThrow(/could not identify a video/i);
  });

  it('looks the job up by normalised key, not the raw url', async () => {
    const {service, repo} = makeService({jobs: [], taskDataByJobId: {}});
    await service.getVideoSnapPoints(URL_A, allowAll);
    expect(repo.findRecentByVideoKey).toHaveBeenCalledWith(
      `yt:${ID}`,
      10,
      expect.anything(),
    );
  });

  it('reports NO_JOB for a video that never went through the AI workflow', async () => {
    const {service} = makeService({jobs: [], taskDataByJobId: {}});
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result).toMatchObject({
      status: 'NO_JOB',
      jobId: null,
      videoKey: `yt:${ID}`,
      segmentBoundaries: [],
      chunks: [],
    });
  });

  it('reports NO_ACCESS when every candidate job is on a course the caller cannot read', async () => {
    const {service} = makeService({
      jobs: [job('job-1', 'other-course')],
      taskDataByJobId: {},
    });
    const denyOtherCourse = (courseId?: string) => courseId === 'course-1';
    const result = await service.getVideoSnapPoints(URL_A, denyOtherCourse);
    expect(result.status).toBe('NO_ACCESS');
    // Existence of a job on someone else's course is not disclosed.
    expect(result.jobId).toBeNull();
  });

  it('reports PENDING when a readable job exists but has produced nothing yet', async () => {
    const {service} = makeService({
      jobs: [job('job-1')],
      taskDataByJobId: {
        'job-1': {segmentation: [], transcriptGeneration: []},
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result).toMatchObject({status: 'PENDING', jobId: 'job-1'});
  });

  it('skips a newer empty job in favour of an older one that has data', async () => {
    // The common real case: a failed or aborted re-run sitting on top of a
    // good job. Taking the newest blindly would report PENDING forever.
    axiosGet.mockResolvedValue({data: {chunks: []}});
    const {service} = makeService({
      jobs: [job('newer-failed'), job('older-good')],
      taskDataByJobId: {
        'newer-failed': {segmentation: [], transcriptGeneration: []},
        'older-good': {
          segmentation: [{segmentationMap: [0, 42, 118]}],
          transcriptGeneration: [],
        },
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result.status).toBe('READY');
    expect(result.jobId).toBe('older-good');
    expect(result.segmentBoundaries).toEqual([0, 42, 118]);
  });

  it('takes the last re-run of a task, and sorts and de-duplicates boundaries', async () => {
    const {service} = makeService({
      jobs: [job('job-1')],
      taskDataByJobId: {
        'job-1': {
          segmentation: [
            {segmentationMap: [0, 10]},
            // A re-run with different parameters supersedes the first.
            {segmentationMap: [118, 42, 42, 0, -5, Number.NaN]},
          ],
          transcriptGeneration: [],
        },
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result.segmentBoundaries).toEqual([0, 42, 118]);
  });

  it('returns transcript chunks with a null end left null', async () => {
    axiosGet.mockResolvedValue({
      data: {
        chunks: [
          {timestamp: [5, 9], text: '  second  '},
          {timestamp: [0, 5], text: 'first'},
          {timestamp: [9, null], text: 'last'},
          // No usable start — must be dropped, not read as second 0.
          {timestamp: [null, 12], text: 'no start'},
          {text: 'no timestamp at all'},
        ],
      },
    });
    const {service} = makeService({
      jobs: [job('job-1')],
      taskDataByJobId: {
        'job-1': {
          segmentation: [],
          transcriptGeneration: [{fileUrl: 'https://storage/t1.json'}],
        },
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result.status).toBe('READY');
    expect(result.chunks).toEqual([
      {start: 0, end: 5, text: 'first'},
      {start: 5, end: 9, text: 'second'},
      {start: 9, end: null, text: 'last'},
    ]);
  });

  it('parses a transcript served as a JSON string', async () => {
    axiosGet.mockResolvedValue({
      data: JSON.stringify({chunks: [{timestamp: [0, 3], text: 'hi'}]}),
    });
    const {service} = makeService({
      jobs: [job('job-1')],
      taskDataByJobId: {
        'job-1': {
          segmentation: [],
          transcriptGeneration: [{fileUrl: 'https://storage/t2.json'}],
        },
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result.chunks).toEqual([{start: 0, end: 3, text: 'hi'}]);
  });

  it('still returns boundaries when the transcript download fails', async () => {
    // Losing snap text must not cost the teacher the ability to edit timestamps.
    axiosGet.mockRejectedValue(new Error('403 from storage'));
    const {service} = makeService({
      jobs: [job('job-1')],
      taskDataByJobId: {
        'job-1': {
          segmentation: [{segmentationMap: [0, 30]}],
          transcriptGeneration: [{fileUrl: 'https://storage/missing.json'}],
        },
      },
    });
    const result = await service.getVideoSnapPoints(URL_A, allowAll);
    expect(result.status).toBe('READY');
    expect(result.segmentBoundaries).toEqual([0, 30]);
    expect(result.chunks).toEqual([]);
  });

  it('caches a transcript by url so repeated opens do not refetch', async () => {
    axiosGet.mockResolvedValue({
      data: {chunks: [{timestamp: [0, 3], text: 'cached'}]},
    });
    const taskDataByJobId = {
      'job-1': {
        segmentation: [],
        transcriptGeneration: [{fileUrl: 'https://storage/cache-me.json'}],
      },
    };
    const {service} = makeService({jobs: [job('job-1')], taskDataByJobId});

    await service.getVideoSnapPoints(URL_A, allowAll);
    await service.getVideoSnapPoints(URL_A, allowAll);

    expect(axiosGet).toHaveBeenCalledTimes(1);
  });
});
