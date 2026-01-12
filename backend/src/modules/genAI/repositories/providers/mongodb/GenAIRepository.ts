<<<<<<< HEAD
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
=======
import { JobStatus, GenAIBody, TaskData, TaskStatus } from "#root/modules/genAI/classes/transformers/GenAI.js";
import { JobBody } from "#root/modules/genAI/classes/validators/GenAIValidators.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";
>>>>>>> ca8a90da6b5f90465f01bfc8ac57bc4d8c9dee0d

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

<<<<<<< HEAD
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
=======
	async save(userId: string, jobData: JobBody, audioProvided?: boolean, transcriptProvided?: boolean, session?:ClientSession): Promise<string> {
		await this.init();
		const jobStatus = new JobStatus();
		const jobDataToSave = { ...jobData };
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
		const result = await this.genAICollection.insertOne(
			{
				userId: userId,
				audioProvided: audioProvided,
				transcriptProvided: transcriptProvided,
				...jobDataToSave,
				createdAt: new Date(),
				jobStatus: jobStatus,
			}
			, { session }
		);
		return result.insertedId?.toString();
	}
>>>>>>> ca8a90da6b5f90465f01bfc8ac57bc4d8c9dee0d

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

<<<<<<< HEAD
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
=======
	async createTaskDataWithAudio(jobId: string, audioName: string, audioUrl: string, session?: ClientSession): Promise<string> {
		await this.init();
		const result = await this.taskDataCollection.insertOne(
			{ 
				jobId: jobId,
				audioExtraction: [{
					status: TaskStatus.COMPLETED,
					fileName: audioName,
					fileUrl: audioUrl
				}]
			}, 
			{ session }
		);
		return result.insertedId?.toString();
	}

	async createTaskDataWithTranscript(jobId: string, fileName: string, url: string, session?: ClientSession): Promise<string> {
		await this.init();
		const result = await this.taskDataCollection.insertOne(
			{ 
				jobId: jobId,
				transcriptGeneration: [{
					status: TaskStatus.COMPLETED,
					fileName: fileName,
					fileUrl: url
				}]
			}, 
			{ session }
		);
		return result.insertedId?.toString();
	}

	async getById(jobId: string, session: ClientSession): Promise<GenAIBody> {
		await this.init();
		const result = await this.genAICollection.findOne(
			{
				_id: new ObjectId(jobId),
			},
			{ session }
		)
		return result;
	}
>>>>>>> ca8a90da6b5f90465f01bfc8ac57bc4d8c9dee0d

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
}
