import { IProjectSubmissionRepository } from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { IProjectSubmission, IProjectSubmissionWithUser } from '../../model.js';
import { inject, injectable } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import { ID, MongoDatabase } from '#root/shared/index.js';

@injectable()
export class ProjectSubmissionRepository
  implements IProjectSubmissionRepository {
  private _projectSubmissionCollection: Collection<IProjectSubmission>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }
  private async init() {
    this._projectSubmissionCollection =
      await this.db.getCollection<IProjectSubmission>('project_submissions');
  }

  async getById(
    submissionId: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null> {
    if (!ObjectId.isValid(submissionId)) {
      return null;
    }
    await this.init();
    return await this._projectSubmissionCollection.findOne(
      { _id: new ObjectId(submissionId) },
      { session },
    );
  }

  async getByUser(
    userId: string,
    versionId: string,
    courseId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null> {
    await this.init();
    return await this._projectSubmissionCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
      },
      { session },
    );
  }

  /**
   * Bug-safe student submission lookup — includes projectId in the filter.
   * getByUser() omits projectId; if a student submits to two different project items
   * in the same course version the results collide. Do NOT replace this with getByUser().
   */
  async getSubmissionByUserAndProject(
    userId: string,
    projectId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null> {
    if (
      !ObjectId.isValid(userId) ||
      !ObjectId.isValid(projectId) ||
      !ObjectId.isValid(courseId) ||
      !ObjectId.isValid(courseVersionId)
    ) {
      return null;
    }
    await this.init();
    return await this._projectSubmissionCollection.findOne(
      {
        userId: new ObjectId(userId),
        projectId: new ObjectId(projectId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        ...(cohortId && ObjectId.isValid(cohortId)
          ? { cohortId: new ObjectId(cohortId) }
          : {}),
      },
      { session },
    );
  }

  async getAllSubmissions(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmissionWithUser> {
    await this.init();

    const matchStage: any = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    };

    // Add cohort filter if cohortId is provided
    if (cohortId) {
      matchStage.cohortId = new ObjectId(cohortId);
    }

    const submissions = await this._projectSubmissionCollection
      .aggregate(
        [
          {
            $match: matchStage,
          },

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
            $lookup: {
              from: 'cohorts',
              localField: 'cohortId',
              foreignField: '_id',
              as: 'cohort',
            },
          },

          // Join each submission's assessment (if one exists) so the PDF export
          // can include Score and Overall Feedback columns.
          {
            $lookup: {
              from: 'project_assessments',
              localField: '_id',
              foreignField: 'submissionId',
              as: 'assessmentInfo',
            },
          },

          {
            $group: {
              _id: {
                courseId: '$courseId',
                courseVersionId: '$courseVersionId',
              },
              course: { $first: '$course' },
              courseVersion: { $first: '$courseVersion' },
              cohort: { $first: '$cohort' },
              userInfo: {
                $push: {
                  submissionId: { $toString: '$_id' },
                  firstName: { $arrayElemAt: ['$userInfo.firstName', 0] },
                  lastName: { $arrayElemAt: ['$userInfo.lastName', 0] },
                  email: { $arrayElemAt: ['$userInfo.email', 0] },
                  submissionURL: '$submissionURL',
                  comment: '$comment',
                  cohortName: { $arrayElemAt: ['$cohort.name', 0] },
                  featured: { $ifNull: ['$featured', false] },
                  // Assessment fields — undefined/null when no assessment exists
                  assessmentTotalPoints: { $arrayElemAt: ['$assessmentInfo.totalPoints', 0] },
                  assessmentMaxPoints: { $arrayElemAt: ['$assessmentInfo.maxPoints', 0] },
                  assessmentPercentage: { $arrayElemAt: ['$assessmentInfo.percentage', 0] },
                  assessmentOverallFeedback: { $arrayElemAt: ['$assessmentInfo.overallFeedback', 0] },
                  assessmentCriteria: { $arrayElemAt: ['$assessmentInfo.criteria', 0] },
                },
              },
            },
          },

          {
            $project: {
              _id: 0,
              course: { name: { $arrayElemAt: ['$course.name', 0] } },
              courseVersion: {
                name: { $arrayElemAt: ['$courseVersion.version', 0] },
              },
              userInfo: 1,
            },
          },
        ],
        { session },
      )
      .toArray();

    if (!submissions || submissions.length === 0) {
      return {
        course: { name: '' },
        courseVersion: { name: '' },
        userInfo: [],
      } as IProjectSubmissionWithUser;
    }

    return submissions[0] as IProjectSubmissionWithUser;
  }

  async create(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    userId: string,
    submissionURL: string,
    comment: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<ID> {
    await this.init();
    const result = await this._projectSubmissionCollection.insertOne(
      {
        projectId: new ObjectId(projectId),
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        submissionURL,
        comment,
        createdAt: new Date(),
        featured: false,
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
      },
      { session },
    );
    return result.insertedId;
  }

  async update(
    submissionId: string,
    submissionURL: string,
    comment: string,
    session?: ClientSession,
  ): Promise<ID> {
    await this.init();
    const result = await this._projectSubmissionCollection.findOneAndUpdate(
      {
        _id: new ObjectId(submissionId),
      },
      {
        $set: {
          submissionURL,
          comment,
          updatedAt: new Date(),
        },
      },
      {
        session,
        returnDocument: 'after',
        projection: { _id: 1 }
      },
    );

    if (!result) {
      throw new Error(`Project submission with ID ${submissionId} not found`);
    }
    return result._id;
  }

  async deleteByUserAndVersion(
    userId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this._projectSubmissionCollection.deleteMany(
      {
        userId: new ObjectId(userId),
        courseVersionId: new ObjectId(courseVersionId),
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
      },
      { session },
    );
    return result.deletedCount > 0;
  }

  async deleteProjectSubmissionByVersionId(
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this._projectSubmissionCollection.deleteMany(
      {
        courseVersionId: new ObjectId(versionId),
      },
      { session },
    );
    return result.deletedCount > 0;
  }

  async setFeatured(
    submissionId: string,
    featured: boolean,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null> {
    if (!ObjectId.isValid(submissionId)) {
      return null;
    }
    await this.init();
    const result = await this._projectSubmissionCollection.findOneAndUpdate(
      { _id: new ObjectId(submissionId) },
      { $set: { featured, updatedAt: new Date() } },
      { session, returnDocument: 'after' },
    );
    return result || null;
  }

  async getFeaturedSubmissions(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission[]> {
    await this.init();
    const filter: Record<string, unknown> = {
      projectId: new ObjectId(projectId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      featured: true,
    };
    if (cohortId) {
      filter.cohortId = new ObjectId(cohortId);
    }
    return await this._projectSubmissionCollection
      .find(filter, { session })
      .toArray();
  }
}
