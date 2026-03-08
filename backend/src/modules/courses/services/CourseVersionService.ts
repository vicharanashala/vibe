import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import {
  CohortsResponse,
  CourseVersionWatchTimeResponse,
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
  courseVersionStatus,
  ICourse,
  ICourseVersion,
  IItemRepository,
  ProctoringComponent,
  ProgressRepository,
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
import {
  CourseSetting,
  CreateCourseSettingBody,
} from '#root/modules/setting/index.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import {
  QuestionBankRepository,
  QuestionRepository,
} from '#root/modules/quizzes/repositories/index.js';
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
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,
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
        {...newVersion, courseId: new ObjectId(newVersion.courseId)},
        // body.cohorts,
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
          seekForwardEnabled: false,
        },
      };
      const courseSettings = new CourseSetting(defaultSettingsPayload);
      course.versions.push(new ObjectId(createdVersion._id));
      course.updatedAt = new Date();
      const settingsPromise = this.settingsRepo.createCourseSettings(
        courseSettings,
        txnSession,
      );
      const updatedPromise = this.courseRepo.update(
        courseId,
        course,
        txnSession,
      );
      await Promise.all([updatedPromise, settingsPromise]);
      return newVersion;
    };

    // If session provided, use it; otherwise wrap in a new transaction
    return session ? run(session) : this._withTransaction(run);
  }

  public async readCourseVersion(
    courseVersionId: string,
    userId: string,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const readVersion = await this.courseRepo.getActiveVersion(
        courseVersionId,
        session,
      );
      if (!readVersion) {
        throw new InternalServerError('Failed to read course version.');
      }
      if (readVersion.cohorts?.length) {
        const cohorts = await this.courseRepo.getCohortsByIds(
          readVersion.cohorts,
          undefined,
          session,
        );

        for (const cohort of cohorts) {
          if (!readVersion.cohorts.some(id => id.toString() === cohort._id.toString())) {
            throw new InternalServerError(
              `Cohort ID ${cohort._id} not referenced in course version ${courseVersionId}`
            );
          }
        }
        (readVersion as any).cohortDetails  = cohorts.map(cohort => ({
          id: cohort._id.toString(),
          name: cohort.name,
          createdAt: cohort.createdAt,
          updatedAt: cohort.updatedAt
        }));
      }

      // console.log("Read course version:", readVersion);
      const courseId = readVersion.courseId.toString();

      const enrollment =
        await this.enrollmentService.getUserEnrollmentsByCourseVersion(
          userId,
          courseId,
          courseVersionId,
        );

      if (!enrollment) {
        throw new NotFoundError(
          'Enrollment not found for the user in this course version',
        );
      }

      if (enrollment.role === 'STUDENT') {
        // filter out hidden modules for students and include only visible sections
        readVersion.modules = readVersion.modules
          .filter(module => !module.isHidden)
          .map(module => {
            const visibleSections = module.sections.filter(
              section => !section.isHidden,
            );
            return { ...module, sections: visibleSections };
          });
      }

      const version = instanceToPlain(
        Object.assign(new CourseVersion(), readVersion),
      ) as CourseVersion;

      return version;
    });
  }

  public async getCohortsByVersion(
    courseVersionId: string,
    skip?: number,
    limit?: number,
    search?: string,
    sortBy?: "name" | "createdAt" | "updatedAt",
    sortOrder?: "asc" | "desc"
  ):Promise<CohortsResponse>{
    const  courseVersion = await this.courseRepo.readVersion(
      courseVersionId
    );
    if(!courseVersion.cohorts || courseVersion.cohorts.length == 0){
        const cohortDetails: CohortsResponse = {
        version: courseVersion.version,
      };
      return cohortDetails;
    }
    const cohorts = 
    await this.courseRepo.getCohortsByIds(
      courseVersion.cohorts,{ search, sortBy, sortOrder, skip, limit }
    );


    const cohortDetails: CohortsResponse = {
      cohorts: cohorts.map(cohort => ({
        id: cohort._id.toString(),
        name: cohort.name,
        createdAt: cohort.createdAt,
        updatedAt: cohort.updatedAt
      })),
      version: courseVersion.version,
    };

    return cohortDetails;

    // let filtered = cohorts;

    // // search filter
    // if (search && search.trim() !== "") {
    //   const searchLower = search.toLowerCase();
    //   filtered = filtered.filter(c =>
    //     c.name.toLowerCase().includes(searchLower)
    //   );
    // }

    // // sorting
    // filtered.sort((a, b) => {
    //   let aVal: any = a[sortBy];
    //   let bVal: any = b[sortBy];
    //   if (sortBy !== "name") {
    //     aVal = new Date(aVal).getTime();
    //     bVal = new Date(bVal).getTime();
    //   }
    //   if (sortOrder === "asc") {
    //     return aVal > bVal ? 1 : -1;
    //   }
    //   return aVal < bVal ? 1 : -1;
    // });

    // // pagination
    // const paginated = filtered.slice(skip, skip + limit);

    // const cohortDetails: CohortsResponse = {
    //   cohorts: paginated.map(cohort => ({
    //     id: cohort._id.toString(),
    //     name: cohort.name,
    //     createdAt: cohort.createdAt,
    //     updatedAt: cohort.updatedAt
    //   })),
    //   version: courseVersion.version,
    // };

    // return cohortDetails;
  }


  public async updateCohortInCourseVersion(cohortId: string, cohortName: string): Promise<boolean>{
    return this._withTransaction(async session => {
      const existingCohort = await this.courseRepo.getCohortsByIds(Array.of(new ObjectId(cohortId)),undefined, session);
      if(!existingCohort){
        throw new NotFoundError("Cohort Id doesn't exist");
      }
      return await this.courseRepo.modifyCohortById(new ObjectId(cohortId), cohortName, session);
    });
  }

  public async deleteCohortInCourseVersion(versionId: string, cohortId: string):Promise<boolean>{
    return this._withTransaction(async session => {
      const existingCohort = await this.courseRepo.getCohortsByIds(Array.of(new ObjectId(cohortId)), undefined, session);
      if(!existingCohort){
        throw new NotFoundError("Cohort Id doesn't exist");
      }
      const enrollmentExists = await this.enrollmentService.enrollmentExists(versionId, cohortId, session);
      if(enrollmentExists){
        throw new BadRequestError("Students are already enrolled in this cohort, can't delete");
      }
      await this.courseRepo.deleteCohortById(cohortId, session);
      return await this.courseRepo.removeCohortFromVersion(versionId, cohortId, session);
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
      // Handle supportLink - allow setting, updating, or clearing
      if (body.supportLink !== undefined) existingVersion.supportLink = body.supportLink;
      existingVersion.updatedAt = new Date();
      if(body.cohorts){
        const cohortIds = await this.courseRepo.createCohorts(
          courseVersionId,
          body.cohorts,
          session
        );
        // console.log("--cohortIds--",cohortIds);
        if (!existingVersion.cohorts) {
          existingVersion.cohorts = [];
        }
        const existing = new Set(existingVersion.cohorts.map(id => id.toString()));
        for (const id of cohortIds) {
          if (!existing.has(id.toString())) {
            existingVersion.cohorts.push(id);
          }
        }
      }

// console.log("Updating course version with data:", existingVersion, body);
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
    try {
      if (!courseId || !courseVersionId) {
        throw new BadRequestError('Invalid courseId or courseVersionId');
      }

      const [existingVersion, existingCourse] = await Promise.all([
        this.courseRepo.readVersion(courseVersionId),
        this.courseRepo.read(courseId),
      ]);

      if (!existingVersion) {
        throw new NotFoundError(`Course version ${courseVersionId} not found`);
      }
      if (!existingCourse) {
        throw new NotFoundError(`Course ${courseId} not found`);
      }

      const newCourse = await this.courseRepo.create({
        name: getCopyCourseName(existingCourse.name),
        description: existingCourse.description,
        instructors: existingCourse.instructors,
        versions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newCourseVersion = await this.courseRepo.createVersion({
        courseId: new ObjectId(newCourse._id.toString()),
        version: existingVersion.version,
        description: existingVersion.description,
        supportLink: existingVersion.supportLink,
        totalItems: existingVersion.totalItems,
        modules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newVersionId = newCourseVersion._id.toString();

      const USE_WORKERS = false;

      let newModules: Module[];
      let existingEnrollments;

      const cloneStartTime = Date.now();
      console.log(`\n=== Course Clone Started ===`);
      console.log(`Started at: ${new Date().toISOString()}`);
      console.log(`Source Course: ${existingCourse.name}`);
      console.log(`Modules to clone: ${existingVersion.modules.length}`);

      if (USE_WORKERS) {
        const { startCourseCloneProcessing } = await import('#root/workers/clone-course.pool.js');

        [newModules, existingEnrollments] = await Promise.all([
          startCourseCloneProcessing(
            existingVersion.modules as Module[],
            newVersionId,
            newCourse._id.toString(),
          ),
          this.enrollmentService.getNonStudentEnrollmentsByCourseVersion(
            courseId,
            courseVersionId,
          ),
        ]);
      } else {
        [newModules, existingEnrollments] = await Promise.all([
          cloneModules(
            existingVersion.modules as Module[],
            newVersionId,
            this.itemRepo,
            this.questionBankRepo,
            this.questionRepository,
            newCourse._id.toString(),
          ),
          this.enrollmentService.getNonStudentEnrollmentsByCourseVersion(
            courseId,
            courseVersionId,
          ),
        ]);
      }

      const cloneEndTime = Date.now();
      const durationMs = cloneEndTime - cloneStartTime;
      const durationSec = (durationMs / 1000).toFixed(2);

      const totalSections = newModules.reduce((sum, mod) => sum + mod.sections.length, 0);
      const totalItemGroups = newModules.reduce(
        (sum, mod) => sum + mod.sections.reduce((s, sec) => s + (sec.itemsGroupId ? 1 : 0), 0),
        0,
      );

      let totalItems = 0;
      for (const module of newModules) {
        for (const section of module.sections) {
          if (section.itemsGroupId) {
            try {
              const itemsGroup = await this.itemRepo.readItemsGroup(section.itemsGroupId.toString());
              if (itemsGroup?.items) {
                totalItems += itemsGroup.items.length;
              }
            } catch (error) {
              console.error(`Error reading items group ${section.itemsGroupId}:`, error);
            }
          }
        }
      }

      console.log(`\n=== Course Clone Completed ===`);
      console.log(`Finished at: ${new Date().toISOString()}`);
      console.log(`Duration: ${durationMs}ms (${durationSec}s)`);
      console.log(`Summary:`);
      console.log(`  - Modules cloned: ${newModules.length}`);
      console.log(`  - Sections cloned: ${totalSections}`);
      console.log(`  - Item groups cloned: ${totalItemGroups}`);
      console.log(`  - Items cloned: ${totalItems}`);
      console.log(`  - New course: ${newCourse.name}`);
      console.log(`=============================\n`);

      await this.courseRepo.addModulesToVersion(newVersionId, newModules);

      await this.courseRepo.addNewCourseVersionToCourse(
        newCourse._id.toString(),
        newVersionId,
      );

      if (existingEnrollments?.length) {
        await this.enrollmentService.bulkEnrollUsers(
          existingEnrollments.map(e => ({
            userId: e.userId.toString(),
            role: e.role,
          })),
          newCourse._id.toString(),
          newVersionId,
        );
      }

      const defaultSettingsPayload: CreateCourseSettingBody = {
        courseId: newCourse._id.toString(),
        courseVersionId: newVersionId,
        settings: {
          proctors: {
            detectors: Object.values(ProctoringComponent).map(detector => ({
              detectorName: detector,
              settings: { enabled: false, options: {} },
            })),
          },
          linearProgressionEnabled: false,
          seekForwardEnabled: false,
        },
      };
      const courseSettings = new CourseSetting(defaultSettingsPayload);
      await this.settingsRepo.createCourseSettings(courseSettings);

      return true;
    } catch (err) {
      console.error('Failed to copy course version:', err);
      return false;
    }
  }

  async getCourseVersionTotalWatchTime(
    courseId: string,
    versionId: string,
  ): Promise<CourseVersionWatchTimeResponse> {
    const totalWatchTime = await this.progressRepository.getCourseVersionTotalWatchTime(courseId, versionId);
    if (totalWatchTime === null) {
      throw new NotFoundError('Course version not found');
    }
    const courseVersion = await this.courseRepo.readVersion(versionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }
    const course = await this.courseRepo.read(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    const response = new CourseVersionWatchTimeResponse();
    response.totalSeconds = totalWatchTime;
    response.message = `Watch time fetched successfully for course "${course.name}" version "${courseVersion.version}".`;
    return response;
  }

  async updateCourseVersionStatus(versionId:string,versionStatus:courseVersionStatus):Promise<ICourseVersion|null>{
    return this._withTransaction(async session => {
      const result = await this.courseRepo.updateCourseVersionStatus(
        versionId,
        versionStatus,
        session
      );
      return result;
    });
  }
}
