import { ICohort, ICourseRegistration, ICourseVersion, ID, MongoDatabase } from '#root/shared/index.js';
import { inject } from 'inversify';
import { Collection, ClientSession, ObjectId, SortDirection } from 'mongodb';
import { IEnrollment } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ICourseRegistrationRepository } from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';
import { Course } from '#root/modules/courses/classes/index.js';
import { re } from 'mathjs';


class CourseRegistrationRepository implements ICourseRegistrationRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private courseRegistrationCollection: Collection<ICourseRegistration>;
  private courseCollection: Collection<Course>;
  private cohortsCollection: Collection<ICohort>;
  
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

  private async init() {
    this.courseRegistrationCollection =
      await this.db.getCollection<ICourseRegistration>('course_registrations');
    this.enrollmentCollection =
      await this.db.getCollection<IEnrollment>('enrollment');
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.cohortsCollection = await this.db.getCollection<ICohort>('cohorts');

    this.courseRegistrationCollection.createIndex({
      userId: 1,
      versionId: 1,
    });

    this.courseRegistrationCollection.createIndex({
      versionId: 1,
      status: 1,
      createdAt: -1,
    });

    this.courseRegistrationCollection.createIndex({
      userId: 1,
      status: 1,
      read: 1,
    });
  }

  async findByUserId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const result = await this.courseRegistrationCollection.findOne(
      { userId: new ObjectId(userId), versionId: new ObjectId(versionId) },
      { session },
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id?.toString(),
      userId: result.userId?.toString(),
      courseId: result.courseId?.toString(),
      versionId: result.versionId?.toString(),
    };
  }

  async findPendingRequestsByUserId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const result = await this.courseRegistrationCollection.findOne(
      { userId: new ObjectId(userId), versionId: new ObjectId(versionId), status: 'PENDING' },
      { session },
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id?.toString(),
      userId: result.userId?.toString(),
      courseId: result.courseId?.toString(),
      versionId: result.versionId?.toString(),
    };
  }

  async findPendingRequestsByUserIdAndCohort(
    userId: string,
    versionId: string,
    cohort?:string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const result = await this.courseRegistrationCollection.findOne(
      { userId: new ObjectId(userId), versionId: new ObjectId(versionId), status: 'PENDING', cohortId: new ObjectId(cohort) },
      { session },
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id?.toString(),
      userId: result.userId?.toString(),
      courseId: result.courseId?.toString(),
      versionId: result.versionId?.toString(),
    };
  }

  async getCohortsByIds(
    cohortIds: ID[],
    session?: ClientSession,
  ): Promise<ICohort[]> {

    const objectIds = cohortIds.map(id => new ObjectId(id));

    return await this.cohortsCollection
      .find({ _id: { $in: objectIds } }, { session })
      .toArray();
  }

  async create(
    data: ICourseRegistration,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.courseRegistrationCollection.insertOne(data, {
      session,
    });
    return result.insertedId.toString();
  }

  async getRegistration(
    registrationId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const result = await this.courseRegistrationCollection.findOne(
      { _id: new ObjectId(registrationId) },
      { session },
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id?.toString(),
      userId: result.userId?.toString(),
      courseId: result.courseId?.toString(),
      versionId: result.versionId?.toString(),
    };
  }

  async findAllregistrations(
    version: ICourseVersion,
    filter: { status?: string; search?: string },
    skip: number,
    limit: number,
    sort: 'older' | 'latest',
    session?: ClientSession,
  ): Promise<{ registrations: ICourseRegistration[]; totalDocuments: number }> {
    await this.init();

    const query: any = { versionId: new ObjectId(version._id.toString()) };

    if (filter.status && filter.status !== 'ALL') {
      query.status = filter.status;
    }
    if (filter.search) {
      query.$or = [
        { 'detail.Name': { $regex: filter.search, $options: 'i' } },
        { 'detail.Email': { $regex: filter.search, $options: 'i' } },
      ];
    }

    const sortOption =
      sort === 'older'
        ? { createdAt: 1 as SortDirection }
        : { createdAt: -1 as SortDirection };

    const result = await this.courseRegistrationCollection
      .find(query, { session })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    const registrations: ICourseRegistration[] = result.map(item => ({
      ...item,
      _id: item._id?.toString(),
      userId: item.userId?.toString(),
      courseId: item.courseId?.toString(),
      versionId: item.versionId?.toString(),
      cohortId: item.cohortId?.toString(),
    }));

    const cohorts = await this.getCohortsByIds(
      version.cohorts || [],
      session
    );

    if (cohorts.length > 0) {
      const cohortMap = new Map(
        cohorts.map(c => [c._id?.toString(), c])
      );
      registrations.forEach(registration => {
        const cohort = cohortMap.get(registration.cohortId?.toString());
        if (cohort) {
          registration.cohortName = cohort.name
        }
      });
    }

    const totalDocuments =
      await this.courseRegistrationCollection.countDocuments(query, { session });
// console.log("registrations---", registrations, "totalDocuments---", totalDocuments);
    return { registrations, totalDocuments };
  }

  async updateStatus(
    registrationId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const updateData: any = { status, updatedAt: new Date() };

    // When status is APPROVED, set read to false to ensure it shows as unread notification
    if (status === 'APPROVED') {
      updateData.read = false;
    }

    const data = await this.courseRegistrationCollection.findOneAndUpdate(
      { _id: new ObjectId(registrationId) },
      {
        $set: updateData,
      },
      { returnDocument: 'after', session },
    );

    if (!data) return null; // no document found

    const result: ICourseRegistration = {
      ...data,
      _id: data._id?.toString(),
      userId: data.userId?.toString(),
      courseId: data.courseId?.toString(),
      versionId: data.versionId?.toString(),
    };

    return result;
  }

  async updateBulkStatus(
    registrationIds: string[],
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const objectIds = registrationIds.map(id => new ObjectId(id));
    const data = await this.courseRegistrationCollection.updateMany(
      { _id: { $in: objectIds } },
      { $set: { status: 'APPROVED', updatedAt: new Date() } },
      { session },
    );
    return data.modifiedCount;
  }

  async remove(
    userId: string,
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ) {
    await this.init();
    return await this.courseRegistrationCollection.updateOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        versionId: new ObjectId(versionId),
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
  }

  async deleteRegistrationByVersionId(
    versionId: string,
    session?: ClientSession,
  ) {
    await this.init();
  }

  async getPendingRegistrations(
    instructorId: string,
    session?: ClientSession,
  ): Promise<any[]> {
    await this.init();

    const instructorEnrollments = await this.enrollmentCollection.find(
      {
        userId: new ObjectId(instructorId),
        role: 'INSTRUCTOR',
        isDeleted: { $ne: true }
      },
      { session }
    ).toArray();

    if (instructorEnrollments.length === 0) {
      return [];
    }

    // Get unique version IDs from instructor enrollments
    const versionIds = [...new Set(instructorEnrollments.map(e => e.courseVersionId.toString()))];

    // Find pending registrations for those course versions
    const result = await this.courseRegistrationCollection.aggregate([
      {
        $match: {
          versionId: { $in: versionIds.map(id => new ObjectId(id)) },
          status: 'PENDING'
        }
      },
    ], { session }).toArray();

    // Fetch course names for all courseIds
    const courseIds = [...new Set(result.map(item => item.courseId))];
    const courses = await this.courseCollection.find(
      { _id: { $in: courseIds.map(id => new ObjectId(id)) } },
      { session }
    ).toArray();

    const courseMap = courses.reduce((acc, course) => {
      acc[course._id.toString()] = course.name;
      return acc;
    }, {} as Record<string, string>);

    return result.map(item => ({
      ...item,
      _id: item._id?.toString(),
      userId: item.userId?.toString(),
      courseId: item.courseId?.toString(),
      versionId: item.versionId?.toString(),
      courseName: courseMap[item.courseId?.toString()] || 'Unknown Course'
    }));
  }

  async getUnreadApprovedRegistrations(
    studentId: string,
    session?: ClientSession,
  ): Promise<any[]> {
    await this.init();

    const result = await this.courseRegistrationCollection.aggregate([
      {
        $match: {
          userId: new ObjectId(studentId),
          status: 'APPROVED',
          $or: [
            { read: false }
          ]
        }
      }
    ], { session }).toArray();

    // Fetch course names for all courseIds
    const courseIds = [...new Set(result.map(item => item.courseId))];
    const courses = await this.courseCollection.find(
      { _id: { $in: courseIds.map(id => new ObjectId(id)) } },
      { session }
    ).toArray();

    const courseMap = courses.reduce((acc, course) => {
      acc[course._id.toString()] = course.name;
      return acc;
    }, {} as Record<string, string>);

    return result.map(item => ({
      ...item,
      _id: item._id?.toString(),
      userId: item.userId?.toString(),
      courseId: item.courseId?.toString(),
      versionId: item.versionId?.toString(),
      courseName: courseMap[item.courseId?.toString()] || 'Unknown Course'
    }));
  }

  async markNotificationAsRead(
    registrationId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const result = await this.courseRegistrationCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { $set: { read: true, updatedAt: new Date() } },
      { session }
    );

    return result.modifiedCount > 0;
  }
}

export { CourseRegistrationRepository };
