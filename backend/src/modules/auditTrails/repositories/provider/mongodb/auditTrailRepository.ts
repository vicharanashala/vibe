import { IAuditTrailsRepository } from "#root/modules/auditTrails/interfaces/IAuditTrailsRepository.js";
import { inject } from "inversify";
import { Collection, ClientSession, ObjectId } from "mongodb";
import { GLOBAL_TYPES } from "#root/types.js";
import { MongoDatabase } from "#root/shared/index.js";
import { InstructorAuditTrail } from "#root/modules/auditTrails/interfaces/IAuditTrails.js";

class AuditTrailsRepository implements IAuditTrailsRepository {
  private auditTrailsCollection: Collection<InstructorAuditTrail>
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }
  private async init() {
    this.auditTrailsCollection = await this.db.getCollection<InstructorAuditTrail>('auditTrails');
  }

  async createAuditTrail(data: InstructorAuditTrail, session?: ClientSession): Promise<string> {
    await this.init();
    const result = await this.auditTrailsCollection.insertOne(data, { session });
    return result.insertedId.toString();
  }

  async getAllAuditTrailsByInstructorId(instructorId: string, session?: ClientSession): Promise<InstructorAuditTrail[]> {
    await this.init();
    const auditTrails = await this.auditTrailsCollection.find({ "actor.id": new ObjectId(instructorId) }, { session }).toArray();
    return auditTrails;
  }

  async getAuditTrailsByCourseAndVersion(
    courseId: string,
    versionId: string,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    session?: ClientSession
  ): Promise<{
    data: InstructorAuditTrail[];
    totalDocuments: number;
  }> {
    await this.init();

    const skip = (page - 1) * limit;

    const filter: any = {
      $or: [
        // Standard course-version scoped audit entries (modules, sections, items, etc.)
        {
          "context.courseVersionId": new ObjectId(versionId),
          $or: [
            { "context.courseId": new ObjectId(courseId) },
            { "context.courseId": { $exists: false } },
          ],
        },
        // COURSE_SPECIFIC announcement audit entries matching this course (no versionId)
        {
          category: "ANNOUNCEMENT",
          "context.courseId": new ObjectId(courseId),
          $or: [
            { "context.courseVersionId": { $exists: false } },
            { "context.courseVersionId": null },
          ],
        },
        // VERSION_SPECIFIC announcement audit entries matching this course+version
        {
          category: "ANNOUNCEMENT",
          "context.courseId": new ObjectId(courseId),
          "context.courseVersionId": new ObjectId(versionId),
        },
      ],
    };

    // 🔥 Add date filter dynamically
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        // Add end of day time so full day is included
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Count total matching documents
    const totalDocuments = await this.auditTrailsCollection.countDocuments(
      filter,
      { session }
    );

    // Fetch paginated results
    const data = await this.auditTrailsCollection
      .find(filter, { session })
      .sort({ createdAt: -1 }) // 🔥 Always sort audit logs newest first
      .skip(skip)
      .limit(limit)
      .toArray();
    return {
      data,
      totalDocuments,
    };
  }
}


export { AuditTrailsRepository }