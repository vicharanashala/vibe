import {
  JobStatus,
  GenAIBody,
  TaskData,
  TaskStatus,
} from '#root/modules/genAI/classes/transformers/GenAI.js';
import {JobBody} from '#root/modules/genAI/classes/validators/GenAIValidators.js';
import {extractVideoKey} from '#root/modules/genAI/utils/videoKey.js';
import {MongoDatabase} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';

@injectable()
export class GenAIRepository {
  private genAICollection: Collection<GenAIBody>;
  private taskDataCollection: Collection<TaskData>;
  /**
   * `init()` runs on every call below, so index creation is guarded — otherwise
   * each request pays an extra round trip to re-declare an index that already
   * exists.
   */
  private indexesEnsured = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  async init() {
    this.genAICollection = await this.db.getCollection<GenAIBody>('genAI_jobs');
    this.taskDataCollection = await this.db.getCollection<TaskData>(
      'job_task_status',
    );

    if (!this.indexesEnsured) {
      // Sorted descending on createdAt so "latest job for this video" is served
      // straight from the index.
      await this.genAICollection.createIndex({videoKey: 1, createdAt: -1});
      this.indexesEnsured = true;
    }
  }

  async save(
    userId: string,
    jobData: JobBody,
    audioProvided?: boolean,
    transcriptProvided?: boolean,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const jobStatus = new JobStatus();
    const jobDataToSave = {...jobData};
    if (audioProvided) {
      jobStatus.audioExtraction = TaskStatus.COMPLETED;
      jobStatus.transcriptGeneration = TaskStatus.WAITING;
    }
    if (transcriptProvided) {
      jobStatus.audioExtraction = TaskStatus.COMPLETED;
      jobStatus.transcriptGeneration = TaskStatus.COMPLETED;
      jobStatus.segmentation = TaskStatus.WAITING;
      delete jobDataToSave.transcript;
    }
    // Derived from the job's own url, so the two can never drift apart.
    const videoKey = extractVideoKey(jobDataToSave.url);
    const result = await this.genAICollection.insertOne(
      {
        userId: new ObjectId(userId),
        audioProvided: audioProvided,
        transcriptProvided: transcriptProvided,
        ...jobDataToSave,
        ...(videoKey ? {videoKey} : {}),
        createdAt: new Date(),
        jobStatus: jobStatus,
      },
      {session},
    );
    return result.insertedId?.toString();
  }

  async createTaskData(
    jobId: string,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const normalizedJobId = ObjectId.isValid(jobId)
      ? new ObjectId(jobId)
      : jobId;
    const result = await this.taskDataCollection.insertOne(
      {jobId: normalizedJobId},
      {session},
    );
    // const result = await this.taskDataCollection.insertOne(
    //   {jobId: new ObjectId(jobId)},
    //   {session},
    // );
    return result.insertedId?.toString();
  }

  async createTaskDataWithAudio(
    jobId: string,
    audioName: string,
    audioUrl: string,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const normalizedJobId = ObjectId.isValid(jobId)
      ? new ObjectId(jobId)
      : jobId;
    const result = await this.taskDataCollection.insertOne(
      {
        jobId: normalizedJobId,
        audioExtraction: [
          {
            status: TaskStatus.COMPLETED,
            fileName: audioName,
            fileUrl: audioUrl,
          },
        ],
      },
      {session},
    );
    // const result = await this.taskDataCollection.insertOne(
    //   {
    //     jobId: new ObjectId(jobId),
    //     audioExtraction: [
    //       {
    //         status: TaskStatus.COMPLETED,
    //         fileName: audioName,
    //         fileUrl: audioUrl,
    //       },
    //     ],
    //   },
    //   {session},
    // );
    return result.insertedId?.toString();
  }

  async createTaskDataWithTranscript(
    jobId: string,
    fileName: string,
    url: string,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const normalizedJobId = ObjectId.isValid(jobId)
      ? new ObjectId(jobId)
      : jobId;

    const result = await this.taskDataCollection.insertOne(
      {
        jobId: normalizedJobId,
        transcriptGeneration: [
          {
            status: TaskStatus.COMPLETED,
            fileName: fileName,
            fileUrl: url,
          },
        ],
      },
      {session},
    );
    // const result = await this.taskDataCollection.insertOne(
    //   {
    //     jobId: new ObjectId(jobId),
    //     transcriptGeneration: [
    //       {
    //         status: TaskStatus.COMPLETED,
    //         fileName: fileName,
    //         fileUrl: url,
    //       },
    //     ],
    //   },
    //   {session},
    // );
    return result.insertedId?.toString();
  }

  async getById(jobId: string, session: ClientSession): Promise<GenAIBody> {
    await this.init();
    const result = await this.genAICollection.findOne(
      {
        _id: new ObjectId(jobId),
      },
      {session},
    );
    return result;
  }

  async getTaskDataByJobId(
    jobId: string,
    session?: ClientSession,
  ): Promise<TaskData> {
    await this.init();
    const query = {
      $or: [{jobId: jobId}, {jobId: new ObjectId(jobId)}],
    };

    const result = await this.taskDataCollection.findOne(query, {session});
    // const result = await this.taskDataCollection.findOne(
    //   {jobId: new ObjectId(jobId)},
    //   {session},
    // );
    return result;
  }

  async update(
    jobId: string,
    jobData: Partial<JobBody>,
    session?: ClientSession,
  ): Promise<GenAIBody> {
    await this.init();
    const result = await this.genAICollection.findOneAndUpdate(
      {
        _id: new ObjectId(jobId),
      },
      {$set: jobData},
      {
        returnDocument: 'after',
        session,
      },
    );
    return result;
  }

  async updateTaskData(
    jobId: string,
    taskData: Partial<TaskData>,
    session?: ClientSession,
  ): Promise<TaskData> {
    await this.init();
    const query = {
      $or: [{jobId: jobId}, {jobId: new ObjectId(jobId)}],
    };

    const result = await this.taskDataCollection.findOneAndUpdate(
      query,
      {$set: taskData},
      {
        returnDocument: 'after',
        session,
      },
    );
    // const result = await this.taskDataCollection.findOneAndUpdate(
    //   {jobId: new ObjectId(jobId)},
    //   {$set: taskData},
    //   {
    //     returnDocument: 'after',
    //     session,
    //   },
    // );
    return result;
  }

  async getAllByUserId(
    userId: string,
    session?: ClientSession,
  ): Promise<GenAIBody[]> {
    await this.init();
    const query = {
      $or: [{userId: userId}, {userId: new ObjectId(userId)}],
    };

    const results = await this.genAICollection.find(query, {session}).toArray();
    // const results = await this.genAICollection
    //   .find({userId: new ObjectId(userId)}, {session})
    //   .toArray();
    return results;
  }

  /**
   * Jobs run against one video, newest first.
   *
   * Returns several rather than just the newest because the caller has two
   * filters to apply that this layer cannot: whether the requester may read the
   * job's course, and whether the job actually produced a transcript. The most
   * recent job is often a failed or aborted re-run sitting on top of a good one.
   */
  async findRecentByVideoKey(
    videoKey: string,
    limit = 10,
    session?: ClientSession,
  ): Promise<GenAIBody[]> {
    await this.init();

    const indexed = await this.genAICollection
      .find({videoKey}, {session})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
    if (indexed.length > 0) return indexed;

    /*
     * Fallback for jobs written before `videoKey` existed. A YouTube id is
     * `[\w-]{11}`, so it needs no regex escaping, but this is a collection scan
     * — acceptable only because it is bounded by the small `genAI_jobs`
     * collection and disappears per-video once the backfill script has run.
     */
    const id = videoKey.startsWith('yt:') ? videoKey.slice(3) : null;
    if (!id) return [];

    return this.genAICollection
      .find({videoKey: {$exists: false}, url: {$regex: id}}, {session})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }
}
