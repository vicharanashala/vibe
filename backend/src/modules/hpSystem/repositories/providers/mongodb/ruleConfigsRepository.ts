import { HpRuleConfigTransformer } from "#root/modules/hpSystem/classes/transformers/RuleConfigs.js";
import { IRuleConfigsRepository } from "#root/modules/hpSystem/interfaces/IRuleConfigsRepository.js";
import { HpRuleConfig } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

@injectable()
export class RuleConfigsRepository implements IRuleConfigsRepository {
    private hpRuleConfigsCollection!: Collection<HpRuleConfig>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private readonly db: MongoDatabase,
    ) { }

    async init() {
        this.hpRuleConfigsCollection =
            await this.db.getCollection<HpRuleConfig>("hp_activity_rules");
    }

    async createRuleConfig(input: Omit<HpRuleConfig, "_id">, session?: ClientSession): Promise<HpRuleConfigTransformer> {
        await this.init();
        const result = await this.hpRuleConfigsCollection.insertOne(input as HpRuleConfig, { session });

        const created = await this.hpRuleConfigsCollection.findOne({
            _id: result.insertedId, isDeleted: { $ne: true },

        });

        return plainToInstance(HpRuleConfigTransformer, created as HpRuleConfig, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });
    }

    async updateRuleConfig(
        ruleConfigId: string,
        patch: Partial<
            Omit<
                HpRuleConfig,
                "_id" | "courseId" | "courseVersionId" | "activityId" | "createdAt"
            >
        >, session?: ClientSession
    ): Promise<HpRuleConfigTransformer | null> {
        await this.init();
        const activityId = new ObjectId(ruleConfigId);

        const result = await this.hpRuleConfigsCollection.findOneAndUpdate(
            {
                activityId, isDeleted: { $ne: true },
            },
            { $set: patch },
            { returnDocument: "after", session }
        );
        return plainToInstance(HpRuleConfigTransformer, result as HpRuleConfig, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });
    }

    async findById(ruleConfigId: string): Promise<HpRuleConfigTransformer | null> {
        await this.init();
        const activityId = new ObjectId(ruleConfigId);
        console.log("Finding rule config by ID:", activityId);
        const doc = await this.hpRuleConfigsCollection.findOne({
            activityId, isDeleted: { $ne: true },
        });
        return plainToInstance(HpRuleConfigTransformer, doc as HpRuleConfig, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });
    }

    async findByActivityId(activityId: string): Promise<HpRuleConfigTransformer | null> {
        await this.init();
        const doc = await this.hpRuleConfigsCollection.findOne({
            activityId: new ObjectId(activityId), isDeleted: { $ne: true },
        });
        return plainToInstance(HpRuleConfigTransformer, doc as HpRuleConfig, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });
    }

    async softDeleteByActivityId(
        activityId: string,
        deletedByTeacherId?: string,
        session?: ClientSession,
    ): Promise<{ modifiedCount: number }> {
        await this.init();

        const filter: any = {
            activityId: new ObjectId(activityId) as any,
            isDeleted: { $ne: true },
        };

        const update: any = {
            $set: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        };

        if (deletedByTeacherId) {
            update.$set.deletedByTeacherId = new ObjectId(deletedByTeacherId);
        }

        const res = await this.hpRuleConfigsCollection.updateMany(
            filter,
            update,
            session ? { session } : undefined,
        );

        return { modifiedCount: res.modifiedCount ?? 0 };
    }

    async getAllMandatoryLateActivities(): Promise<HpRuleConfigTransformer[]> {
        await this.init();

        const now = new Date();

        return await this.hpRuleConfigsCollection.aggregate([
            {
                $match: {
                    isMandatory: true,
                    "penalty.enabled": true,
                    isDeleted: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: "hp_activities",
                    localField: "activityId",
                    foreignField: "_id",
                    as: "activity"
                }
            },
            {
                $unwind: "$activity"
            },
            {
                $match: {
                    "activity.status": "PUBLISHED",
                    // "activity.activityType": "ASSIGNMENT"
                }
            },
            {
                $addFields: {
                    effectiveDeadline: {
                        $add: [
                            "$deadlineAt",
                            { $multiply: ["$penalty.graceMinutes", 60000] }
                        ]
                    }
                }
            },
            {
                $match: {
                    effectiveDeadline: { $lt: now }
                }
            },
            {
                $project: {
                    activity: 0
                }
            }
        ]).toArray() as HpRuleConfigTransformer[]

        // return docs.map((doc: HpRuleConfigTransformer) => ({
        //     ...doc,
        //     _id: doc._id?.toString(),
        //     courseId: doc.courseId?.toString(),
        //     courseVersionId: doc.courseVersionId?.toString(),
        //     activityId: doc.activityId?.toString(),
        //     createdByTeacherId: doc.createdByTeacherId?.toString()
        // }));
    }

    async getAllMilestoneActivities(): Promise<HpRuleConfigTransformer[]> {
        await this.init();

        const now = new Date();

        return await this.hpRuleConfigsCollection.aggregate([
            {
                $match: {
                    isMandatory: true,
                    "reward.enabled": true,
                    isDeleted: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: "hp_activities",
                    localField: "activityId",
                    foreignField: "_id",
                    as: "activity"
                }
            },
            {
                $unwind: "$activity"
            },
            {
                $match: {
                    "activity.activityType": "VIBE_MILESTONE",
                    "activity.status": "PUBLISHED"
                }
            },
            {
                $addFields: {
                    effectiveDeadline: "$deadlineAt"
                }
            },
            {
                $match: {
                    effectiveDeadline: { $gte: now }
                }
            },
            {
                $project: {
                    activity: 0
                }
            }
        ]).toArray() as HpRuleConfigTransformer[];
        // return docs.map(doc => plainToInstance(HpRuleConfigTransformer, doc as HpRuleConfig, {
        //     excludeExtraneousValues: true,
        //     exposeDefaultValues: true,
        // }));
    }
}