import { getContainer } from "#root/bootstrap/loadModules.js"
import { ActivityRepository, ActivitySubmissionsRepository, LedgerRepository, RuleConfigsRepository } from "../repositories/index.js";
import { HP_SYSTEM_TYPES } from "../types.js";




export const allocatePenality = () => {
    const container = getContainer();

    const activityRepo = container.get<ActivityRepository>(HP_SYSTEM_TYPES.activityRepository);
    const activityConfigsRepo = container.get<RuleConfigsRepository>(HP_SYSTEM_TYPES.ruleConfigsRepository);
    const activitySubmissionRepo = container.get<ActivitySubmissionsRepository>(HP_SYSTEM_TYPES.activitySubmissionsRepository);
    const ledgerRepo = container.get<LedgerRepository>(HP_SYSTEM_TYPES.ledgerRepository);

    



}