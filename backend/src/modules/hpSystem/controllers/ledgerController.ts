import { inject, injectable } from "inversify";
import { Authorized, CurrentUser, Get, JsonController, Param, QueryParams } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerService } from "../services/ledgerService.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";
import { IUser } from "#root/shared/index.js";

@OpenAPI({
    tags: ['HP Activities'],
    description: 'Operations for managing hp ledger',
})
@injectable()
@JsonController('/hp/ledger')
export class LedgerController {
    constructor(
        @inject(HP_SYSTEM_TYPES.ledgerService)
        private readonly ledgerService: LedgerService,
    ) { }

    @OpenAPI({ summary: "List ledger transactions by student" })
    @Authorized()
    @Get("/student/:studentId/cohort/:cohortId/course/:courseId/courseVersion/:courseVersionId")
    @ResponseSchema(LedgerListResponseDto)
    async listByStudentId(
        @CurrentUser() user: IUser,
        @Param("studentId") studentId: string,
        @Param("courseId") courseId: string,
        @Param("courseVersionId") courseVersionId: string,
        @Param("cohortId") cohortId: string,
        @QueryParams() query: FilterQueryDto
    ): Promise<LedgerListResponseDto> {
        const { _id: requested_user_id } = user;
        return this.ledgerService.listByStudentId(studentId, query, courseId, courseVersionId, cohortId, requested_user_id.toString());
    }

    @OpenAPI({ summary: "List my ledger transactions" })
    @Authorized()
    @Get("/student/my-ledger/course/:courseId/courseVersion/:courseVersionId/cohort/:cohortId")
    @ResponseSchema(LedgerListResponseDto)
    async getMyLedger(
        @CurrentUser() user: IUser,
        @Param("courseId") courseId: string,
        @Param("courseVersionId") courseVersionId: string,
        @Param("cohortId") cohortId: string,
        @QueryParams() query: FilterQueryDto
    ): Promise<LedgerListResponseDto> {
        const { _id: requested_user_id } = user;

        return this.ledgerService.listByStudentId(user._id.toString(), query, courseId, courseVersionId, cohortId, requested_user_id.toString());
    }

}