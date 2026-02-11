import { inject, injectable } from "inversify";
import { Authorized, BadRequestError, CurrentUser, Get, HttpCode, JsonController, Param } from "routing-controllers";
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
        return {
            message: "Audit trails retrieved successfully",
            data: {
                user,
            }
        }
    }
}


export { AuditTrailsController };