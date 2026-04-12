import { InstructorAuditTrail } from "#root/modules/auditTrails/interfaces/IAuditTrails.js";

export function setAuditTrail(req: any, audit: Partial<InstructorAuditTrail>) {
  req.auditTrail = audit;
}