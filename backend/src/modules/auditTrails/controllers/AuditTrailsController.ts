import { inject, injectable } from "inversify";
import { Authorized, BadRequestError, CurrentUser, Get, HttpCode, JsonController, Param, QueryParam } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { AUDIT_TRAILS_TYPES } from "../types.js";
import { AuditTrailsService } from "../services/AuditTrailsService.js";
import { BadRequestErrorResponse } from "#root/shared/index.js";
import { AuditTrailsResponse, AuditTrailUserIdParams } from "../classes/validators/AuditTrailsValidators.js";

@OpenAPI({
    tags: ["AuditTrails"],
    description: "Controller for managing audit trails",
})
@injectable()
@Authorized()
@JsonController("/audit-trails")
class AuditTrailsController{

    constructor(@inject(AUDIT_TRAILS_TYPES.AuditTrailsService) private readonly auditTrailsService: AuditTrailsService){}

    @OpenAPI({
        summary: "Get all audit trails",
        description: "Retrieve a list of all audit trails in the system",})
    @Authorized()
    @Get("/")
    @HttpCode(200)
    @ResponseSchema(AuditTrailsResponse,{
        description: "List of audit trails",
        statusCode: 200,
    })
    @ResponseSchema(BadRequestErrorResponse,{
        description: "Bad Request",
        statusCode: 400,
    })
    async getAllAuditTrails(@CurrentUser() user: {_id: string},){
        const auditTrails = await this.auditTrailsService.getAllAuditTrails(user._id);
        console.log("Current Data userId ", user._id);
        console.log("Audit Trails: ", auditTrails);
        return {
            message: "Audit trails retrieved successfully",
            data: auditTrails
        }
    }

    @OpenAPI({
        summary: "Get audit trails by courseId and versionId",
        description: "Retrieve audit trails for a specific course and version",
    })
    @Authorized()
    @Get("/course/:courseId/version/:versionId")
    @HttpCode(200)
    @ResponseSchema(AuditTrailsResponse,{
        description: "List of audit trails for the specified course and version",
        statusCode: 200,
    })
    @ResponseSchema(BadRequestErrorResponse,{
        description: "Bad Request",
        statusCode: 400,
    })

    async getAuditTrailsByCourseAndVersion(@Param("courseId") courseId: string, @Param("versionId") versionId: string,   @QueryParam("page") page: number = 1, @QueryParam("limit") limit: number = 10, @QueryParam("startDate") startDate?: string, @QueryParam("endDate") endDate?: string, ){
        const {data, totalDocuments} = await this.auditTrailsService.getAuditTrailsByCourseAndVersion(courseId, versionId, page, limit, startDate, endDate);
         return {
    message: "Audit trails retrieved successfully",
    data,
    totalDocuments,
    totalPages: Math.ceil(totalDocuments / limit),
    currentPage: page,
  };
    }
}


export { AuditTrailsController };