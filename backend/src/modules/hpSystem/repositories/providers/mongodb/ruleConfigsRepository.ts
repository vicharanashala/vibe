import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { IRuleConfigsRepository } from "#root/modules/hpSystem/interfaces/IRuleConfigsRepository.js";
import { HpLedger, HpRuleConfig } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection } from "mongodb";

@injectable()
export class RuleConfigsRepository implements IRuleConfigsRepository {
    private hpRuleConfigsCollection: Collection<HpRuleConfig>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpRuleConfigsCollection = await this.db.getCollection<HpRuleConfig>('hp_rule_configs');

    }
}