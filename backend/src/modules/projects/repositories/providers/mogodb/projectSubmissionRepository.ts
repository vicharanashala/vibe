import {IProjectSubmissionRepository} from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import {ClientSession, Collection} from 'mongodb';
import {IProjectSubmission, IProjectSubmissionWithUser} from '../../model.js';
import {inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {ID, MongoDatabase} from '#root/shared/index.js';

export class ProjectSubmissionRepository
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
  ): Promise<IProjectSubmissionWithUser> {
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

          {
            $lookup: {
              from: 'newCourse',
              localField: 'courseId',
              foreignField: '_id',
              as: 'course',
            },
          },

          {
            $lookup: {
              from: 'newCourseVersion',
              localField: 'courseVersionId',
              foreignField: '_id',
              as: 'courseVersion',
            },
          },

          {
            $group: {
              _id: {
                courseId: '$courseId',
                courseVersionId: '$courseVersionId',
              },
              course: {$first: '$course'},
              courseVersion: {$first: '$courseVersion'},
              userInfo: {
                $push: {
                  firstName: {$arrayElemAt: ['$userInfo.firstName', 0]},
                  lastName: {$arrayElemAt: ['$userInfo.lastName', 0]},
                  email: {$arrayElemAt: ['$userInfo.email', 0]},
                  submissionURL: '$submissionURL',
                  comment: '$comment',
                },
              },
            },
          },

          {
            $project: {
              _id: 0,
              course: {name: {$arrayElemAt: ['$course.name', 0]}},
              courseVersion: {name: {$arrayElemAt: ['$courseVersion.name', 0]}},
              userInfo: 1,
            },
          },
        ],
        {session},
      )
      .toArray();

    return submissions[0] as IProjectSubmissionWithUser;
  }

  async create(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    userId: string,
    submissionURL: string,
    comment: string,
    session?: ClientSession,
  ): Promise<ID> {
    await this.init();
    const data: IProjectSubmission = {
      projectId,
      userId,
      courseId,
      courseVersionId,
      submissionURL,
      comment,
      createdAt: new Date(),
    };

    const result = await this._projectSubmissionCollection.insertOne(data, {
      session,
    });
    return result.insertedId;
  }
}
