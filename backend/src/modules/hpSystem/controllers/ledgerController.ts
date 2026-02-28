import { inject, injectable } from "inversify";
import { JsonController } from "routing-controllers";
import { OpenAPI } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { LedgerService } from "../services/ledgerService.js";

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


}