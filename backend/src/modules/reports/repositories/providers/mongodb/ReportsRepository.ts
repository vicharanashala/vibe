import {IReport, IStatus} from '#shared/interfaces/index.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId, Filter} from 'mongodb';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  Report,
  ReportFiltersQuery,
  ReportResponse,
} from '#root/modules/reports/classes/index.js';
import {instanceToPlain, plainToInstance} from 'class-transformer';
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

  async getByCourse(
    courseId: string,
    versionId: string,
    filters: ReportFiltersQuery,
    session?: ClientSession,
  ): Promise<ReportResponse | null> {
    await this.init();
    const {entityType, status, limit = 10, currentPage = 1} = filters;
    const query: Filter<IReport> = {
      courseId: new ObjectId(courseId),
      versionId: new ObjectId(versionId),
    };
    if (entityType) query.entityType = entityType;
    // if (status) query['status.0.status'] = status;
    const skip = (currentPage - 1) * limit;

    const matchStage = {$match: query};

    const sortStatusStages = [
      {
        $addFields: { 
          status: {
            $sortArray: {
              input: '$status',
              sortBy: {createdAt: -1},
            },
          },
        },
      },
      {
        $addFields: {
          latestStatus: {$arrayElemAt: ['$status.status', 0]},
        },
      },
    ];

    const aggregationPipeline = [
      matchStage,
      ...sortStatusStages,
      ...(status ? [{$match: {latestStatus: status}}] : []),
      {$sort: {createdAt: -1}},
      {$skip: skip},
      {$limit: limit},
      {
        $lookup: {
          from: 'users',
          localField: 'reportedBy',
          foreignField: '_id',
          as: 'reportedByUser',
        },
      },
      {
        $unwind: {
          path: '$reportedByUser',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          _id: {$toString: '$_id'},
          courseId: {$toString: '$courseId'},
          versionId: {$toString: '$versionId'},
          entityId: {$toString: '$entityId'},
          reportedBy: {
            _id: {$toString: '$reportedByUser._id'},
            firstName: '$reportedByUser.firstName',
            lastName: '$reportedByUser.lastName',
          },
        },
      },
      {
        $project: {
          reportedByUser: 0,
        },
      },
    ];

    const countPipeline = [
      matchStage,
      ...sortStatusStages,
      ...(status ? [{$match: {latestStatus: status}}] : []),
      {$count: 'total'},
    ];

    const [countResult, reports] = await Promise.all([
      this.reportCollection.aggregate(countPipeline, {session}).toArray(),
      this.reportCollection.aggregate(aggregationPipeline, {session}).toArray(),
    ]);

    const totalDocuments = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(totalDocuments / limit);
    console.log('Total pages: ', totalPages, 'Total doc: ', totalDocuments);
    const result = plainToInstance(ReportResponse, {
      totalDocuments,
      totalPages,
      currentPage,
      reports: reports,
    });
    return result;
  }

  async getById(
    reportId: string,
    session?: ClientSession,
  ): Promise<IReport | null> {
    await this.init();
    const aggregationPipeline = [
      {$match: {_id: new ObjectId(reportId)}},
      {
        $lookup: {
          from: 'users',
          localField: 'reportedBy',
          foreignField: '_id',
          as: 'reportedByUser',
        },
      },
      {
        $unwind: {
          path: '$reportedByUser',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: 'newCourse',
          localField: 'courseId',
          foreignField: '_id',
          as: 'courseData',
        },
      },
      {
        $unwind: {
          path: '$courseData',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          reportedBy: {
            _id: '$reportedByUser._id',
            firstName: '$reportedByUser.firstName',
            lastName: '$reportedByUser.lastName',
          },
          courseId: {
            _id: '$courseData._id',
            name: '$courseData.name',
            description: '$courseData.description',
          },
        },
      },

      {
        $project: {
          reportedByUser: 0,
          courseData: 0,
        },
      },
    ];

    const result = await this.reportCollection
      .aggregate(aggregationPipeline, {session})
      .toArray();

    const report = result[0];
    if (!report) {
      throw new NotFoundError(`Report with reportId: ${reportId} not found`);
    }

    return report;
  }

  async create(report: Report, session?: ClientSession) {
    await this.init();
    const existingReport = await this.reportCollection.findOne(
      {
        courseId: report.courseId,
        versionId: report.versionId,
        entityId: report.entityId,
        entityType: report.entityType,
      },
      {session},
    );

    if (existingReport) {
      throw new BadRequestError(
        `You have already submitted a report for this ${report.entityType.toLowerCase()}.`,
      );
    }
    const result = await this.reportCollection.insertOne(report, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create report');
  }

  async update(reportId: string, updateData: IStatus, session?: ClientSession) {
    await this.init();
    if (!ObjectId.isValid(reportId)) {
      throw new BadRequestError('Invalid report ID');
    }

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
