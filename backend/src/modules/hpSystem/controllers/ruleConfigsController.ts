import { inject, injectable } from "inversify";
import { JsonController } from "routing-controllers";
import { OpenAPI } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { RuleConfigService } from "../services/ruleConfigsService.js";

@OpenAPI({
    tags: ['HP Activities'],
    description: 'Operations for managing hp rule configurations',
})
@injectable()
@JsonController('/hp/rule-config')
export class RuleConfigsController {
    constructor(
        @inject(HP_SYSTEM_TYPES.ruleConfigsService)
        private readonly ledgerService: RuleConfigService,
    ) { }


}