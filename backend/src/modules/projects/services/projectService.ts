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
import { ForbiddenError, InternalServerError, NotFoundError } from 'routing-controllers';
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
    cohortId?: string,
  ): Promise<ID> {
    try {
      return this._withTransaction(async session => {
        const isVersionExist = await this.courseRepo.readVersion(
          versionId,
          session,
        );
        const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
      
        if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is inactive, you can't access items");
        }
        if (!isVersionExist)
          throw new NotFoundError(`Failed to find course version`);
        const existingSubmission = 
        await this._projectSubmissionRepository.getByUser(
          userId,
          versionId,
          courseId,
          cohortId,
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
            cohortId,
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
    cohortId?: string,
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
            cohortId,
          );
        return submissions;
      });
    } catch (error) {
      throw new InternalServerError(`Failed to get projects /More: ${error}`);
    }
  }
}
