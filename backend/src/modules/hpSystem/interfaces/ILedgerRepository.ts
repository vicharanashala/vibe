import { ClientSession, InsertOneResult } from "mongodb";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
import { HpLedger } from "../models.js";


export interface ILedgerRepository {
    create(entry: Omit<HpLedger, "_id" | "createdAt">, session?: ClientSession): Promise<InsertOneResult<HpLedger>>
    listByStudentId(
        studentId: string,
        filter: FilterQueryDto
    ): Promise<Omit<LedgerListResponseDto, "studentDetails">>

    findByStudentAndSubmissionId(submissionId: string, studentId: string): Promise<HpLedger | null>
}