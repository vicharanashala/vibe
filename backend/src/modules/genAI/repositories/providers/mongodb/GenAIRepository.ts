import {
  JobStatus,
  GenAIBody,
  TaskData,
  TaskStatus,
} from '#root/modules/genAI/classes/transformers/GenAI.js';
import {JobBody} from '#root/modules/genAI/classes/validators/GenAIValidators.js';
import {MongoDatabase} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';

@injectable()
export class GenAIRepository {
  private genAICollection: Collection<GenAIBody>;
  private taskDataCollection: Collection<TaskData>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  async init() {
    this.genAICollection = await this.db.getCollection<GenAIBody>('genAI_jobs');
    this.taskDataCollection = await this.db.getCollection<TaskData>(
      'job_task_status',
    );
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
    if (jobDataToSave.uploadParameters) {
      const up = jobDataToSave.uploadParameters;

      if (up.courseId) {
        up.courseId = new ObjectId(up.courseId);
      }
      if (up.versionId) {
        up.versionId = new ObjectId(up.versionId);
      }
      if (up.moduleId) {
        up.moduleId = new ObjectId(up.moduleId);
      }
      if (up.sectionId) {
        up.sectionId = new ObjectId(up.sectionId);
      }
    }
    const result = await this.genAICollection.insertOne(
      {
        userId: new ObjectId(userId),
        audioProvided: audioProvided,
        transcriptProvided: transcriptProvided,
        ...jobDataToSave,
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
    return {
      ...result,
      uploadParameters: {
        ...result.uploadParameters,
        courseId: result.uploadParameters.courseId.toString(),
        versionId: result.uploadParameters.versionId.toString(),
        moduleId: result.uploadParameters.moduleId.toString(),
        sectionId: result.uploadParameters.sectionId.toString(),
      },
    };
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

    const jobDataToSave: any = {...jobData};

    if (jobDataToSave.uploadParameters) {
      jobDataToSave.uploadParameters = {
        ...jobDataToSave.uploadParameters,
        courseId: jobDataToSave.uploadParameters.courseId
          ? new ObjectId(
              jobDataToSave.uploadParameters.courseId.toString() as string,
            )
          : undefined,
        versionId: jobDataToSave.uploadParameters.versionId
          ? new ObjectId(
              jobDataToSave.uploadParameters.versionId.toString() as string,
            )
          : undefined,
        moduleId: jobDataToSave.uploadParameters.moduleId
          ? new ObjectId(
              jobDataToSave.uploadParameters.moduleId.toString() as string,
            )
          : undefined,
        sectionId: jobDataToSave.uploadParameters.sectionId
          ? new ObjectId(
              jobDataToSave.uploadParameters.sectionId.toString() as string,
            )
          : undefined,
      };
    }

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

    return results.map(doc => {
      const upload = doc.uploadParameters;

      return {
        ...doc,
        uploadParameters: upload
          ? {
              ...upload,
              courseId: upload.courseId?.toString(),
              versionId: upload.versionId?.toString(),
              moduleId: upload.moduleId?.toString(),
              sectionId: upload.sectionId?.toString(),
            }
          : null,
      };
    }) as GenAIBody[];
  }

  async bulkConvertIds(batchSize = 500): Promise<{updated: number}> {
    try {
      await this.init();

      const cursor = this.genAICollection.find(
        {},
        {
          projection: {
            _id: 1,
            userId: 1,
            uploadParameters: 1,
          },
        },
      );

      let bulkOps: any[] = [];
      let totalUpdated = 0;

      while (await cursor.hasNext()) {
        const job = await cursor.next();
        if (!job) continue;

        const updateFields: Record<string, any> = {};

        if (job.userId && typeof job.userId === 'string') {
          updateFields.userId = new ObjectId(job.userId);
        }

        if (job.uploadParameters) {
          const updatedUploadParams = {...job.uploadParameters};
          let changed = false;

          if (
            updatedUploadParams.courseId &&
            typeof updatedUploadParams.courseId === 'string'
          ) {
            updatedUploadParams.courseId = new ObjectId(
              updatedUploadParams.courseId,
            );
            changed = true;
          }

          if (
            updatedUploadParams.versionId &&
            typeof updatedUploadParams.versionId === 'string'
          ) {
            updatedUploadParams.versionId = new ObjectId(
              updatedUploadParams.versionId,
            );
            changed = true;
          }

          if (
            updatedUploadParams.moduleId &&
            typeof updatedUploadParams.moduleId === 'string'
          ) {
            updatedUploadParams.moduleId = new ObjectId(
              updatedUploadParams.moduleId,
            );
            changed = true;
          }

          if (
            updatedUploadParams.sectionId &&
            typeof updatedUploadParams.sectionId === 'string'
          ) {
            updatedUploadParams.sectionId = new ObjectId(
              updatedUploadParams.sectionId,
            );
            changed = true;
          }

          if (changed) {
            updateFields.uploadParameters = updatedUploadParams;
          }
        }

        if (Object.keys(updateFields).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: {_id: job._id},
              update: {$set: updateFields},
            },
          });
        }

        if (bulkOps.length >= batchSize) {
          const result = await this.genAICollection.bulkWrite(bulkOps);
          totalUpdated += result.modifiedCount;
          bulkOps = [];
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.genAICollection.bulkWrite(bulkOps);
        totalUpdated += result.modifiedCount;
      }

      return {updated: totalUpdated};
    } catch (error) {
      throw new InternalServerError(`Failed update. More/ ${error}`);
    }
  }

  async bulkConvertTaskIds(batchSize = 500): Promise<{updated: number}> {
    try {
      await this.init();

      const cursor = this.taskDataCollection.find(
        {},
        {
          projection: {_id: 1, jobId: 1},
        },
      );

      let bulkOps: any[] = [];
      let totalUpdated = 0;

      while (await cursor.hasNext()) {
        const task = await cursor.next();
        if (!task) continue;

        const updateFields: Record<string, any> = {};

        if (task.jobId && typeof task.jobId === 'string') {
          updateFields.jobId = new ObjectId(task.jobId);
        }

        if (Object.keys(updateFields).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: {_id: task._id},
              update: {$set: updateFields},
            },
          });
        }

        if (bulkOps.length >= batchSize) {
          const result = await this.taskDataCollection.bulkWrite(bulkOps);
          totalUpdated += result.modifiedCount;
          bulkOps = [];
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.taskDataCollection.bulkWrite(bulkOps);
        totalUpdated += result.modifiedCount;
      }

      return {updated: totalUpdated};
    } catch (error) {
      throw new InternalServerError(
        `Failed job_task_status ID conversion. More/ ${error}`,
      );
    }
  }
}
