import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {IAnomalyData} from '#root/modules/anomalies/index.js';

@injectable()
export class AnomalyRepository {
  private anomalyCollection: Collection<IAnomalyData>;

  constructor(@inject(GLOBAL_TYPES.Database) private database: MongoDatabase) {}

  private async init(): Promise<void> {
    if (!this.anomalyCollection) {
      this.anomalyCollection = await this.database.getCollection<IAnomalyData>(
        'anomaly_records',
      );

      this.anomalyCollection.createIndex({
        userId: 1,
        courseId: 1,
        versionId: 1,
      });

      this.anomalyCollection.createIndex({
        courseId: 1,
        versionId: 1,
        type: 1,
        createdAt: -1,
      });
    }
  }

  async createAnomaly(
    anomaly: IAnomalyData,
    session?: ClientSession,
  ): Promise<IAnomalyData> {
    await this.init();

    const result = await this.anomalyCollection.insertOne(anomaly, {session});
    if (!result.acknowledged) {
      return null;
    }

    return {...anomaly, _id: result.insertedId};
  }

  async getByUser(
    userId: string,
    courseId: string,
    versionId: string,
    limit: number,
    skip: number,
    session?: ClientSession,
  ): Promise<IAnomalyData[]> {
    await this.init();

    const userIdStr = userId.toString();
    const userIdObj = ObjectId.isValid(userIdStr)
      ? new ObjectId(userIdStr)
      : null;

    const courseIdStr = courseId.toString();
    const courseIdObj = ObjectId.isValid(courseIdStr)
      ? new ObjectId(courseIdStr)
      : null;

    const versionIdStr = versionId.toString();
    const versionIdObj = ObjectId.isValid(versionIdStr)
      ? new ObjectId(versionIdStr)
      : null;

    const filter = {
      userId: {$in: [userIdStr, ...(userIdObj ? [userIdObj] : [])]},
      courseId: {$in: [courseIdStr, ...(courseIdObj ? [courseIdObj] : [])]},
      versionId: {$in: [versionIdStr, ...(versionIdObj ? [versionIdObj] : [])]},
    };

    const result = await this.anomalyCollection
      .find(filter, {session})
      .limit(limit)
      .skip(skip)
      .toArray();
    // const result = await this.anomalyCollection
    //   .find(
    //     {userId: userId, courseId: courseId, versionId: versionId},
    //     {session},
    //   )
    //   .limit(limit)
    //   .skip(skip)
    //   .toArray();
    return result.map(r => ({
      ...r,
      userId: r.userId?.toString(),
      courseId: r.courseId?.toString(),
      versionId: r.versionId?.toString(),
      itemId: r.itemId?.toString(),
    }));
  }

  async getAllByUser(
    userId: string,
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<IAnomalyData[]> {
    await this.init();

    const filter = {
      userId: {
        $in: [
          userId,
          ObjectId.isValid(userId) ? new ObjectId(userId) : undefined,
        ].filter(Boolean),
      },
      courseId: {
        $in: [
          courseId,
          ObjectId.isValid(courseId) ? new ObjectId(courseId) : undefined,
        ].filter(Boolean),
      },
      versionId: {
        $in: [
          versionId,
          ObjectId.isValid(versionId) ? new ObjectId(versionId) : undefined,
        ].filter(Boolean),
      },
    };

    const result = await this.anomalyCollection
      .find(filter, {session})
      .toArray();

    return result.map(r => ({
      ...r,
      userId: r.userId?.toString(),
      courseId: r.courseId?.toString(),
      versionId: r.versionId?.toString(),
      itemId: r.itemId?.toString(),
    }));
    // const result = await this.anomalyCollection
    //   .find(
    //     {userId: userId, courseId: courseId, versionId: versionId},
    //     {session},
    //   )
    //   .toArray();
    // return result;
  }

  async getById(
    anomalyId: string,
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<IAnomalyData | null> {
    await this.init();

    const filter = {
      _id: new ObjectId(anomalyId),
      courseId: {
        $in: [
          courseId,
          ObjectId.isValid(courseId) ? new ObjectId(courseId) : undefined,
        ].filter(Boolean),
      },
      versionId: {
        $in: [
          versionId,
          ObjectId.isValid(versionId) ? new ObjectId(versionId) : undefined,
        ].filter(Boolean),
      },
    };

    const result = await this.anomalyCollection.findOne(filter, {session});
    if (!result) return null;

    return {
      ...result,
      userId: result.userId?.toString(),
      courseId: result.courseId?.toString(),
      versionId: result.versionId?.toString(),
      itemId: result.itemId?.toString(),
    };
    // return await this.anomalyCollection.findOne(
    //   {_id: new ObjectId(anomalyId), courseId: courseId, versionId: versionId},
    //   {session},
    // );
  }

  async getAnomaliesByCourse(
    courseId: string,
    versionId: string,
    limit: number,
    skip: number,
    sortOptions?: {field: string; order: 'asc' | 'desc'},
    search?: string | string[],
    type?: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<{data: IAnomalyData[]; total: number}> {
    await this.init();

    const sort: {[key: string]: 1 | -1} = {};
    if (sortOptions) {
      sort[sortOptions.field] = sortOptions.order === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1; // Default sort by createdAt descending
    }

    const courseIdVariants = [
      courseId,
      ObjectId.isValid(courseId) ? new ObjectId(courseId) : undefined,
    ].filter(Boolean);

    const versionIdVariants = [
      versionId,
      ObjectId.isValid(versionId) ? new ObjectId(versionId) : undefined,
    ].filter(Boolean);

    const filter: any = {
      $and: [
        {
          $or: [
            {courseId: {$in: courseIdVariants}},
            {'courseId._id': {$in: courseIdVariants}},
          ],
        },
        {
          $or: [
            {versionId: {$in: versionIdVariants}},
            {'versionId._id': {$in: versionIdVariants}},
          ],
        },
      ],
    };

    // Add type filter
    if (type) {
      filter.$and.push({type});
    }

    // If user IDs are provided for search, filter by them
    if (search && Array.isArray(search)) {
      const userIds = search.map(id => new ObjectId(id));
      filter.$and.push({
        userId: {$in: userIds},
      });
    } 

    // Add cohort filter if provided
    if (cohortId) {
      const cohortIdVariants = [
        cohortId,
        ObjectId.isValid(cohortId) ? new ObjectId(cohortId) : undefined,
      ].filter(Boolean);

      filter.$and.push({
        $or: [
          {cohortId: {$in: cohortIdVariants}},
        ],
      });
    }

    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.trunc(Number(limit))) : 20;
    const safeSkip = Number.isFinite(Number(skip)) ? Math.max(0, Math.trunc(Number(skip))) : 0;

    const [data, total] = await Promise.all([
      this.anomalyCollection
        .find(filter, {session})
        .sort(sort)
        .limit(safeLimit)
        .skip(safeSkip)
        .toArray(),
      this.anomalyCollection.countDocuments(filter, {session}),
    ]);

    return {
      data: data.map(d => ({
        ...d,
        courseId: d.courseId?.toString(),
        versionId: d.versionId?.toString(),
        itemId: d.itemId?.toString(),
        userId: d.userId?.toString(),
      })),
      total,
    };
    // const sort: {[key: string]: 1 | -1} = {};
    // if (sortOptions?.field) {
    //   sort[sortOptions.field] = sortOptions.order === 'asc' ? 1 : -1;
    // } else {
    //   sort['createdAt'] = -1;
    // }

    // const [data, total] = await Promise.all([
    //   this.anomalyCollection
    //     .find({courseId, versionId}, {session})
    //     .sort(sort)
    //     .limit(limit)
    //     .skip(skip)
    //     .toArray(),
    //   this.anomalyCollection.countDocuments({courseId, versionId}, {session}),
    // ]);

    // return {data, total};
  }

  async getAnomaliesByItem(
    courseId: string,
    versionId: string,
    itemId: string,
    limit: number,
    skip: number,
    session?: ClientSession,
  ): Promise<IAnomalyData[]> {
    await this.init();
    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const filter = {
      courseId: {$in: normalizeId(courseId)},
      versionId: {$in: normalizeId(versionId)},
      itemId: {$in: normalizeId(itemId)},
    };

    const result = await this.anomalyCollection
      .find(filter, {session})
      .limit(limit)
      .skip(skip)
      .toArray();

    return result.map(d => ({
      ...d,
      courseId: d.courseId?.toString(),
      versionId: d.versionId?.toString(),
      itemId: d.itemId?.toString(),
      userId: d.userId?.toString(),
    }));
    // return await this.anomalyCollection
    //   .find(
    //     {courseId: courseId, versionId: versionId, itemId: itemId},
    //     {session},
    //   )
    //   .limit(limit)
    //   .skip(skip)
    //   .toArray();
  }

  async getCustomAnomalies(
    courseId: string,
    versionId: string,
    itemId?: string,
    userId?: string,
    session?: ClientSession,
  ): Promise<IAnomalyData[]> {
    await this.init();

    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const query: any = {
      courseId: {$in: normalizeId(courseId)},
      versionId: {$in: normalizeId(versionId)},
    };

    if (itemId) {
      query.itemId = {$in: normalizeId(itemId)};
    }
    if (userId) {
      query.userId = {$in: normalizeId(userId)};
    }

    const result = await this.anomalyCollection
      .find(query, {session})
      .toArray();

    return result.map(d => ({
      ...d,
      courseId: d.courseId?.toString(),
      versionId: d.versionId?.toString(),
      itemId: d.itemId?.toString(),
      userId: d.userId?.toString(),
    }));

    // optionally filter by itemId and userId
    // const query: any = {courseId: courseId, versionId: versionId};
    // if (itemId) {
    //   query.itemId = itemId;
    // }
    // if (userId) {
    //   query.userId = userId;
    // }
    // return await this.anomalyCollection.find(query, {session}).toArray();
  }

  async deleteAnomaly(
    anomalyId: string,
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const result = await this.anomalyCollection.deleteOne(
      {
        _id: new ObjectId(anomalyId),
        courseId: {$in: normalizeId(courseId)},
        versionId: {$in: normalizeId(versionId)},
      },
      {session},
    );
    // const result = await this.anomalyCollection.deleteOne(
    //   {_id: new ObjectId(anomalyId), courseId: courseId, versionId: versionId},
    //   {session},
    // );
    return result.deletedCount > 0;
  }

  async deleteAnomalysByUser(
    userId: string,
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const result = await this.anomalyCollection.deleteMany(
      {
        userId: {$in: normalizeId(userId)},
        courseId: {$in: normalizeId(courseId)},
        versionId: {$in: normalizeId(versionId)},
      },
      {session},
    );
    // const result = await this.anomalyCollection.deleteMany(
    //   {userId: userId, courseId: courseId, versionId: versionId},
    //   {session},
    // );
    return result.deletedCount > 0;
  }

  async deleteAnomalyByCourse(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const result = await this.anomalyCollection.deleteMany(
      {
        courseId: {$in: normalizeId(courseId)},
        versionId: {$in: normalizeId(versionId)},
      },
      {session},
    );

    // const result = await this.anomalyCollection.deleteMany(
    //   {courseId: courseId, versionId: versionId},
    //   {session},
    // );
    return result.deletedCount > 0;
  }

  async deleteAnomalyByVersionId(
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const normalizeId = (id: string) =>
      ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];

    const result = await this.anomalyCollection.deleteMany(
      {
        versionId: {$in: normalizeId(versionId)},
      },
      {session},
    );
    return result.deletedCount > 0;
  }
}
