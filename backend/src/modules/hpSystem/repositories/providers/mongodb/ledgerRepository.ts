import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { HpLedger } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection } from "mongodb";

@injectable()
export class LedgerRepository implements ILedgerRepository {
    private hpLedgerCollection: Collection<HpLedger>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpLedgerCollection = await this.db.getCollection<HpLedger>('hp_ledger');

    }
}