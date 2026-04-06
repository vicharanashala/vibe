import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityRepository, RuleConfigsRepository } from "../repositories/index.js";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { HpRuleConfigTransformer } from "../classes/transformers/RuleConfigs.js";
import { ObjectId } from "mongodb";
import {
    CreateHpRuleConfigBody,
    PenaltyApplyWhenEnum,
    RewardApplyWhenEnum,
    UpdateHpRuleConfigBody,
} from "../classes/validators/ruleConfigValidators.js";
import { toObjectId } from "../utils/toObjectId.js";
import { HpRuleConfig, PenaltyApplyWhen, RewardApplyWhen, RuleType } from "../models.js";
import { CreateActivityWithRuleBody } from "../classes/validators/activityValidators.js";
import { ActivityService } from "./activityService.js";

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

        @inject(HP_SYSTEM_TYPES.activityRepository)
        private readonly activityRepository: ActivityRepository,

        @inject(HP_SYSTEM_TYPES.activityService)
        private readonly activiService: ActivityService,
    ) {
        super(mongoDatabase);
    }

    async create(body: CreateHpRuleConfigBody): Promise<HpRuleConfigTransformer> {
        // return this._withTransaction(async (session) => {

        try {
            const existing = await this.ruleConfigRepository.findByActivityId(body.activityId);
            if (existing) {
                throw new BadRequestError("Rule config already exists for this activity");
            }

            // Enforce VIBE_MILESTONE constraints
            const activity = await this.activityRepository.findById(body.activityId);

            if (!activity) {
                throw new BadRequestError("The selected activity could not be found.");
            }

            const isVibeMilestone = activity.activityType === "VIBE_MILESTONE";
            const isMandatory = body.isMandatory === true;
            const hasReward = body.reward?.enabled === true;
            const hasPenalty = body.penalty?.enabled === true;

            const allowLate = body.allowLateSubmission === true;
            const lateRewardAllowed = body.reward?.enabled === true && body.reward.lateBehavior === "REWARD";

            if (allowLate && lateRewardAllowed && hasPenalty) {
                throw new BadRequestError(
                    "Late reward and penalty can't be enabled at the same time."
                );
            }

            if (isVibeMilestone) {
                body.isMandatory = true;
                body.allowLateSubmission = false;

                if (hasReward) {
                    body.reward.applyWhen = "ON_MILESTONE_COMPLETION" as RewardApplyWhenEnum;
                    body.reward.lateBehavior === "NO_REWARD"
                }

                if (!body.deadlineAt) {
                    throw new BadRequestError(
                        "A deadline is required for Vibe Milestone activities."
                    );
                }
            }

            if (hasReward && body.reward.type === "PERCENTAGE" && (body.reward.value < 0 || body.reward.value > 100)) {
                throw new BadRequestError("Reward percentage must be between 0 and 100.");
            }

            if (hasPenalty && body.penalty.type === "PERCENTAGE" && (body.penalty.value < 0 || body.penalty.value > 100)) {
                throw new BadRequestError("Penalty percentage must be between 0 and 100.");
            }

            if (isMandatory && !hasPenalty) {
                throw new BadRequestError(
                    "Penalty cannot be disabled for mandatory activities."
                );
            }

            if (isMandatory && !body.deadlineAt) {
                throw new BadRequestError(
                    "A deadline is required for mandatory activities."
                );
            }

            if (body.deadlineAt) {
                const deadline = new Date(body.deadlineAt);

                if (isNaN(deadline.getTime())) {
                    throw new BadRequestError("The provided deadline is invalid.");
                }

                if (deadline < new Date()) {
                    throw new BadRequestError("The deadline cannot be set in the past.");
                }
            }

            if (!isVibeMilestone && (!body.submissionValidation || body.submissionValidation.length === 0)) {
                throw new BadRequestError("At least one submission field must be required");
            }

            const now = new Date();

            const doc: HpRuleConfigCreateDoc = {
                courseId: toObjectId(body.courseId, "courseId") as any,
                courseVersionId: toObjectId(body.courseVersionId, "courseVersionId") as any,
                activityId: toObjectId(body.activityId, "activityId") as any,

                isMandatory: body.isMandatory,
                deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : undefined,
                allowLateSubmission: body.allowLateSubmission,

                submissionValidation: body.submissionValidation,

                reward: body.reward.enabled
                    ? {
                        enabled: true,
                        type: body.reward.type as any,
                        value: body.reward.value,
                        applyWhen: body.reward.applyWhen as any,
                        lateBehavior: body.reward.lateBehavior as any,
                    }
                    : {
                        enabled: false,
                    },

                penalty: body.penalty.enabled
                    ? {
                        enabled: true,
                        type: body.penalty.type as RuleType,
                        value: body.penalty.value,
                        applyWhen: body.penalty.applyWhen as PenaltyApplyWhen,
                        graceMinutes: body.penalty.graceMinutes,
                        // runOnce: body.penalty.runOnce,
                    }
                    : {
                        enabled: false,
                    },

                limits: {
                    minHp: body.limits.minHp,
                    maxHp: body.limits.maxHp,
                },

                createdAt: now,
                updatedAt: now,
            };

            return this.ruleConfigRepository.createRuleConfig(doc);
        } catch (error) {
            if (body.activityId) {
                await this.activityRepository.deleteById(body.activityId);
            }
            throw error;
        }
        // })
    }

    async createActivityWithRule(teacherId: string, body: CreateActivityWithRuleBody): Promise<HpRuleConfigTransformer> {
        return this._withTransaction(async (session) => {
            const activity = await this.activiService.create(teacherId, body.activity);
            const ruleConfig = { ...body.ruleConfig, activityId: activity._id.toString()};
            return this.create(ruleConfig);
        });
    }

    async update(ruleConfigId: string, patch: UpdateHpRuleConfigBody): Promise<HpRuleConfigTransformer> {
        return this._withTransaction(async (session) => {

            if (!ObjectId.isValid(ruleConfigId)) {
                throw new BadRequestError("ruleConfigId is not a valid ObjectId");
            }

            console.log("patch.deadlineAt: ", patch.deadlineAt)
            const existing = await this.ruleConfigRepository.findById(ruleConfigId);


            if (!existing) {
                throw new NotFoundError("Rule config not found");
            }
            const hasReward = patch.reward?.enabled === true;
            const hasPenalty = patch.penalty?.enabled === true;

            // Enforce VIBE_MILESTONE constraints on update
            const activity = await this.activityRepository.findById(existing.activityId.toString());
            if (!activity) {
                throw new BadRequestError("The selected activity could not be found.");
            }

            const isVibeMilestone = activity?.activityType === "VIBE_MILESTONE";


            if (isVibeMilestone) {
                patch.isMandatory = true;
                patch.allowLateSubmission = false;
                if (hasReward) {
                    patch.reward.applyWhen = "ON_MILESTONE_COMPLETION" as RewardApplyWhenEnum;
                    patch.reward.lateBehavior === "NO_REWARD"
                }
                if (!patch.deadlineAt) {
                    throw new BadRequestError(
                        "A deadline is required for Vibe Milestone activities."
                    );
                }
            }

            if (hasReward && patch.reward.type === "PERCENTAGE" && (patch.reward.value < 0 || patch.reward.value > 100)) {
                throw new BadRequestError("Reward percentage must be between 0 and 100.");
            }

            if (hasPenalty && patch.penalty.type === "PERCENTAGE" && (patch.penalty.value < 0 || patch.penalty.value > 100)) {
                throw new BadRequestError("Penalty percentage must be between 0 and 100.");
            }


            const isMandatory = patch.isMandatory !== undefined ? patch.isMandatory : existing.isMandatory;
            const deadlineAt = patch.deadlineAt !== undefined ? patch.deadlineAt : existing.deadlineAt;

            if (isMandatory && !deadlineAt) {
                throw new BadRequestError("Deadline is required for mandatory activities");
            }

            if (patch.deadlineAt) {
                const newDeadline = new Date(patch.deadlineAt);
                if (newDeadline < new Date()) {
                    throw new BadRequestError("Deadline cannot be in the past");
                }
            }

            const updatePatch: HpRuleConfigUpdatePatch = {
                updatedAt: new Date(),
            };

            // Optional consistency guard: penalty only for mandatory
            if (patch.isMandatory === false) {
                if (patch.penalty) {
                    patch.penalty.enabled = false;
                } else if (existing.penalty?.enabled) {
                    updatePatch.penalty = { ...existing.penalty, enabled: false } as any;
                }
            }
            const finalAllowLate =
                patch.allowLateSubmission !== undefined
                    ? patch.allowLateSubmission
                    : existing.allowLateSubmission;

            const finalReward = {
                ...existing.reward,
                ...(patch.reward || {}),
            };

            const finalPenalty = {
                ...existing.penalty,
                ...(patch.penalty || {}),
            };
            const lateRewardAllowed =
                finalReward?.enabled === true &&
                finalReward?.lateBehavior === "REWARD";

            const penaltyEnabled = finalPenalty?.enabled === true;


            if (finalAllowLate && lateRewardAllowed && penaltyEnabled) {
                throw new BadRequestError("Late reward and penalty can't be enabled at the same time.");
            }

            if (patch.isMandatory !== undefined) updatePatch.isMandatory = patch.isMandatory;
            if (patch.deadlineAt !== undefined) updatePatch.deadlineAt = patch.deadlineAt ? new Date(patch.deadlineAt) : null as any;
            if (patch.allowLateSubmission !== undefined)
                updatePatch.allowLateSubmission = patch.allowLateSubmission;

            if (patch.reward !== undefined) updatePatch.reward = patch.reward as any;
            if (patch.penalty !== undefined) updatePatch.penalty = patch.penalty as any;
            if (patch.limits !== undefined) updatePatch.limits = patch.limits as any;

            // commenting this because this is unnecesarry check. This same check is below with proper distiction...
            // if (patch.submissionValidation !== undefined) {
            //     console.log("first if condition triggred...")
            //     if (!Array.isArray(patch.submissionValidation) || patch.submissionValidation.length === 0) {
            //         throw new BadRequestError("At least one submission field must be required");
            //     }
            // }

            const finalSubmissionValidation =
                patch.submissionValidation !== undefined
                    ? patch.submissionValidation
                    : existing.submissionValidation;

            if (!isVibeMilestone && (!finalSubmissionValidation || finalSubmissionValidation.length === 0)) {
                console.log("second if condition triggred....")
                throw new BadRequestError("At least one submission field must be required");
            }
            
            updatePatch.submissionValidation = patch.submissionValidation;

            const updated = await this.ruleConfigRepository.updateRuleConfig(ruleConfigId, updatePatch, session);
            if (!updated) {
                throw new NotFoundError("Rule config not found");
            }

            return updated;
        })
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