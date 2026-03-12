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

    async createRuleConfig(input: Omit<HpRuleConfig, "_id">): Promise<HpRuleConfigTransformer> {
        await this.init();
        const result = await this.hpRuleConfigsCollection.insertOne(input as any);

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
        >
    ): Promise<HpRuleConfigTransformer | null> {
        await this.init();
        const _id = new ObjectId(ruleConfigId);

        const result = await this.hpRuleConfigsCollection.findOneAndUpdate(
            {
                _id, isDeleted: { $ne: true },
            },
            { $set: patch },
            { returnDocument: "after" }
        );
        return plainToInstance(HpRuleConfigTransformer, result as HpRuleConfig, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });
    }

    async findById(ruleConfigId: string): Promise<HpRuleConfigTransformer | null> {
        await this.init();
        const _id = new ObjectId(ruleConfigId);
        const doc = await this.hpRuleConfigsCollection.findOne({
            _id, isDeleted: { $ne: true },
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

    async getAllLateActivities() {
        
    }
}