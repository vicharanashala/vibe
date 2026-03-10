import { BaseService, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerRepository } from "../repositories/index.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
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
        filter: FilterQueryDto
    ): Promise<LedgerListResponseDto> {

        const student = await this.userRepo.findById(studentId);
        if (!student)
            throw new BadRequestError("Student not found");

        const paginatedData = await this.ledgerRepository.listByStudentId(studentId, filter);

        return {
            ...paginatedData,
            studentDetails: {
                studentName: `${student.firstName} ${student.lastName}`.trim(),
                studentEmail: student.email,
                hpPoints: (student as any).hpPoints || 0
            }
        };
    }
}