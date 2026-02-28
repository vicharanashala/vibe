import { IActivityRepository } from "#root/modules/hpSystem/interfaces/IActivityRepository.js";
import { HpActivity, HpActivitySubmission } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection } from "mongodb";

@injectable()
export class ActivityRepository implements IActivityRepository {
    private hpActivityCollection: Collection<HpActivity>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpActivityCollection = await this.db.getCollection<HpActivity>('hp_activities');

    }
}