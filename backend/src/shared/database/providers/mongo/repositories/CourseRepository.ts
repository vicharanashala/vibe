import {GLOBAL_TYPES} from '#root/types.js';
import {ICourseRepository} from '#shared/database/interfaces/ICourseRepository.js';
import {
  ICourse,
  ICourseVersion,
  ID,
  IEnrollment,
  IItemGroupInfo,
  IModule,
} from '#shared/interfaces/models.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {
  Collection,
  MongoClient,
  ClientSession,
  ObjectId,
  DeleteResult,
  UpdateResult,
} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {MongoDatabase} from '../MongoDatabase.js';
import {Course} from '#courses/classes/transformers/Course.js';
import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {ItemsGroup} from '#courses/classes/transformers/Item.js';
import {ProgressRepository} from './ProgressRepository.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {Module} from '#root/modules/courses/classes/index.js';
import {EnrollmentRepository} from './EnrollmentRepository.js';
import {
  ANOMALIES_TYPES,
  AnomalyRepository,
} from '#root/modules/anomalies/index.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import {COURSE_REGISTRATION_TYPES} from '#root/modules/courseRegistration/types.js';
import {ICourseRegistrationRepository} from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';
import {InviteRepository} from '#shared/database/providers/mongo/repositories/InviteRepository.js';
import {PROJECTS_TYPES} from '#root/modules/projects/types.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {REPORT_TYPES} from '#root/modules/reports/types.js';
import {QuestionBankRepository} from '../../../../../modules/quizzes/repositories/providers/mongodb/QuestionBankRepository.js';
import {ReportRepository} from '#root/modules/reports/repositories/index.js';
import {Invite} from '#root/modules/notifications/classes/transformers/Invite.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {IProjectSubmissionRepository} from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import {ISettingRepository} from '#root/shared/database/interfaces/ISettingRepository.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';

@injectable()
export class CourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private itemsGroupCollection: Collection<ItemsGroup>;
  private enrollmentCollection: Collection<IEnrollment>;
  private inviteCollection: Collection<Invite>;
  private questionBankCollection: Collection<IQuestionBank>;

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
  ) {}

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
    const result = await this.courseCollection.insertOne(course, {session});
    if (result.acknowledged) {
      const newCourse = await this.courseCollection.findOne(
        {
          _id: result.insertedId,
        },
        {session},
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
      {session},
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

    const {_id: _, ...fields} = course;
    const res = await this.courseCollection.findOneAndUpdate(
      {_id: new ObjectId(id)},
      {$set: fields},
      {returnDocument: 'after', session},
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
      {_id: new ObjectId(courseId)},
      {session},
    );
    if (!courseDoc) {
      throw new NotFoundError('Course not found');
    }

    // 2. If the course has versions, delete each one:
    //    - Read raw version document from courseVersionCollection
    //    - Extract all itemsGroupId values from its modules/sections
    //    - Call deleteVersion(...) to delete the version and its items
    const versionIds: string[] = Array.isArray((courseDoc as any).versions)
      ? (courseDoc as any).versions.map((v: any) => v.toString())
      : [];

    for (const versionId of versionIds) {
      // 2a. Fetch the raw CourseVersion document
      const rawVersion = await this.courseVersionCollection.findOne(
        {_id: new ObjectId(versionId)},
        {session},
      );
      if (!rawVersion) {
        throw new NotFoundError(`CourseVersion with ID ${versionId} not found`);
      }

      // 2b. Walk through modules → sections → collect all itemsGroupId
      const itemGroupsIds: ObjectId[] = [];
      if (Array.isArray((rawVersion as any).modules)) {
        for (const mod of (rawVersion as any).modules as any[]) {
          if (Array.isArray(mod.sections)) {
            for (const sec of mod.sections as any[]) {
              itemGroupsIds.push(new ObjectId(sec.itemsGroupId));
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
    const deleteCourseResult = await this.courseCollection.deleteOne(
      {_id: new ObjectId(courseId)},
      {session},
    );

    if (deleteCourseResult.deletedCount !== 1) {
      throw new InternalServerError('Failed to delete course');
    }
    return true;
  }

  async createVersion(
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const result = await this.courseVersionCollection.insertOne(
        courseVersion,
        {session},
      );
      if (result.acknowledged) {
        const newCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: result.insertedId,
          },
          {session},
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
        {_id: new ObjectId(courseVersionId)},
        {
          $set: {
            modules: newModules,
          },
        },
        {session},
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
        {session},
      );

      // if (courseVersion === null) {
      //   throw new NotFoundError('Course Version not found');
      // }

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
          {$unwind: '$modules'},
          {$unwind: '$modules.sections'},
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
        {session},
      )
      .toArray();

    return result.length > 0 ? result[0] : null;
  }

  async updateVersion(
    versionId: string,
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const {_id: _, ...fields} = courseVersion;

      const isExistVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });

      if (!isExistVersion)
        throw new InternalServerError(
          'Failed to update course version, version not founded!',
        );

      const result = await this.courseVersionCollection.updateOne(
        {_id: new ObjectId(versionId)},
        {$set: fields},
        {session},
      );
      // if (result.modifiedCount === 1) {
      const updatedCourseVersion = await this.courseVersionCollection.findOne(
        {
          _id: new ObjectId(versionId),
        },
        {session},
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
  ): Promise<DeleteResult | null> {
    await this.init();
    try {
      // 1. Delete course version
      const versionDeleteResult = await this.courseVersionCollection.deleteOne(
        {
          _id: new ObjectId(versionId),
        },
        {session},
      );

      if (versionDeleteResult.deletedCount !== 1) {
        throw new InternalServerError('Failed to delete course version');
      }

      console.log('VersionId: ', versionId);
      // 2. Remove courseVersionId from the course
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

      await Promise.all([
        // delete watch time
        this.progressRepo.deleteWatchTimeByVersionId(versionId, session),

        // delete enrollment
        this.enrollmentRepo.deleteEnrollmentByVersionId(versionId, session),

        // delete anomaly
        this.anomalyRepository.deleteAnomalyByVersionId(versionId, session),

        // delete settings
        this.settingsRepo.deleteCourseSettingsbyVersionId(versionId, session),

        // delete course registration
        this.courseRegistrationRepo.deleteRegistrationByVersionId(
          versionId,
          session,
        ),

        // delete invite
        this.inviteRepo.deleteInviteByVersionId(versionId, session),

        // delete progress
        this.progressRepo.deleteProgressByVersionId(versionId, session),

        // delete project submission
        this.projectSubmissionRepo.deleteProjectSubmissionByVersionId(
          versionId,
          session,
        ),

        // delete question bank
        this.questionBankRepository.deleteQuestionBankByVersionId(
          versionId,
          session,
        ),

        // delete report
        this.reportsRepository.deleteReportByVersionId(versionId, session),
      ]);

      // 3. Cascade Delete item groups
      const itemDeletionResult = await this.itemsGroupCollection.deleteMany(
        {
          _id: {$in: itemGroupsIds},
        },
        {session},
      );

      if (itemGroupsIds.length && itemDeletionResult.deletedCount === 0) {
        throw new InternalServerError('Failed to delete item groups');
      }

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
          section => section.sectionId === sectionId,
        );
        if (!section) {
          throw new NotFoundError('Section not found');
        }
        const itemGroupId = section?.itemsGroupId;
        const items = await this.itemsGroupCollection.findOne(
          {_id: new ObjectId(itemGroupId)},
          {session},
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
          const itemDeletionResult = await this.itemsGroupCollection.deleteOne(
            {
              _id: itemGroupId,
            },
            {session},
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
      const updatedModules = courseVersion.modules.map(m => {
        if (new ObjectId(m.moduleId).equals(moduleObjectId)) {
          return {
            ...m,
            sections: m.sections.filter(
              s => !new ObjectId(s.sectionId).equals(sectionId),
            ),
          };
        }
        return m;
      });

      try {
        const updateResult = await this.courseVersionCollection.updateOne(
          {_id: new ObjectId(versionId)},
          {$set: {modules: updatedModules}},
          {session},
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
        {session},
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
            {_id: itemGroupId},
            {session},
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

        const itemDeletionResult = await this.itemsGroupCollection.deleteMany(
          {
            _id: {$in: itemGroupsIds},
          },
          {session},
        );

        if (itemDeletionResult.deletedCount === 0) {
          throw new InternalServerError('Failed to delete item groups');
        }
      }

      // Remove the module from the course version
      const updatedModules = courseVersion.modules.filter(
        m => !new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      const updateResult = await this.courseVersionCollection.updateOne(
        {_id: versionObjectId},
        {$set: {modules: updatedModules}},
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
          {'modules.sections.itemsGroupId': itemGroupId},
          ...(idAsObjectId
            ? [{'modules.sections.itemsGroupId': idAsObjectId}]
            : []),
        ],
      },
      {session},
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
        {versions: {$exists: true, $ne: []}},
        {session},
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
        {session},
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
        {_id: new ObjectId(courseId)},
        {$push: {versions: new ObjectId(versionId)}},
        {session},
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
}
