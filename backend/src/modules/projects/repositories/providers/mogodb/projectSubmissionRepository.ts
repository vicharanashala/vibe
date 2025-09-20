import {IProjectSubmissionRepository} from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import {ClientSession, Collection} from 'mongodb';
import {IProjectSubmission, IProjectSubmissionWithUser} from '../../model.js';
import {inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {ID, MongoDatabase} from '#root/shared/index.js';
import {SubmitProjectBody} from '#root/modules/projects/classes/validators/ProjectValidators.js';

export class projectSubmissionRepository
  implements IProjectSubmissionRepository
{
  private _projectSubmissionCollection: Collection<IProjectSubmission>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}
  private async init() {
    this._projectSubmissionCollection =
      await this.db.getCollection<IProjectSubmission>('project_submissions');
  }

  async getAllSubmissions(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IProjectSubmissionWithUser[]> {
    await this.init();

    const submissions = await this._projectSubmissionCollection
      .aggregate(
        [
          {$match: {courseId, courseVersionId}},
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {$unwind: {path: '$userInfo', preserveNullAndEmptyArrays: true}},
          {
            $project: {
              _id: 0,
              submissionURL: 1,
              comment: 1,
              createdAt: 1,
              userInfo: 1,
            },
          },
        ],
        {session},
      )
      .toArray();

    return submissions as IProjectSubmissionWithUser[];
  }

  async create(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    userId: string,
    body: SubmitProjectBody,
    session?: ClientSession,
  ): Promise<ID> {
    await this.init();
    const data: IProjectSubmission = {
      projectId,
      userId,
      courseId,
      courseVersionId,
      submissionURL: body.submissionURL,
      comment: body.comment,
      createdAt: new Date(),
    };

    const result = await this._projectSubmissionCollection.insertOne(data, {
      session,
    });
    return result.insertedId;
  }
}
