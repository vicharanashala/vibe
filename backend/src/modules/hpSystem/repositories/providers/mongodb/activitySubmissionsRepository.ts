import { ListSubmissionsQueryDto, SubmissionPayloadDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { IActivitySubmissionRepository } from "#root/modules/hpSystem/interfaces/IActivitySubmissionRepository.js";
import { HpActivitySubmission, SubmissionSource, SubmissionStatus } from "#root/modules/hpSystem/models.js";
import { ID, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

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


    async create(
        input: {
            courseId: ID;
            courseVersionId: ID;
            cohort: ID;
            activityId: ID;

            studentId: ID;
            studentEmail: string;
            studentName: string;

            payload: SubmissionPayloadDto;
            submissionSource: SubmissionSource;

            isLate: boolean;
        },
        opts?: { session?: ClientSession }
    ): Promise<string> {
        await this.init();

        const now = new Date();

        const doc = {
            ...input,

            status: "SUBMITTED" as SubmissionStatus,
            submittedAt: now,

            review: null,
            ledgerRefs: {
                rewardLedgerId: null,
                revertLedgerIds: [],
                penaltyLedgerId: null,
            },
            createdAt: now,
            updatedAt: now,
        }

        const res = await this.hpActivitySubmissionCollection.insertOne(doc as any, {
            session: opts?.session,
        });

        return res.insertedId.toString();
    }

    async findById(id: string, opts?: { session?: ClientSession }): Promise<any | null> {
        await this.init();
        if (!ObjectId.isValid(id)) return null;
        return this.hpActivitySubmissionCollection.findOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { session: opts?.session }
        );
    }

    async list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<any[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const sortOrder = query.sortOrder === "desc" ? -1 : 1;
        const sortByRaw = (query.sortBy ?? "submittedAt").trim();

        const SORT_MAP: Record<string, any> = {
            submittedAt: { submittedAt: sortOrder },
            status: { status: sortOrder },
            studentName: { studentName: sortOrder },
            studentEmail: { studentEmail: sortOrder },
            createdAt: { createdAt: sortOrder },
        };
        const sortStage = SORT_MAP[sortByRaw] ?? { submittedAt: -1 };

        const q: any = { isDeleted: { $ne: true } };

        if (query.courseVersionId) q.courseVersionId = query.courseVersionId;
        if (query.cohort) q.cohort = query.cohort;
        if (query.activityId) q.activityId = query.activityId;
        if (query.status) q.status = query.status;

        if (query.search?.trim()) {
            const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const r = new RegExp(safe, "i");
            q.$or = [{ studentName: r }, { studentEmail: r }];
        }

        return this.hpActivitySubmissionCollection
            .find(q, { session: opts?.session })
            .sort(sortStage)
            .skip(skip)
            .limit(limit)
            .toArray();
    }

    async updateStatusAndReview(
        id: string,
        update: any,
        opts?: { session?: ClientSession }
    ): Promise<void> {
        await this.init();
        if (!ObjectId.isValid(id)) return;

        await this.hpActivitySubmissionCollection.updateOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { $set: { ...update, updatedAt: new Date() } },
            { session: opts?.session }
        );
    }
}