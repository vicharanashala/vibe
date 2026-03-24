import { inject, injectable } from "inversify";
import {
    Authorized,
    Body,
    Get,
    HttpCode,
    JsonController,
    Param,
    Post,
    Put,
} from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { RuleConfigService } from "../services/ruleConfigsService.js";
import {
    CreateHpRuleConfigBody,
    UpdateHpRuleConfigBody,
} from "../classes/validators/ruleConfigValidators.js";
import { BadRequestErrorResponse } from "#root/shared/index.js";
import { instanceToPlain } from "class-transformer";

@OpenAPI({
    tags: ["HP Rule Configs"],
    description: "Operations for managing HP rule configurations",
})
@injectable()
@JsonController("/hp/rule-config")
export class RuleConfigsController {
    constructor(
        @inject(HP_SYSTEM_TYPES.ruleConfigsService)
        private readonly ruleConfigService: RuleConfigService,
    ) { }

    @OpenAPI({ summary: "Create HP rule configuration" })
    @Authorized()
    @HttpCode(201)
    @ResponseSchema(BadRequestErrorResponse, {
        description: "Bad Request Error",
        statusCode: 400,
    })
    @Post("/")
    async create(@Body() body: CreateHpRuleConfigBody) {
        const data = await this.ruleConfigService.create(body);
        return {
            success: true,
            message: "Rule config created successfully",
            data: instanceToPlain(data),
        };
    }

    @OpenAPI({ summary: "Update HP rule configuration" })
    @Authorized()
    @Put("/:ruleConfigId")
    async update(
        @Param("ruleConfigId") ruleConfigId: string,
        @Body() body: UpdateHpRuleConfigBody,
    ) {
        // console.log("Received update request for ruleConfigId:", ruleConfigId);
        // console.log("Update body:", body);
        const data = await this.ruleConfigService.update(ruleConfigId, body);
        return {
            success: true,
            message: "Rule config updated successfully",
            data: instanceToPlain(data),
        };
    }

    @OpenAPI({ summary: "Get rule config by activity id" })
    @Authorized()
    @Get("/activity/:activityId")
    async getByActivityId(@Param("activityId") activityId: string) {
        const data = await this.ruleConfigService.getByActivityId(activityId);
        return {
            success: true,
            data: instanceToPlain(data),
        };
    }

    @OpenAPI({ summary: "Get rule config by id" })
    @Authorized()
    @Get("/:ruleConfigId")
    async getById(@Param("ruleConfigId") ruleConfigId: string) {
        const data = await this.ruleConfigService.getById(ruleConfigId);
        return {
            success: true,
            data: instanceToPlain(data),
        };
    }
}