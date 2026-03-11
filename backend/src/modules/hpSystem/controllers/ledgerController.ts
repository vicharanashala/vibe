import { inject, injectable } from "inversify";
import { Authorized, Get, JsonController, Param, QueryParams } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerService } from "../services/ledgerService.js";
import { LedgerListResponseDto } from "../classes/validators/ledgerValidators.js";
import { FilterQueryDto } from "../classes/validators/activitySubmissionValidators.js";

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
    @Get("/student/:studentId/cohort/:cohortName/course/:courseId/courseVersion/:courseVersionId")
    @ResponseSchema(LedgerListResponseDto)
    async listByStudentId(
        @Param("studentId") studentId: string,
        @Param("courseId") courseId: string,
        @Param("courseVersionId") courseVersionId: string,
        @Param("cohortName") cohortName: string,
        @QueryParams() query: FilterQueryDto
    ): Promise<LedgerListResponseDto> {
        return this.ledgerService.listByStudentId(studentId, query);
    }

}