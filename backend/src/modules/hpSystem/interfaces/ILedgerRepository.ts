import { InsertOneResult } from "mongodb";
import { HpLedger } from "../models.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";


export interface ILedgerRepository {
    create(entry: Omit<HpLedger, "_id" | "createdAt">): Promise<InsertOneResult<HpLedger>>
    listByStudentId(
        studentId: string,
        filter: FilterQueryDto
    ): Promise<HpLedger[]>
}