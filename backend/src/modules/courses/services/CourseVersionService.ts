import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import {
  CreateCourseVersionBody,
  UpdateCourseVersionBody,
} from '#courses/classes/validators/CourseVersionValidators.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { instanceToPlain } from 'class-transformer';
import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import {
  NotFoundError,
  InternalServerError,
  BadRequestError,
} from 'routing-controllers';
import { Course, Module } from '../classes/index.js';
import {
  EnrollmentRole,
  ICourse,
  ICourseVersion,
  IItemRepository,
  ProctoringComponent,
  SettingRepository,
} from '#root/shared/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { COURSES_TYPES } from '../types.js';
import { ModuleService } from './ModuleService.js';
import { SectionService } from './SectionService.js';
import { ItemService } from './ItemService.js';
import { cloneModules } from '../utils/cloneModules.js';
import { getCopyCourseName } from '../utils/getCopyCourseName.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { CourseSetting, CreateCourseSettingBody } from '#root/modules/setting/index.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { QuestionBankRepository, QuestionRepository } from '#root/modules/quizzes/repositories/index.js';
@injectable()
export class CourseVersionService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(COURSES_TYPES.ModuleService)
    private service: ModuleService,
    @inject(COURSES_TYPES.SectionService)
    private readonly sectionService: SectionService,
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(SETTING_TYPES.SettingRepo)
    private readonly settingsRepo: SettingRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepository: QuestionRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepo: QuestionBankRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async createCourseVersion(
    courseId: string,
    body: CreateCourseVersionBody,
    session?: ClientSession,
  ): Promise<CourseVersion> {
    const run = async (txnSession: ClientSession) => {
      if (!courseId) {
        throw new NotFoundError('Course id not found');
      }

      const course = await this.courseRepo.read(courseId, txnSession);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      let newVersion = new CourseVersion(body);
      newVersion.courseId = new ObjectId(courseId);

      const createdVersion = await this.courseRepo.createVersion(
        newVersion,
        txnSession,
      );
      if (!createdVersion) {
        throw new InternalServerError('Failed to create course version.');
      }

      newVersion = instanceToPlain(
        Object.assign(new CourseVersion(), createdVersion),
      ) as CourseVersion;
      const defaultSettingsPayload: CreateCourseSettingBody = {
        courseId,
        courseVersionId: createdVersion._id as string,
        settings: {
          proctors: {
            detectors: Object.values(ProctoringComponent).map(detector => ({
              detectorName: detector,
              settings: { enabled: false, options: {} },
            })),
          },
          linearProgressionEnabled: false,
        },
      };
      const courseSettings = new CourseSetting(defaultSettingsPayload);
      course.versions.push(new ObjectId(createdVersion._id));
      course.updatedAt = new Date();
      const settingsPromise = this.settingsRepo.createCourseSettings(courseSettings, txnSession);
      const updatedPromise = this.courseRepo.update(
        courseId,
        course,
        txnSession,
      );
      await Promise.all([updatedPromise, settingsPromise])
      return newVersion;
    };

    // If session provided, use it; otherwise wrap in a new transaction
    return session ? run(session) : this._withTransaction(run);
  }

  public async readCourseVersion(
    courseVersionId: string,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const readVersion = await this.courseRepo.getActiveVersion(
        courseVersionId,
        session,
      );
      if (!readVersion) {
        throw new InternalServerError('Failed to read course version.');
      }

      const version = instanceToPlain(
        Object.assign(new CourseVersion(), readVersion),
      ) as CourseVersion;

      return version;
    });
  }

  public async updateCourseVersion(
    courseVersionId: string,
    body: UpdateCourseVersionBody,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const existingVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!existingVersion) {
        throw new NotFoundError('Course version not found');
      }

      if (body.version) existingVersion.version = body.version;
      if (body.description) existingVersion.description = body.description;
      existingVersion.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        courseVersionId,
        existingVersion,
        session,
      );

      if (!updatedVersion) {
        throw new InternalServerError('Failed to update course version');
      }

      const version = instanceToPlain(
        Object.assign(new CourseVersion(), updatedVersion),
      ) as CourseVersion;

      return version;
    });
  }

  public async deleteCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<Boolean> {
    return this._withTransaction(async session => {
      const readCourseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!readCourseVersion) {
        throw new InternalServerError(
          'Failed to update course with new version.',
        );
      }

      const course = await this.courseRepo.read(courseId);
      if (!course) {
        throw new NotFoundError(`Course with ID ${courseId} not found.`);
      }

      const versionsCount = course.versions.length;
      if (versionsCount === 1) {
        const results = await this.courseRepo.delete(courseId, session);
        return true;
      }

      const itemGroupsIds = readCourseVersion.modules.flatMap(module =>
        module.sections.map(section => new ObjectId(section.itemsGroupId)),
      );

      const versionDeleteResult = await this.courseRepo.deleteVersion(
        courseId,
        courseVersionId,
        itemGroupsIds,
        session,
      );
      if (versionDeleteResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to delete course version');
      }
      return true;
    });
  }

  async copyCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      try {
        //1 Validate Inputs
        if (
          !courseId ||
          typeof courseId !== 'string' ||
          !courseVersionId ||
          typeof courseVersionId !== 'string'
        ) {
          throw new BadRequestError(
            `Invalid courseId (${courseId}) or courseVersionId (${courseVersionId})`,
          );
        }

        //2 Fetch existing course version
        const existingVersion = await this.courseRepo.readVersion(
          courseVersionId,
          session,
        );
        if (!existingVersion) {
          throw new NotFoundError(
            `Course version ${courseVersionId} not found`,
          );
        }

        //3 Fetch existing course
        const existingCourse = await this.courseRepo.read(courseId, session);
        if (!existingCourse) {
          throw new NotFoundError(`Course ${courseId} not found`);
        }

        //4 Create a new course record
        if (!existingCourse.name || !existingCourse.description) {
          throw new BadRequestError(
            'Existing course missing name or description',
          );
        }
        const newCourseData: ICourse = {
          name: getCopyCourseName(existingCourse.name),
          description: existingCourse.description,
          instructors: existingCourse.instructors,
          versions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const newCourse = await this.courseRepo.create(newCourseData, session);
        if (!newCourse) {
          throw new InternalServerError('Failed to create new course');
        }

        //5 Create a new course version record
        if (!existingVersion.version || !existingVersion.description) {
          throw new BadRequestError(
            'Existing version missing version number or description',
          );
        }
        const newCourseVersionData: ICourseVersion = {
          courseId: new ObjectId(newCourse._id.toString()),
          version: existingVersion.version,
          description: existingVersion.description,
          totalItems: existingVersion.totalItems,
          modules: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const newCourseVersion = await this.courseRepo.createVersion(
          newCourseVersionData,
          session,
        );
        if (!newCourseVersion) {
          throw new InternalServerError('Failed to create new course version');
        }

        //6 Clone modules and attach to new version
        const currentModules = existingVersion.modules as Module[];
        if (!Array.isArray(currentModules)) {
          throw new BadRequestError('Existing version modules are invalid');
        }
        const newVersionIdStr = newCourseVersion._id.toString();
        const itemRepo = this.itemRepo;
        const questionBankRepo = this.questionBankRepo;
        const questionRepo = this.questionRepository;

        const newModules = await cloneModules(
          currentModules,
          courseVersionId,
          itemRepo,
          questionBankRepo,
          questionRepo,
          newCourse._id.toString(),
          session,
        );
        await this.courseRepo.addModulesToVersion(
          newVersionIdStr,
          newModules,
          session,
        );

        //7 Add new version to new course
        const added = await this.courseRepo.addNewCourseVersionToCourse(
          newCourse._id.toString(),
          newCourseVersion._id.toString(),
          session,
        );
        if (!added) {
          throw new InternalServerError(
            'Failed to attach new version to course',
          );
        }

        //8 Copy non-student enrollments to the new version
        const existingEnrollments =
          await this.enrollmentService.getNonStudentEnrollmentsByCourseVersion(
            courseId,
            courseVersionId,
          );
        if (existingEnrollments?.length) {
          const enrollmentsToCopy = existingEnrollments.map(enrollment => ({
            userId: enrollment.userId.toString(),
            role: enrollment.role,
          }));
          await this.enrollmentService.bulkEnrollUsers(
            enrollmentsToCopy,
            newCourse._id.toString(),
            newCourseVersion._id.toString(),
            session,
          );
        }

        //9 Return success
        return true;
      } catch (error) {
        //10 Log and return failure
        console.error('Failed to copy course version:', error);
        return false;
      }
    });
  }
}
