import { ClientSession, InsertOneResult } from "mongodb";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
import { HpLedger } from "../models.js";
import { HpLedgerTransformer } from "../classes/transformers/Ledger.js";


export interface ILedgerRepository {
    create(entry: Omit<HpLedger, "_id" | "createdAt">, session?: ClientSession): Promise<InsertOneResult<HpLedger>>
    listByStudentId(
        studentId: string,
        filter: FilterQueryDto
    ): Promise<{
        data: HpLedgerTransformer[];
        total: number;
        page: number;
        limit: number;
    }>

    findByStudentAndSubmissionId(submissionId: string, studentId: string): Promise<HpLedger | null>
}