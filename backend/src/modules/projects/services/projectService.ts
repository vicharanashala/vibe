import {
  BaseService,
  ICourseRepository,
  MongoDatabase,
} from '#root/shared/index.js';
import {inject, injectable} from 'inversify';
import {PROJECTS_TYPES} from '../types.js';
import {database} from 'firebase-admin';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  SubmissionResponse,
  SubmitProjectBody,
} from '../classes/validators/ProjectValidators.js';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {IProjectSubmission} from '../repositories/model.js';
import {IProjectSubmissionRepository} from '../interfaces/IProjectSubmissionRepository.js';

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
    body: SubmitProjectBody,
  ): Promise<void> {
    try {
      return this._withTransaction(async session => {
        const isVersionExist = await this.courseRepo.readVersion(
          versionId,
          session,
        );
        if (!isVersionExist)
          throw new NotFoundError(`Failed to find course version`);

        const insertedId = await this._projectSubmissionRepository.create(
          projectId,
          courseId,
          versionId,
          userId,
          body,
          session,
        );
        if (!insertedId)
          throw new InternalServerError(
            `Failed to create submission, try again!`,
          );
      });
    } catch (error) {
      throw new InternalServerError(`Failed to submit project /More: ${error}`);
    }
  }

  getSubmissions(
    userId: string,
    courseId: string,
    versionId: string,
  ): Promise<SubmissionResponse[]> {
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
