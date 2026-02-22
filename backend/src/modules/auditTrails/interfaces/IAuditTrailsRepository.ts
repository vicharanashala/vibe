import { AuditCategory, InstructorAuditTrail } from "./IAuditTrails.js";
import { AuditAction } from "./IAuditTrails.js";
import { ClientSession } from "mongodb";

export interface IAuditTrailsRepository{
    createAuditTrail(
        data: InstructorAuditTrail,
        session?: ClientSession
    ): Promise<string>;

    getAllAuditTrailsByInstructorId(
        instructorId: string,
        session?: ClientSession
    ): Promise<InstructorAuditTrail[]>;

    getAuditTrailsByCourseAndVersion(
        userId: string,
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
    }>;
}