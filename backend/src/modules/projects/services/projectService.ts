import {
  BaseService,
  ICourseRepository,
  ID,
  MongoDatabase,
} from '#root/shared/index.js';
import { inject, injectable } from 'inversify';
import { PROJECTS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { SubmissionResponse } from '../classes/validators/ProjectValidators.js';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { IProjectSubmissionRepository } from '../interfaces/index.js';

@injectable()
export class ProjectService extends BaseService {
  constructor(
    // Repository
    @inject(PROJECTS_TYPES.projectSubmissionRepository)
    private readonly _projectSubmissionRepository: IProjectSubmissionRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    // Data base
    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,
  ) {
    super(database);
  }

  submitProject(
    projectId: string,
    userId: string,
    courseId: string,
    versionId: string,
    submissionURL: string,
    comment: string,
  ): Promise<ID> {
    try {
      return this._withTransaction(async session => {
        const isVersionExist = await this.courseRepo.readVersion(
          versionId,
          session,
        );
        if (!isVersionExist)
          throw new NotFoundError(`Failed to find course version`);
        const existingSubmission = 
        await this._projectSubmissionRepository.getByUser(
          userId,
          versionId,
          courseId,
          session,
        );

        if (existingSubmission) {
          // Update existing submission
          const result = await this._projectSubmissionRepository.update(
            existingSubmission._id.toString(),
            submissionURL,
            comment,
            session,
          );

          if (!result)
            throw new InternalServerError(
              `Failed to update submission, try again!`,
            );
          return result;

        } else {
          const insertedId = await this._projectSubmissionRepository.create(
            projectId,
            courseId,
            versionId,
            userId,
            submissionURL,
            comment,
            session,
          );
          if (!insertedId)
            throw new InternalServerError(
              `Failed to create submission, try again!`,
            );
          return insertedId;
        }
      });
    } catch (error) {
      throw new InternalServerError(`Failed to submit project /More: ${error}`);
    }
  }

  getSubmissions(
    courseId: string,
    versionId: string,
  ): Promise<SubmissionResponse> {
    try {
      return this._withTransaction(async session => {
        const isVersionExist = await this.courseRepo.readVersion(
          versionId,
          session,
        );
        if (!isVersionExist)
          throw new NotFoundError(`Failed to find course version`);

        const submissions =
          await this._projectSubmissionRepository.getAllSubmissions(
            courseId,
            versionId,
          );
        return submissions;
      });
    } catch (error) {
      throw new InternalServerError(`Failed to get projects /More: ${error}`);
    }
  }
}
