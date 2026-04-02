import { BaseService, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerRepository } from "../repositories/index.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto, StudentLedgerDetailsDto } from "../classes/validators/ledgerValidators.js";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { BadRequestError, UnauthorizedError } from "routing-controllers";



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
        cohortName: string,
        requested_user_id?: string
    ): Promise<LedgerListResponseDto> {

        const student = await this.userRepo.findById(studentId);
        if (!student)
            throw new BadRequestError("Student not found");
        // Try to find enrollment for HP points, but don't fail if not found
        const requestedUserEnrollment = await this.cohortRepository.findEnrollment(requested_user_id, courseId, courseVersionId, cohortName)
        if (!requestedUserEnrollment)
            throw new UnauthorizedError(`Requested user is not found for this user id: ${student._id}, email: ${student.email}`)

        const enrollment = await this.cohortRepository.findEnrollment(studentId, courseId, courseVersionId, cohortName)
        if (!enrollment)
            throw new BadRequestError(`Enrollment not found for this user id: ${student._id}, email: ${student.email}`)

        const requested_user_role = requestedUserEnrollment.role

        const studentDetails: StudentLedgerDetailsDto = {
            hpPoints: enrollment?.hpPoints ?? 0,
            studentEmail: student.email,
            studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
        };
        const data = await this.ledgerRepository.listByStudentId(studentId, filter, cohortName, requested_user_role);

        return { studentDetails, ...data }
    }
}