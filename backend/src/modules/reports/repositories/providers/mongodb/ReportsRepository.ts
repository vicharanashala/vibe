import {IReport, IStatus} from '#shared/interfaces/index.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId, Filter} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  Report,
  ReportDataResponse,
  ReportFiltersQuery,
  ReportResponse,
} from '#root/modules/reports/classes/index.js';
import {plainToInstance} from 'class-transformer';
@injectable()
class ReportRepository {
  private reportCollection: Collection<IReport>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.reportCollection = await this.db.getCollection<IReport>('reports');
  }

  async getByCourseId(
    reportId: string,
    filters: ReportFiltersQuery,
    session?: ClientSession,
  ): Promise<ReportResponse | null> {
    await this.init();
    const {courseId, entityType, status, limit = 10, currentPage = 1} = filters;

    const query: Filter<IReport> = {
      courseId: new ObjectId(courseId),
    };
    if (entityType) query.entityType = entityType;
    if (status) query['status.0.status'] = status;
    const skip = (currentPage - 1) * limit;
    const [totalDocuments, reports] = await Promise.all([
      this.reportCollection.countDocuments(query, {session}),
      this.reportCollection
        .find(query, {session})
        .skip(skip)
        .limit(limit)
        .sort({createdAt: -1})
        .toArray(),
    ]);

    const totalPages = Math.ceil(totalDocuments / limit);
    const reportInstances = plainToInstance(ReportDataResponse, reports);

    return {
      totalDocuments,
      totalPages,
      currentPage,
      reports: reportInstances,
    };
  }

  async getById(
    reportId: string,
    session?: ClientSession,
  ): Promise<IReport | null> {
    return this.reportCollection.findOne(
      {_id: new ObjectId(reportId)},
      {session},
    );
  }
  async create(report: Report, session?: ClientSession) {
    await this.init();
    const result = await this.reportCollection.insertOne(report, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }

  async update(reportId: string, updateData: IStatus, session?: ClientSession) {
    await this.init();
    const result = await this.reportCollection.findOneAndUpdate(
      {_id: new ObjectId(reportId)},
      {
        $push: {status: updateData},
        $set: {updatedAt: new Date()},
      },
      {returnDocument: 'after', session},
    );
    return result;
  }
}

export {ReportRepository};
