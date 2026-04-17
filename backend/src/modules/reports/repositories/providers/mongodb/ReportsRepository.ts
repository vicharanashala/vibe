import { IReport, IStatus } from '#shared/interfaces/index.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId, Filter } from 'mongodb';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import {
  IssueSortEnum,
  IssueStatusEnum,
  Report,
  ReportFiltersQuery,
  ReportResponse,
} from '#root/modules/reports/classes/index.js';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { SORT_FIELD_MAP } from '#root/modules/reports/constants.js';
@injectable()
class ReportRepository {
  private reportCollection: Collection<IReport>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

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
    const { entityType, status, limit = 10, currentPage = 1 } = filters;
    const query: Filter<IReport> = {
      courseId: new ObjectId(courseId),
      versionId: new ObjectId(versionId),
    };
    if (entityType) query.entityType = entityType;
    // if (status) query['status.0.status'] = status;
    const skip = (currentPage - 1) * limit;

    const matchStage = { $match: query };

    const sortStatusStages = [
      {
        $addFields: {
          status: {
            $sortArray: {
              input: '$status',
              sortBy: { createdAt: -1 },
            },
          },
        },
      },
      {
        $addFields: {
          latestStatus: { $arrayElemAt: ['$status.status', 0] },
        },
      },
    ];

    const sortStage: any = {};

    const sortField =
      filters.sortBy && SORT_FIELD_MAP[filters.sortBy]
        ? SORT_FIELD_MAP[filters.sortBy]
        : 'createdAt';

    sortStage[sortField] = filters.sortOrder === 'asc' ? 1 : -1;




    const aggregationPipeline = [
      matchStage,
      ...sortStatusStages,
      ...(status ? [{ $match: { latestStatus: status } }] : []),
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit },
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
          _id: { $toString: '$_id' },
          courseId: { $toString: '$courseId' },
          versionId: { $toString: '$versionId' },
          entityId: { $toString: '$entityId' },
          reportedBy: {
            _id: { $toString: '$reportedByUser._id' },
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
      ...(status ? [{ $match: { latestStatus: status } }] : []),
      { $count: 'total' },
    ];

    const [countResult, reports] = await Promise.all([
      this.reportCollection.aggregate(countPipeline, { session }).toArray(),
      this.reportCollection.aggregate(aggregationPipeline, { session }).toArray(),
    ]);

    const totalDocuments = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(totalDocuments / limit);
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
      { $match: { _id: new ObjectId(reportId) } },
      // Reported By
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
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Course
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
          preserveNullAndEmptyArrays: true 
        } 
      },
      //cohort look up
      {
        $lookup: {
          from: "cohorts",
          localField: "cohortId",
          foreignField: "_id",
          as: "cohortData"
        }
      },
      {
        $unwind: {
          path: "$cohortData",
          preserveNullAndEmptyArrays: true
        }
      },
      // Version
      {
        $lookup: {
          from: 'newCourseVersion',
          localField: 'versionId',
          foreignField: '_id',
          as: 'versionData',
        },
      },
      { 
        $unwind: { 
          path: '$versionData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Find ItemsGroup
      {
        $lookup: {
          from: 'itemsGroup',
          let: { entityIdVar: '$entityId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $in: [
                        { $toString: '$$entityIdVar' },
                        {
                          $map: {
                            input: { $ifNull: ['$items', []] },
                            as: 'item',
                            in: { $toString: '$$item._id' },
                          },
                        },
                      ],
                    },
                    {
                      $in: [
                        { $toString: '$$entityIdVar' },
                        {
                          $map: {
                            input: { $ifNull: ['$items', []] },
                            as: 'item',
                            in: { $toString: '$$item.itemId' },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'itemsGroupData',
        },
      },
      { 
        $unwind: { 
          path: '$itemsGroupData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Video
      {
        $lookup: {
          from: 'videos',
          localField: 'entityId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'videoData',
        },
      },
      { 
        $unwind: { 
          path: '$videoData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Quiz
      {
        $lookup: {
          from: 'quizzes',
          localField: 'entityId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'quizData',
        },
      },
      { 
        $unwind: { 
          path: '$quizData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Blog
      {
        $lookup: {
          from: 'blogs',
          localField: 'entityId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'blogData',
        },
      },
      { 
        $unwind: { 
          path: '$blogData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Project
      {
        $lookup: {
          from: 'projects',
          localField: 'entityId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'projectData',
        },
      },
      { 
        $unwind: { 
          path: '$projectData', 
          preserveNullAndEmptyArrays: true 
        } 
      },
      // Resolve Item Name
      {
        $addFields: {
          itemName: {
            $ifNull: [
              '$videoData.name',
              {
                $ifNull: [
                  '$quizData.name',
                  {
                    $ifNull: [
                      '$blogData.name',
                      '$projectData.name',
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      // Flatten All Sections
      {
        $addFields: {
          allSections: {
            $reduce: {
              input: { $ifNull: ['$versionData.modules', []] },
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  { $ifNull: ['$$this.sections', []] },
                ],
              },
            },
          },
        },
      },
      // Find Matching Section
      {
        $addFields: {
          matchedSection: {
            $first: {
              $filter: {
                input: '$allSections',
                as: 'section',
                cond: {
                  $eq: [
                    { $toString: '$$section.itemsGroupId' },
                    { $toString: '$itemsGroupData._id' },
                  ],
                },
              },
            },
          },
        },
      },
      // Find Parent Module
      {
        $addFields: {
          matchedModule: {
            $first: {
              $filter: {
                input: { $ifNull: ['$versionData.modules', []] },
                as: 'module',
                cond: {
                  $in: [
                    { $toString: '$matchedSection.sectionId' },
                    {
                      $map: {
                        input: { $ifNull: ['$$module.sections', []] },
                        as: 'sec',
                        in: { $toString: '$$sec.sectionId' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      // Extract Names
      {
        $addFields: {
          moduleName: '$matchedModule.name',
          sectionName: '$matchedSection.name',
        },
      },
      // Cleanup Temporary Fields
      {
        $project: {
          allSections: 0,
          matchedSection: 0,
          matchedModule: 0,
        },
      },
      // Format Final Fields
      {
        $addFields: {
          _id: { $toString: '$_id' },
          versionId: { $toString: '$versionId' },
          entityId: { $toString: '$entityId' },

          cohortId: {
            $cond: {
              if: { $ifNull: ["$cohortId", false] },
              then: { $toString: "$cohortId" },
              else: "$$REMOVE",
            },
          },

          cohortName: "$cohortData.name",

          questionId: {
            $cond: {
              if: { $ifNull: ['$questionId', false] },
              then: { $toString: '$questionId' },
              else: '$$REMOVE',
            },
          },

          reportedBy: {
            _id: { $toString: '$reportedByUser._id' },
            firstName: '$reportedByUser.firstName',
            lastName: '$reportedByUser.lastName',
          },

          courseId: {
            _id: { $toString: '$courseData._id' },
            name: '$courseData.name',
            description: '$courseData.description',
          },
        },
      },
      // Final Cleanup
      {
        $project: {
          reportedByUser: 0,
          courseData: 0,
          versionData: 0,
          itemsGroupData: 0,
          videoData: 0,
          quizData: 0,
          blogData: 0,
          projectData: 0,
          moduleInfo: 0,
          cohortData: 0,
        },
      },
    ];
    const result = await this.reportCollection
      .aggregate(aggregationPipeline, { session })
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
        ...(report.cohortId ? { cohortId: new ObjectId(report.cohortId) } : {}),
      },
      { session },
    );

    // if (existingReport) {
    //   throw new BadRequestError(
    //     `You have already submitted a report for this ${report.entityType.toLowerCase()}.`,
    //   );
    // }
    const result = await this.reportCollection.insertOne(report, { session });
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
      { _id: new ObjectId(reportId) },
      {
        $push: { status: updateData },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after', session },
    );
    return result;
  }

  // async getByUserId(userId:string,filter:any,session?:ClientSession){
  //   await this.init()
  //   const result = await this.reportCollection.find({reportedBy: new ObjectId(userId)},{session})
  //   return result
  // }

  async findReportsByUser(
    userId: string,
    filter: { status?: IssueStatusEnum; search?: string; sort?: IssueSortEnum },
    skip: number,
    limit: number,
    session?: ClientSession,
  ): Promise<{ issues: IReport[]; totalDocuments: number }> {
    await this.init();

    const query: any = { reportedBy: new ObjectId(userId) };

    // status filter
    if (filter.status && filter.status !== 'ALL') {
      query['status.status'] = filter.status;
      // since status is an array, this matches if any object in array has given status
    }

    // search filter (on reason field)
    if (filter.search) {
      query.reason = { $regex: filter.search, $options: 'i' };
    }

    // sort filter (by entityType)
    let sortQuery: any = { createdAt: -1 }; // default

    if (filter.sort) {
      const [field, order] = filter.sort.split(':');

      sortQuery = {
        [field]: order === 'asc' ? 1 : -1,
      };
    }

    // const results = await this.reportCollection
    //   .find(query, { session })
    //   .sort(sortQuery)
    //   .skip(skip)
    //   .limit(limit)
    //   .toArray();

    const results = await this.reportCollection
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'newCourse',
            localField: 'courseId',
            foreignField: '_id',
            as: 'courseInfo',
          },
        },
        {
          $lookup: {
            from: 'cohorts',
            localField: 'cohortId',
            foreignField: '_id',
            as: 'cohortData',
          },
        },
        { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$cohortData', preserveNullAndEmptyArrays: true } },
        { $sort: sortQuery },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();
    const issues: IReport[] = results.map(item => ({
      ...item,
      _id: item._id?.toString(),
      courseId: item.courseInfo?.name || '-',
      cohortId: item.cohortData?._id?.toString() || '',
      cohortName: item.cohortData?.name || '',
      versionId: item.versionId?.toString(),
      entityId: item.entityId?.toString(),
      reportedBy: item.reportedBy?.toString(),
    }));

    const totalDocuments = await this.reportCollection.countDocuments(query, {
      session,
    });

    return { issues, totalDocuments };
  }

  async updateInterest(id: string, interest: string, session?: ClientSession) {
    await this.init();
    const result = await this.reportCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { satisfied: interest } },
      { upsert: true, session },
    );
    return result;
  }

  async deleteReportByVersionId(versionId: string, session?: ClientSession) {
    await this.init();
    const result = await this.reportCollection.deleteMany(
      { versionId: new ObjectId(versionId) },
      { session },
    );
    return result;
  }
}

export { ReportRepository };
