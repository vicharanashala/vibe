import { BaseService, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerRepository } from "../repositories/index.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto, StudentLedgerDetailsDto } from "../classes/validators/ledgerValidators.js";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { BadRequestError } from "routing-controllers";



@injectable()
export class LedgerService extends BaseService {
    constructor(

        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.ledgerRepository)
        private readonly ledgerRepository: LedgerRepository,

        @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,

        @inject(HP_SYSTEM_TYPES.cohortRepository)
        private readonly cohortRepository: CohortRepository,


    ) {
        super(mongoDatabase);
    }


    async listByStudentId(
        studentId: string,
        filter: FilterQueryDto,
        courseId: string,
        courseVersionId: string,
        cohortName: string
    ): Promise<LedgerListResponseDto> {

        const student = await this.userRepo.findById(studentId);
        if (!student)
            throw new BadRequestError("Student not found");
        const enrollment = await this.cohortRepository.findEnrollment(studentId, courseId, courseVersionId)
        if (!enrollment)
            throw new BadRequestError("Enrollment not found");

        const studentDetails: StudentLedgerDetailsDto = {
            hpPoints: enrollment.hpPoints ?? 0,
            studentEmail: student.email,
            studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
        };
        const data = await this.ledgerRepository.listByStudentId(studentId, filter);

        return { studentDetails, ...data }
    }
}