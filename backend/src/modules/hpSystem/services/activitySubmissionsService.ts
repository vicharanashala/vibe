import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivitySubmissionsRepository } from "../repositories/index.js";



@injectable()
export class ActivitySubmissionsService extends BaseService {
    constructor(

        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.activitySubmissionsRepository)
        private readonly activitySubmissionsRepository: ActivitySubmissionsRepository,

    ) {
        super(mongoDatabase);
    }



}