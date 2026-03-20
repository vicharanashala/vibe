import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { RuleConfigsRepository } from "../repositories/index.js";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { HpRuleConfigTransformer } from "../classes/transformers/RuleConfigs.js";
import { ObjectId } from "mongodb";
import {
    CreateHpRuleConfigBody,
    UpdateHpRuleConfigBody,
} from "../classes/validators/ruleConfigValidators.js";
import { toObjectId } from "../utils/toObjectId.js";
import { HpRuleConfig } from "../models.js";

type HpRuleConfigCreateDoc = Omit<HpRuleConfig, "_id">;

type HpRuleConfigUpdatePatch = Partial<
    Omit<HpRuleConfig, "_id" | "courseId" | "courseVersionId" | "activityId" | "createdAt">
>;

@injectable()
export class RuleConfigService extends BaseService {
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.ruleConfigsRepository)
        private readonly ruleConfigRepository: RuleConfigsRepository,
    ) {
        super(mongoDatabase);
    }

    async create(body: CreateHpRuleConfigBody): Promise<HpRuleConfigTransformer> {
        // Enforce 1 config per activity
        const existing = await this.ruleConfigRepository.findByActivityId(body.activityId);
        if (existing) {
            throw new BadRequestError("Rule config already exists for this activity");
        }

        // Optional consistency guard: penalty only for mandatory
        if (!body.isMandatory && body.penalty?.enabled) {
            throw new BadRequestError("Penalty can be enabled only for mandatory activities");
        }

        const now = new Date();

        const doc: HpRuleConfigCreateDoc = {
            courseId: toObjectId(body.courseId, "courseId") as any,
            courseVersionId: toObjectId(body.courseVersionId, "courseVersionId") as any,
            activityId: toObjectId(body.activityId, "activityId") as any,

            isMandatory: body.isMandatory,

            deadlineAt: new Date(body.deadlineAt),
            allowLateSubmission: body.allowLateSubmission,

            reward: {
                enabled: body.reward.enabled,
                type: body.reward.type as any,
                value: body.reward.value, 
                applyWhen: body.reward.applyWhen as any,
                lateBehavior: body.reward.lateBehavior as any,
            },

            penalty: {
                enabled: body.penalty.enabled,
                type: body.penalty.type as any,
                value: body.penalty.value,
                applyWhen: body.penalty.applyWhen as any,
                graceMinutes: body.penalty.graceMinutes,
                // runOnce: body.penalty.runOnce,
            },

            limits: {
                minHp: body.limits.minHp,
                maxHp: body.limits.maxHp,
            },

            createdAt: now,
            updatedAt: now,
        };

        return this.ruleConfigRepository.createRuleConfig(doc);
    }

    async update(ruleConfigId: string, patch: UpdateHpRuleConfigBody): Promise<HpRuleConfigTransformer> {
        if (!ObjectId.isValid(ruleConfigId)) {
            throw new BadRequestError("ruleConfigId is not a valid ObjectId");
        }

        const existing = await this.ruleConfigRepository.findById(ruleConfigId);
        console.log("Existing rule config:", existing);
        if (!existing) {
            throw new NotFoundError("Rule config not found");
        }
        

        // Optional consistency guard: penalty only for mandatory
        if (patch.isMandatory === false && patch.penalty?.enabled) {
            throw new BadRequestError("Penalty can be enabled only for mandatory activities");
        }

        const updatePatch: HpRuleConfigUpdatePatch = {
            updatedAt: new Date(),
        };

        if (patch.isMandatory !== undefined) updatePatch.isMandatory = patch.isMandatory;
        if (patch.deadlineAt !== undefined) updatePatch.deadlineAt = new Date(patch.deadlineAt);
        if (patch.allowLateSubmission !== undefined)
            updatePatch.allowLateSubmission = patch.allowLateSubmission;

        if (patch.reward !== undefined) updatePatch.reward = patch.reward as any;
        if (patch.penalty !== undefined) updatePatch.penalty = patch.penalty as any;
        if (patch.limits !== undefined) updatePatch.limits = patch.limits as any;

        const updated = await this.ruleConfigRepository.updateRuleConfig(ruleConfigId, updatePatch);
        if (!updated) {
            throw new NotFoundError("Rule config not found");
        }

        return updated;
    }

    async getById(ruleConfigId: string): Promise<HpRuleConfigTransformer> {

        if (ruleConfigId && !ObjectId.isValid(ruleConfigId)) {
            throw new BadRequestError("ruleConfigId is not a valid ObjectId");
        }
        const ruleConfig = await this.ruleConfigRepository.findById(ruleConfigId);

        if (!ruleConfig) {
            throw new NotFoundError("Rule config not found");
        }

        return ruleConfig;
    }

    async getByActivityId(activityId: string): Promise<HpRuleConfigTransformer> {

        if (activityId && !ObjectId.isValid(activityId)) {
            throw new BadRequestError("activityId is not a valid ObjectId");
        }
        const ruleConfig = await this.ruleConfigRepository.findByActivityId(activityId);

        if (!ruleConfig) {
            throw new NotFoundError("Rule config not found for this activity");
        }

        return ruleConfig;
    }
}