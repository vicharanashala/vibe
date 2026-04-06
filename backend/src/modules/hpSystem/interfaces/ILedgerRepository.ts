import { ClientSession, InsertOneResult } from "mongodb";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
import { HpLedger } from "../models.js";
import { HpLedgerTransformer } from "../classes/transformers/Ledger.js";
import { EnrollmentRole } from "#root/shared/index.js";


export interface ILedgerRepository {
    create(entry: Omit<HpLedger, "_id" | "createdAt">, session?: ClientSession): Promise<InsertOneResult<HpLedger>>
    listByStudentId(
        studentId: string,
        filter: FilterQueryDto,
        cohortName: string,
        role: EnrollmentRole,
    ): Promise<{
        data: HpLedgerTransformer[];
        total: number;
        page: number;
        limit: number;
    }>

    findByStudentAndSubmissionId(submissionId: string, studentId: string): Promise<HpLedger | null>
    findByStudentAndActivityId(
        activityId: string,
        studentId: string
    ): Promise<HpLedger | null>
    findPenaltiesByActivityId(activityId: string): Promise<HpLedger[]>
    findRewardsByActivityId(activityId: string): Promise<HpLedger[]>
    findBySubmissionIds(submissionIds: string[]): Promise<HpLedger[]>

    getHpDistributionForCohort(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<{
        low: number;
        medium: number;
        high: number;
        veryHigh: number;
    }>;
    findRestoreBySubmissionId(submissionId: string): Promise<HpLedger | null>;
    findDebitBySubmissionId(submissionId: string): Promise<HpLedger | null>;

}