import {ICourseRegistration, MongoDatabase} from '#root/shared/index.js';
import {inject, injectable} from 'inversify';
import {Collection, ClientSession, ObjectId, SortDirection} from 'mongodb';

import {GLOBAL_TYPES} from '#root/types.js';
import {ICourseRegistrationRepository} from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';

class CourseRegistrationRepository implements ICourseRegistrationRepository {
  private courseRegistrationCollection: Collection<ICourseRegistration>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.courseRegistrationCollection =
      await this.db.getCollection<ICourseRegistration>('course_registrations');
  }

  async findByUserId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const result = await this.courseRegistrationCollection.findOne(
      {userId: new ObjectId(userId), versionId: new ObjectId(versionId)},
      {session},
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
      {_id: new ObjectId(registrationId)},
      {session},
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
    versionId: string,
    filter: {status?: string; search?: string},
    skip: number,
    limit: number,
    sort: 'older' | 'latest',
    session?: ClientSession,
  ): Promise<{registrations: ICourseRegistration[]; totalDocuments: number}> {
    await this.init();

    const query: any = {versionId: new ObjectId(versionId)};

    if (filter.status && filter.status !== 'ALL') {
      query.status = filter.status;
    }
    if (filter.search) {
      query.$or = [
        {'detail.Name': {$regex: filter.search, $options: 'i'}},
        {'detail.Email': {$regex: filter.search, $options: 'i'}},
      ];
    }

    const sortOption =
      sort === 'older'
        ? {createdAt: 1 as SortDirection}
        : {createdAt: -1 as SortDirection};

    const result = await this.courseRegistrationCollection
      .find(query, {session})
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
    }));

    const totalDocuments =
      await this.courseRegistrationCollection.countDocuments(query, {session});

    return {registrations, totalDocuments};
  }

  async updateStatus(
    registrationId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    session?: ClientSession,
  ): Promise<ICourseRegistration | null> {
    await this.init();

    const data = await this.courseRegistrationCollection.findOneAndUpdate(
      {_id: new ObjectId(registrationId)},
      {
        $set: {status, updatedAt: new Date()},
      },
      {returnDocument: 'after', session},
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
      {_id: {$in: objectIds}},
      {$set: {status: 'APPROVED', updatedAt: new Date()}},
      {session},
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
      {$set: {isDeleted: true, deletedAt: new Date()}},
      {session},
    );
  }

  async deleteRegistrationByVersionId(
    versionId: string,
    session?: ClientSession,
  ) {
    await this.init();
  }
}

export {CourseRegistrationRepository};
