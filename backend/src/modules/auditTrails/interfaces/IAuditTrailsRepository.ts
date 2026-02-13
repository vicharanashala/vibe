import { AuditCategory, InstructorAuditTrail } from "./IAuditTrails.js";
import { AuditAction } from "./IAuditTrails.js";
import { ClientSession } from "mongodb";

export interface IAuditTrailsRepository{
    createAuditTrail(
        data: InstructorAuditTrail,
        session?: ClientSession
    ): Promise<string>;
}