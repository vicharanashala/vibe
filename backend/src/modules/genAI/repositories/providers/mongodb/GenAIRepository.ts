import { JobStatus, GenAIBody, TaskData } from "#root/modules/genAI/classes/transformers/GenAI.js";
import { JobBody } from "#root/modules/genAI/classes/validators/GenAIValidators.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

@injectable()
export class GenAIRepository {
	private genAICollection: Collection<GenAIBody>;
	private taskDataCollection: Collection<TaskData>;

	constructor(
		@inject(GLOBAL_TYPES.Database)
		private db: MongoDatabase,
	){}

	async init() {
		this.genAICollection = await this.db.getCollection<GenAIBody>("genAI_jobs");
		this.taskDataCollection = await this.db.getCollection<TaskData>('job_task_status')
	}

	async save(userId: string, jobData: JobBody, session?:ClientSession): Promise<string> {
		await this.init();
		const result = await this.genAICollection.insertOne(
			{
				userId: userId,
				...jobData,
				createdAt: new Date(),
				jobStatus: new JobStatus(),
			}
			, { session }
		);
		return result?.insertedId.toString();
	}

	async createTaskData(jobId: string, session?: ClientSession): Promise<string> {
		await this.init();
		const result = await this.taskDataCollection.insertOne(
			{ jobId: jobId }, { session }
		)
		return result?.insertedId.toString();
	}

	async getById(jobId: string, session: ClientSession): Promise<GenAIBody> {
		await this.init();
		const result = await this.genAICollection.findOne(
			{
				_id: new ObjectId(jobId)
			},
			{ session }
		)
		return result;
	}

	async getTaskDataByJobId(jobId: string, session?: ClientSession): Promise<TaskData> {
		await this.init();
		const result = await this.taskDataCollection.findOne(
			{ jobId: jobId },
			{ session }
		);
		return result;
	}

	async update(jobId: string, jobData: Partial<JobBody>, session?: ClientSession): Promise<GenAIBody> {
		await this.init();
		const result = await this.genAICollection.findOneAndUpdate(
			{
				_id: new ObjectId(jobId)
			},
			{ $set: jobData },
			{
				returnDocument: 'after',
				session
			}
		);
		return result;
	}

	async updateTaskData(jobId: string, taskData: Partial<TaskData>, session?: ClientSession): Promise<TaskData> {
		await this.init();
		const result = await this.taskDataCollection.findOneAndUpdate(
			{ jobId: jobId },
			{ $set: taskData },
			{
				returnDocument: 'after',
				session
			}
		);
		return result;
	}

	async getAllByUserId(userId: string, session?: ClientSession): Promise<GenAIBody[]> {
		await this.init();
		const results = await this.genAICollection.find(
			{ userId },
			{ session }
		).toArray();
		return results;
	}
}