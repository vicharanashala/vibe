import { IActivitySubmissionRepository } from "#root/modules/hpSystem/interfaces/IActivitySubmissionRepository.js";
import { HpActivitySubmission } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection } from "mongodb";

@injectable()
export class ActivitySubmissionsRepository implements IActivitySubmissionRepository {
    private hpActivitySubmissionCollection: Collection<HpActivitySubmission>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpActivitySubmissionCollection = await this.db.getCollection<HpActivitySubmission>(
            'hp_activity_submissions',
        );
    }
}