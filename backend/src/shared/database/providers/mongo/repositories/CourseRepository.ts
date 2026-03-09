import { GLOBAL_TYPES } from '#root/types.js';
import { ICourseRepository } from '#shared/database/interfaces/ICourseRepository.js';
import {
  courseVersionStatus,
  ICohort,
  ICourse,
  ICourseVersion,
  ID,
  IEnrollment,
  IItemGroupInfo,
  IModule,
  ItemType,
  IWatchTime,
} from '#shared/interfaces/models.js';
import { instanceToPlain } from 'class-transformer';
import { injectable, inject } from 'inversify';
import {
  Collection,
  MongoClient,
  ClientSession,
  ObjectId,
  UpdateResult,
} from 'mongodb';
import { NotFoundError, InternalServerError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { Course } from '#courses/classes/transformers/Course.js';
import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import { ItemsGroup } from '#courses/classes/transformers/Item.js';
import { ProgressRepository } from './ProgressRepository.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { Module } from '#root/modules/courses/classes/index.js';
import { EnrollmentRepository } from './EnrollmentRepository.js';
import {
  ANOMALIES_TYPES,
  AnomalyRepository,
} from '#root/modules/anomalies/index.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { COURSE_REGISTRATION_TYPES } from '#root/modules/courseRegistration/types.js';
import { ICourseRegistrationRepository } from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';
import { InviteRepository } from '#shared/database/providers/mongo/repositories/InviteRepository.js';
import { PROJECTS_TYPES } from '#root/modules/projects/types.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { REPORT_TYPES } from '#root/modules/reports/types.js';
import { QuestionBankRepository } from '../../../../../modules/quizzes/repositories/providers/mongodb/QuestionBankRepository.js';
import { ReportRepository } from '#root/modules/reports/repositories/index.js';
import { Invite } from '#root/modules/notifications/classes/transformers/Invite.js';
import { IQuestionBank } from '#root/shared/interfaces/quiz.js';
import { IProjectSubmissionRepository } from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import { ISettingRepository } from '#root/shared/database/interfaces/ISettingRepository.js';
import { NOTIFICATIONS_TYPES } from '#root/modules/notifications/types.js';

@injectable()
export class CourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private itemsGroupCollection: Collection<ItemsGroup>;
  private enrollmentCollection: Collection<IEnrollment>;
  private inviteCollection: Collection<Invite>;
  private questionBankCollection: Collection<IQuestionBank>;
  private cohortsCollection: Collection<ICohort>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
    @inject(USERS_TYPES.ProgressRepo)
    private progressRepo: ProgressRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(ANOMALIES_TYPES.AnomalyRepository)
    private anomalyRepository: AnomalyRepository,
    @inject(SETTING_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository)
    private courseRegistrationRepo: ICourseRegistrationRepository,
    @inject(PROJECTS_TYPES.projectSubmissionRepository)
    private readonly projectSubmissionRepo: IProjectSubmissionRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepository: QuestionBankRepository,
    @inject(REPORT_TYPES.ReportRepo)
    private reportsRepository: ReportRepository,
    @inject(NOTIFICATIONS_TYPES.InviteRepo)
    private readonly inviteRepo: InviteRepository,
  ) { }

  private async init() {
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
      'newCourseVersion',
    );
    this.itemsGroupCollection = await this.db.getCollection<ItemsGroup>(
      'itemsGroup',
    );
    this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
      'enrollment',
    );

    this.courseCollection.createIndex({ versions: 1 });
    this.courseVersionCollection.createIndex({
      'modules.sections.itemsGroupId': 1,
    });

    this.itemsGroupCollection.createIndex({ 'items._id': 1 });

    this.itemsGroupCollection.createIndex({ 'items.type': 1 });

    this.cohortsCollection = await this.db.getCollection<ICohort>('cohorts');
  }

  async getDBClient(): Promise<MongoClient> {
    const client = await this.db.getClient();
    if (!client) {
      throw new Error('MongoDB client is not initialized');
    }
    return client;
  }

  async create(
    course: Course,
    session?: ClientSession,
  ): Promise<Course | null> {
    await this.init();
    const result = await this.courseCollection.insertOne(course, { session });
    if (result.acknowledged) {
      const newCourse = await this.courseCollection.findOne(
        {
          _id: result.insertedId,
        },
        { session },
      );
      return Object.assign(new Course(), newCourse) as Course;
    } else {
      return null;
    }
  }
  async read(id: string, session?: ClientSession): Promise<ICourse | null> {
    await this.init();
    const course = await this.courseCollection.findOne(
      {
        _id: new ObjectId(id),
      },
      { session },
    );
    if (course) {
      return Object.assign(new Course(), course) as Course;
    } else {
      return null;
    }
  }
  async update(
    id: string,
    course: Partial<ICourse>,
    session?: ClientSession,
  ): Promise<ICourse | null> {
    await this.init();
    await this.read(id);

    const { _id: _, ...fields } = course;
    const res = await this.courseCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: fields },
      { returnDocument: 'after', session },
    );

    if (res) {
      return Object.assign(new Course(), res) as Course;
    } else {
      return null;
    }
  }

  async delete(courseId: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    // 1. Find the Course document to retrieve its list of version IDs
    const courseDoc = await this.courseCollection.findOne(
      { _id: new ObjectId(courseId) },
      { session },
    );
    if (!courseDoc) {
      throw new NotFoundError('Course not found');
    }

    // 2. If the course has versions, delete each one:
    //    - Read raw version document from courseVersionCollection
    //    - Extract all itemsGroupId values from its modules/sections
    //    - Call deleteVersion(...) to delete the version and its items
    const versionIds: string[] = Array.isArray((courseDoc as any).versions)
      ? (courseDoc as any).versions
        .map((v: any) => v?.toString())
        .filter((id: string) => id != null && id !== '' && ObjectId.isValid(id))
      : [];

    for (const versionId of versionIds) {
      if (!ObjectId.isValid(versionId)) {
        console.warn(`Skipping invalid versionId: ${versionId}`);
        continue;
      }

      // 2a. Fetch the raw CourseVersion document
      const rawVersion = await this.courseVersionCollection.findOne(
        { _id: new ObjectId(versionId) },
        { session },
      );
      if (!rawVersion) {
        console.warn(`CourseVersion with ID ${versionId} not found, skipping`);
        continue;
      }

      // 2b. Walk through modules → sections → collect all itemsGroupId
      const itemGroupsIds: ObjectId[] = [];
      if (Array.isArray((rawVersion as any).modules)) {
        for (const mod of (rawVersion as any).modules as any[]) {
          if (Array.isArray(mod.sections)) {
            for (const sec of mod.sections as any[]) {
              if (sec.itemsGroupId && ObjectId.isValid(sec.itemsGroupId)) {
                itemGroupsIds.push(new ObjectId(sec.itemsGroupId));
              }
            }
          }
        }
      }

      // 2c. Invoke the existing deleteVersion(...) method
      await this.deleteVersion(courseId, versionId, itemGroupsIds, session);
    }

    // handled in while deleting all version of it
    // await this.enrollmentCollection.deleteMany(
    //   { courseId: new ObjectId(courseId) },
    //   { session },
    // );

    // 3. Finally, delete the Course document itself
    const deleteCourseResult = await this.courseCollection.updateOne(
      { _id: new ObjectId(courseId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );

    if (deleteCourseResult.modifiedCount !== 1) {
      throw new InternalServerError('Failed to delete course');
    }
    return true;
  }

  async getCohortsByIds(
    cohortIds: ID[],
    options?: {
      search?: string
      sortBy?: "name" | "createdAt" | "updatedAt"
      sortOrder?: "asc" | "desc"
      skip?: number
      limit?: number
    },
    session?: ClientSession,
  ): Promise<ICohort[]> {
    await this.init();
    const objectIds = cohortIds.map(id => new ObjectId(id));
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      skip = 0,
      limit = 10
    } = options || {}

    // return await this.cohortsCollection
    //   .find({ _id: { $in: objectIds } }, { session })
    //   .toArray();
    const query: any = {
    _id: { $in: objectIds }
  }

  if (search && search.trim() !== "") {
    query.name = { $regex: search, $options: "i" }
  }

  const sort: any = {
    [sortBy]: sortOrder === "asc" ? 1 : -1
  }

  return this.cohortsCollection
    .find(query, { session })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray()
  }

  async createCohorts(
    versionId: string,
    cohorts: string[],
    session?: ClientSession
  ): Promise<ObjectId[]> {

    await this.init();

    if (!cohorts?.length) return [];

    const unique = [...new Set(cohorts.map(c => c.trim()))];

    const versionObjectId = new ObjectId(versionId);

    const cohortsToInsert: ICohort[] = unique.map(name => ({
      courseVersionId: versionObjectId,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false,
    }));

    const result = await this.cohortsCollection.insertMany(
      cohortsToInsert,
      { session }
    );

    return Object.values(result.insertedIds) as ObjectId[];
  }

  async addCohortsToVersion(
    versionId: string,
    cohortIds: ObjectId[],
    session?: ClientSession
  ):Promise<boolean> {
    await this.init();
    try{
      await this.courseVersionCollection.updateOne(
        { _id: new ObjectId(versionId) },
        { $set: { cohorts: cohortIds } },
        { session }
      );
      return true;
    } catch(err){
      throw new InternalServerError(
        'Failed to add Cohorts To Version.\n More Details: ' + err,
      );
    }
  }

  // async pushCohortsToVersion(
  //   versionId: string,
  //   cohortIds: ObjectId[],
  //   session?: ClientSession
  // ):Promise<boolean> {
  //   await this.init();
  //   try{
  //     await this.courseVersionCollection.updateOne(
  //       { _id: new ObjectId(versionId) },
  //       {
  //         $addToSet: {
  //           cohorts: { $each: cohortIds }
  //         }
  //       },
  //       { session }
  //     );
  //     return true;
  //   } catch(err){
  //     throw new InternalServerError(
  //       'Failed to add Cohorts To Version.\n More Details: ' + err,
  //     );
  //   }
  // }

  async modifyCohortById(
    cohortId: ObjectId,
    cohortName?: string,
    isPublic?: boolean,
    session?: ClientSession
  ): Promise<boolean> {
    try {

      const updateFields: any = {}
      if (cohortName) {
        updateFields.name = cohortName
      }
      if (!(isPublic === null || isPublic === undefined)) {
        updateFields.isPublic = isPublic
      }
      if (Object.keys(updateFields).length === 0) {
        return false
      }
      const result = await this.cohortsCollection.updateOne(
        { _id: cohortId },
        { $set: updateFields },
        { session }
      )
      return result.modifiedCount === 1

    } catch (err) {
      throw new InternalServerError(
        "Failed to modify cohort.\nMore Details: " + err
      )
    }
  }

  async deleteCohortById(
    cohortId: string,
    session: ClientSession
  ): Promise<boolean> {
    try {
      const result = await this.cohortsCollection.deleteOne(
        { _id: new ObjectId(cohortId) },
        { session }
      );

      return result.deletedCount === 1;
    } catch (err) {
      throw new InternalServerError(
        "Failed to Delete cohort.\nMore Details: " + err
      );
    }
  }

  async removeCohortFromVersion(
    versionId: string,
    cohortId: string,
    session?: ClientSession
  ): Promise<boolean> {
    const result = await this.courseVersionCollection.updateOne(
      { _id: new ObjectId(versionId) },
      {
        $pull: {
          cohorts: new ObjectId(cohortId)
        }
      },
      { session }
    );

    return result.modifiedCount === 1;
}

  async createVersion(
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const result = await this.courseVersionCollection.insertOne(
        courseVersion,
        { session },
      );
      if (result.acknowledged) {
        const newCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: result.insertedId,
          },
          { session },
        );

        return instanceToPlain(
          Object.assign(new CourseVersion(), newCourseVersion),
        ) as CourseVersion;
      } else {
        throw new InternalServerError('Failed to create course version');
      }
    } catch (error) {
      throw new InternalServerError(
        'Failed to create course version.\n More Details: ' + error,
      );
    }
  }

  async addModulesToVersion(
    courseVersionId: string,
    newModules: Module[],
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.courseVersionCollection.findOneAndUpdate(
        { _id: new ObjectId(courseVersionId) },
        {
          $set: {
            modules: newModules,
          },
        },
        { session },
      );
    } catch (error) {
      throw new InternalServerError(
        'Failed to add module to course version.\n More Details: ' + error,
      );
    }
  }

  async readVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const courseVersion = await this.courseVersionCollection.findOne(
        {
          _id: new ObjectId(versionId),
        },
        { session },
      );

      if (courseVersion === null) {
        throw new NotFoundError('Course Version not found');
      }

      // Filter out soft-deleted modules and sections
      if (courseVersion.modules) {
        courseVersion.modules = courseVersion.modules
          .filter(m => !m.isDeleted)
          .map(m => ({
            ...m,
            sections: m.sections ? m.sections.filter(s => !s.isDeleted) : [],
          }));
      }

      return instanceToPlain(
        Object.assign(new CourseVersion(), courseVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to read course version.\n More Details: ' + error,
      );
    }
  }

  async getItemGroupInfo(
    itemGroupId: ID,
    session?: ClientSession,
  ): Promise<IItemGroupInfo | null> {
    const result = await this.courseVersionCollection
      .aggregate<IItemGroupInfo>(
        [
          {
            $match: {
              'modules.sections.itemsGroupId': itemGroupId,
            },
          },
          { $unwind: '$modules' },
          { $unwind: '$modules.sections' },
          {
            $match: {
              'modules.sections.itemsGroupId': itemGroupId,
            },
          },
          {
            $project: {
              _id: 0,
              courseVersionId: '$_id',
              moduleId: '$modules.moduleId',
              moduleName: '$modules.name',
              sectionId: '$modules.sections.sectionId',
              sectionName: '$modules.sections.name',
            },
          },
        ],
        { session },
      )
      .toArray();

    return result.length > 0 ? result[0] : null;
  }

  async getActiveVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();

    // Find the course version with no section or module marked as deleted
    const courseVersionPipeline = [
      {
        $match: {
          _id: new ObjectId(versionId),
        },
      },
      {
        $set: {
          modules: {
            $map: {
              input: {
                $filter: {
                  input: '$modules',
                  as: 'mod',
                  cond: { $ne: ['$$mod.isDeleted', true] },
                },
              },
              as: 'mod',
              in: {
                moduleId: '$$mod.moduleId',
                name: '$$mod.name',
                description: '$$mod.description',
                order: '$$mod.order',
                createdAt: '$$mod.createdAt',
                updatedAt: '$$mod.updatedAt',
                isDeleted: '$$mod.isDeleted',
                deletedAt: '$$mod.deletedAt',
                isHidden: '$$mod.isHidden',
                sections: {
                  $filter: {
                    input: '$$mod.sections',
                    as: 'sec',
                    cond: { $ne: ['$$sec.isDeleted', true] },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const pipeline = this.courseVersionCollection.aggregate(
      courseVersionPipeline,
      { session },
    );

    const courseVersion = await pipeline.next();

    if (courseVersion === null) {
      throw new NotFoundError('Course Version not found');
    }

    return instanceToPlain(
      Object.assign(new CourseVersion(), courseVersion),
    ) as CourseVersion;
  }

  async getActiveVersions(
    versionIds: string[],
    session?: ClientSession,
  ): Promise<ICourseVersion[]> {
    await this.init();

    const objectIdArray = versionIds.map(id => new ObjectId(id));

    const courseVersionPipeline = [
      {
        $match: {
          _id: { $in: objectIdArray },
          $or: [
            { versionStatus: "active" },
            { versionStatus: { $exists: false } }
          ]
        }
      },
      {
        $set: {
          modules: {
            $map: {
              input: {
                $filter: {
                  input: '$modules',
                  as: 'mod',
                  cond: { $ne: ['$$mod.isDeleted', true] },
                },
              },
              as: 'mod',
              in: {
                moduleId: '$$mod.moduleId',
                name: '$$mod.name',
                description: '$$mod.description',
                order: '$$mod.order',
                createdAt: '$$mod.createdAt',
                updatedAt: '$$mod.updatedAt',
                isDeleted: '$$mod.isDeleted',
                deletedAt: '$$mod.deletedAt',
                isHidden: '$$mod.isHidden',
                sections: {
                  $filter: {
                    input: '$$mod.sections',
                    as: 'sec',
                    cond: { $ne: ['$$sec.isDeleted', true] },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const courseVersions = await this.courseVersionCollection
      .aggregate(courseVersionPipeline, { session })
      .toArray();

    return courseVersions as ICourseVersion[];
  }

  async getModulebyId(
    versionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<IModule | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const versionObjectId = new ObjectId(versionId);
      const moduleObjectId = new ObjectId(moduleId);

      // Find the course version
      const courseVersion = await this.courseVersionCollection.findOne(
        {
          _id: versionObjectId,
        },
        { session },
      );

      if (!courseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      // Find the module to delete
      const module = courseVersion.modules.find(m =>
        new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      if (!module) {
        throw new NotFoundError('Module not found');
      }

      return module;

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete module.\n More Details: ' + error,
      );
    }
  }

  async updateVersion(
    versionId: string,
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();
    try {
      courseVersion = {
        ...courseVersion,
        courseId: new ObjectId(courseVersion.courseId),
        modules: (courseVersion.modules || []).map(module => ({
          ...module,
          moduleId: new ObjectId(module.moduleId),
          sections: (module.sections || []).map(section => ({
            ...section,
            sectionId: new ObjectId(section.sectionId),
            itemsGroupId: new ObjectId(section.itemsGroupId),
          })),
        })),
        cohorts: (courseVersion.cohorts||[]).map(cohort=> new ObjectId(cohort))
      }
      const { _id: _, ...fields } = courseVersion;

      const isExistVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });

      if (!isExistVersion)
        throw new InternalServerError(
          'Failed to update course version, version not founded!',
        );

      const result = await this.courseVersionCollection.updateOne(
        { _id: new ObjectId(versionId) },
        { $set: fields },
        { session },
      );
      // if (result.modifiedCount === 1) {
      const updatedCourseVersion = await this.courseVersionCollection.findOne(
        {
          _id: new ObjectId(versionId),
        },
        { session },
      );
      return instanceToPlain(
        Object.assign(new CourseVersion(), updatedCourseVersion),
      ) as CourseVersion;
      // } else {
      //   throw new InternalServerError('Failed to update course version');
      // }
    } catch (error) {
      throw new InternalServerError(
        'Failed to update course version.\n More Details: ' + error,
      );
    }
  }

  async deleteVersion(
    courseId: string,
    versionId: string,
    itemGroupsIds: ObjectId[],
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();
    try {
      // 1. Delete course version (soft delete)
      const now = new Date();
      const version = await this.courseVersionCollection.findOne(
        {
          _id: new ObjectId(versionId),
        },
        { session },
      );

      const updatedModules = version.modules.map(m => {
        return {
          ...m,
          isDeleted: true,
          deletedAt: now,
          sections: m.sections.map(s => ({
            ...s,
            isDeleted: true,
            deletedAt: now,
          })),
        };
      });

      const versionDeleteResult = await this.courseVersionCollection.updateOne(
        {
          _id: new ObjectId(versionId),
        },
        {
          $set: { isDeleted: true, deletedAt: now, modules: updatedModules },
        },
        { session },
      );

      if (versionDeleteResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to delete course version');
      }

      // 2. Remove courseVersionId from the course
      /*
      const courseUpdateResult = await this.courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
          $pull: {
            versions: {
              $in: [new ObjectId(versionId) as any, versionId],
            },
          },
        },
        {session},
      );

      if (courseUpdateResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to update course');
      }
      */

      // delete watch time (soft delete)
      await this.progressRepo.deleteWatchTimeByVersionId(versionId, session);

      // 3. Cascade Delete item groups (soft delete),
      const itemDeletionResult = await this.itemsGroupCollection.updateMany(
        {
          _id: { $in: itemGroupsIds },
        },
        {
          $set: { isDeleted: true, deletedAt: now },
        },
        { session },
      );

      if (itemGroupsIds.length && itemDeletionResult.modifiedCount === 0) {
        throw new InternalServerError('Failed to delete item groups');
      }

      // 4. Delete all enrollmentsand progress related to this version
      await this.progressRepo.deleteProgressByVersionId(versionId, session);
      await this.enrollmentRepo.deleteEnrollmentByVersionId(versionId, session);

      // 4. Return the deleted course version
      return versionDeleteResult;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete course version.\n More Details: ' + error,
      );
    }
  }

  async deleteSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const moduleObjectId = new ObjectId(moduleId);

      // Find the module to delete
      const module = courseVersion.modules.find(m =>
        new ObjectId(m.moduleId).equals(moduleObjectId),
      );
      if (!module) {
        throw new NotFoundError('Module not found');
      }
      // Cascade delete sections and items
      if (module.sections.length > 0) {
        const section = module.sections.find(
          section => section.sectionId?.toString() === sectionId,
        );
        if (!section) {
          throw new NotFoundError('Section not found');
        }
        const itemGroupId = section?.itemsGroupId;
        const items = await this.itemsGroupCollection.findOne(
          { _id: new ObjectId(itemGroupId) },
          { session },
        );
        if (items) {
          try {
            for (const item of items.items) {
              await this.progressRepo.deleteWatchTimeByItemId(
                item._id.toString(),
                session,
              );
            }
          } catch (err) {
            console.error('Error deleting watch time by item ID:', err);
            throw new InternalServerError('Failed to delete item watch time');
          }
        }

        try {
          const itemDeletionResult = await this.itemsGroupCollection.updateOne(
            {
              _id: new ObjectId(itemGroupId),
            },
            {
              $set: { isDeleted: true, deletedAt: new Date() },
            },
            { session },
          );

          if (!itemDeletionResult.acknowledged) {
            throw new InternalServerError('Failed to delete item groups');
          }
        } catch (error) {
          throw new InternalServerError('Item deletion failed');
        }
      } else {
        throw new NotFoundError('Sections not found');
      }

      // Remove the section from the course version
      // Soft delete sections
      const updatedModules = courseVersion.modules.map(m => {
        if (new ObjectId(m.moduleId).equals(moduleObjectId)) {
          return {
            ...m,
            sections: m.sections.map(s => {
              if (s.sectionId?.toString() === sectionId) {
                return {
                  ...s,
                  isDeleted: true,
                  deletedAt: new Date(),
                };
              }
              return s;
            }),
            /*sections: m.sections.filter(
              s => !new ObjectId(s.sectionId).equals(sectionId),
            )*/
          };
        }
        return m;
      });

      try {
        const updateResult = await this.courseVersionCollection.updateOne(
          { _id: new ObjectId(versionId) },
          { $set: { modules: updatedModules } },
          { session },
        );

        if (updateResult.modifiedCount !== 1) {
          throw new InternalServerError('Failed to update Section');
        }

        return updateResult;
      } catch (error) {
        console.error('Error updating course version modules:', error);
        throw new InternalServerError('Database update failed: ' + error);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete Section.\n More Details: ' + error,
      );
    }
  }

  async deleteModule(
    versionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<boolean | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const versionObjectId = new ObjectId(versionId);
      const moduleObjectId = new ObjectId(moduleId);

      // Find the course version
      const courseVersion = await this.courseVersionCollection.findOne(
        {
          _id: versionObjectId,
        },
        { session },
      );

      if (!courseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      // Find the module to delete
      const module = courseVersion.modules.find(m =>
        new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      if (!module) {
        throw new NotFoundError('Module not found');
      }

      // Cascade delete sections and items
      if (module.sections.length > 0) {
        const itemGroupsIds = module.sections.map(
          section => new ObjectId(section.itemsGroupId),
        );

        // Get item ids from item groups before deletion and delete watch time by item id
        for (const itemGroupId of itemGroupsIds) {
          const items = await this.itemsGroupCollection.findOne(
            { _id: itemGroupId },
            { session },
          );

          if (items) {
            // Delete watch time by item id
            items.items.forEach(async item => {
              await this.progressRepo.deleteWatchTimeByItemId(
                item._id.toString(),
                session,
              );
            });
          }
        }

        const itemDeletionResult = await this.itemsGroupCollection.updateMany(
          {
            _id: { $in: itemGroupsIds },
          },
          {
            $set: { isDeleted: true, deletedAt: new Date() },
          },
          { session },
        );

        if (itemDeletionResult.modifiedCount === 0) {
          throw new InternalServerError('Failed to delete item groups');
        }
      }

      // Soft Remove the module from the course version
      const updatedModules = courseVersion.modules.map(m => {
        if (new ObjectId(m.moduleId).equals(moduleObjectId)) {
          return {
            ...m,
            sections: m.sections.map(s => ({
              ...s,
              isDeleted: true,
              deletedAt: new Date(),
            })),
            isDeleted: true,
            deletedAt: new Date(),
          };
        }
        return m;
      });

      const updateResult = await this.courseVersionCollection.updateOne(
        { _id: versionObjectId },
        { $set: { modules: updatedModules } },
        { session },
      );

      if (updateResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to update course version');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete module.\n More Details: ' + error,
      );
    }
  }

  async findVersionByItemGroupId(
    itemGroupId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();

    const idAsObjectId = ObjectId.isValid(itemGroupId) // temp
      ? new ObjectId(itemGroupId)
      : null;

    const courseVersion = await this.courseVersionCollection.findOne(
      {
        $or: [
          { 'modules.sections.itemsGroupId': itemGroupId },
          ...(idAsObjectId
            ? [{ 'modules.sections.itemsGroupId': idAsObjectId }]
            : []),
        ],
      },
      { session },
    );

    // const courseVersion = await this.courseVersionCollection.findOne(
    //   {
    //     'modules.sections.itemsGroupId': itemGroupId,
    //   },
    //   {session},
    // );

    if (!courseVersion) {
      return null;
    }

    return instanceToPlain(
      Object.assign(new CourseVersion(), courseVersion),
    ) as CourseVersion;
  }

  async getAllCourses(session?: ClientSession): Promise<ICourse[]> {
    try {
      await this.init();
      const query = this.courseCollection.find(
        { versions: { $exists: true, $ne: [] } },
        { session },
      );
      return await query.toArray();
    } catch (error) {
      throw new InternalServerError(
        `Failed to fetch courses: ${(error as Error).message}`,
      );
    }
  }

  async bulkUpdateVersions(
    bulkOperations: any[],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    try {
      const result = await this.courseVersionCollection.bulkWrite(
        bulkOperations,
        { session },
      );
      console.log(`Bulk update result: ${JSON.stringify(result)}`);
    } catch (error) {
      throw new InternalServerError(
        'Failed to bulk update course versions.\n More Details: ' + error,
      );
    }
  }

  async addNewCourseVersionToCourse(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    try {
      const result = await this.courseCollection.findOneAndUpdate(
        { _id: new ObjectId(courseId) },
        { $push: { versions: new ObjectId(versionId) } },
        { session },
      );

      if (!result) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to add new course version:', error);
      throw new InternalServerError(`Failed to add new course version`);
    }
  }

  private async deleteAndReturnIds(
    collection: Collection<any>,
    filter: any,
    session?: ClientSession,
  ): Promise<ObjectId[]> {
    const docs = await collection
      .find(filter, { projection: { _id: 1 }, session })
      .toArray();

    if (docs.length === 0) return [];

    const ids = docs.map(doc => doc._id);
    await collection.deleteMany({ _id: { $in: ids } }, { session });

    return ids;
  }

  async cascadeDeleteVersion(session?: ClientSession): Promise<void> {
    // cascade delete versions with date difference exceeding 30 days
    await this.init();
    try {
      // start with items groups
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedFilter = {
        isDeleted: true,
        deletedAt: { $lte: thirtyDaysAgo },
      };

      // Delete items groups
      const itemGroupIds = await this.deleteAndReturnIds(
        this.itemsGroupCollection,
        deletedFilter,
        session,
      );

      // Pull deleted item groups from course versions

      if (itemGroupIds.length > 0) {
        await this.courseVersionCollection.updateMany(
          {
            'modules.sections.itemsGroupId': { $in: itemGroupIds },
          },
          {
            $pull: {
              'modules.$[].sections': { itemsGroupId: { $in: itemGroupIds } },
            },
          },
          { session },
        );
      }

      // Delete sections and modules from course versions
      await this.courseVersionCollection.updateMany(
        {
          'modules.sections': { $elemMatch: deletedFilter },
        },
        {
          $pull: {
            'modules.$[].sections': deletedFilter,
          },
        },
        { session },
      );

      await this.courseVersionCollection.updateMany(
        {
          modules: { $elemMatch: deletedFilter },
        },
        {
          $pull: {
            modules: deletedFilter as any,
          },
        },
        { session },
      );

      // Finally, delete course versions
      const deletedVersions = await this.deleteAndReturnIds(
        this.courseVersionCollection,
        deletedFilter,
        session,
      );

      // update course documents to remove references to deleted versions
      await this.courseCollection.updateMany(
        { versions: { $in: deletedVersions } },
        { $pull: { versions: { $in: deletedVersions } } as any },
        { session },
      );

      // Delete courses
      await this.deleteAndReturnIds(
        this.courseCollection,
        deletedFilter,
        session,
      );

      // Delete enrollments, progress and watch times related to deleted versions

      if (deletedVersions.length > 0) {
        await this.enrollmentRepo.deleteEnrollmentsByVersionIds(
          deletedVersions,
          session,
        );

        await this.progressRepo.deleteUserProgressByVersionIds(
          deletedVersions,
          session,
        );
      }
    } catch (error) {
      throw new InternalServerError(
        'Failed to cascade delete versions.\n More Details: ' + error,
      );
    }
  }

  async updateCourseVersionStatus(versionId: string, versionStatus: courseVersionStatus, session?: ClientSession): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const isExistVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });

      if (!isExistVersion)
        throw new NotFoundError('Failed to update course version, version not founded!',);
      const result = await this.courseVersionCollection.findOneAndUpdate(
        { _id: new ObjectId(versionId) },
        {
          $set: {
            versionStatus,
            updatedAt: new Date()
          }
        },
        {
          returnDocument: "after",
          session
        }
      )
      return result;
    } catch (error) {
      throw new InternalServerError(
        'Failed to update course version.\n More Details: ' + error,
      );
    }
  }
  async getCourseVersionStatus(versionId: string, session?: ClientSession): Promise<courseVersionStatus> {
    await this.init();
    const isExistVersion = await this.courseVersionCollection.findOne(
      {_id: new ObjectId(versionId)},
      {session}
    );
    if (!isExistVersion)
      throw new NotFoundError('Course version not founded!',);
    return isExistVersion.versionStatus;
  }
}
