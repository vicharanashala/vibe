import { HpRuleConfigTransformer } from "../classes/transformers/RuleConfigs.js";
import { HpRuleConfig } from "../models.js";


export interface IRuleConfigsRepository {
    createRuleConfig(input: Omit<HpRuleConfig, "_id">): Promise<HpRuleConfigTransformer>;
    updateRuleConfig(
        ruleConfigId: string,
        patch: Partial<Omit<HpRuleConfig, "_id" | "courseId" | "courseVersionId" | "activityId" | "createdAt">>
    ): Promise<HpRuleConfigTransformer | null>;

    findById(ruleConfigId: string): Promise<HpRuleConfigTransformer | null>;
    findByActivityId(activityId: string): Promise<HpRuleConfigTransformer | null>;
}