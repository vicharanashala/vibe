import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivitySubmissionsRepository, LedgerRepository } from "../repositories/index.js";
import { CreateHpActivitySubmissionBodyDto, FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsResponseDto } from "../classes/validators/activitySubmissionValidators.js";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { appConfig } from "#root/config/app.js";
import { Bucket, Storage } from '@google-cloud/storage';
import path from "path";
import { randomBytes } from "crypto";
import { ActivityService } from "./activityService.js";
import { RuleConfigService } from "./ruleConfigsService.js";
import { HpLedger } from "../models.js";
import { ObjectId } from "mongodb";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";


@injectable()
export class ActivitySubmissionsService extends BaseService {
    constructor(

        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.activitySubmissionsRepository)
        private readonly activitySubmissionsRepository: ActivitySubmissionsRepository,


        @inject(HP_SYSTEM_TYPES.activityService)
        private readonly activityService: ActivityService,


        @inject(HP_SYSTEM_TYPES.ruleConfigsService)
        private readonly ruleConfigService: RuleConfigService,


        @inject(HP_SYSTEM_TYPES.ledgerRepository)
        private readonly ledgerRepository: LedgerRepository,


        @inject(HP_SYSTEM_TYPES.cohortRepository)
        private readonly cohortRepository: CohortRepository,
    ) {
        super(mongoDatabase);
    }




    async submit(student: { id: string; email: string; name: string }, body: CreateHpActivitySubmissionBodyDto, upload?: { files?: Express.Multer.File[]; images?: Express.Multer.File[] }
    ) {
        return this._withTransaction(async (session) => {
            if (!body.courseId || !body.courseVersionId || !body.activityId || !body.cohort) {
                throw new BadRequestError("Missing required fields");
            }

            const activityId = body.activityId;

            const activity = await this.activityService.getById(activityId);
            if (!activity) {
                throw new BadRequestError("Activity not found");
            }

            const activityRuleConfig = await this.ruleConfigService.getByActivityId(activityId);
            if (!activityRuleConfig) {
                throw new BadRequestError("Activity rule config not found");
            }

            const cohort = body.cohort;

            // 1. Define the Cohort Override Map
            const COHORT_OVERRIDES: Record<string, { courseId: string; versionId: string }> = {
                Euclideans: { courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af" },
                Dijkstrians: { courseId: "6970f87e30644cbc74b6714f", versionId: "6970f87e30644cbc74b67150" },
                Kruskalians: { courseId: "697b4e262942654879011c56", versionId: "697b4e262942654879011c57" },
                RSAians: { courseId: "69903415e1930c015760a718", versionId: "69903415e1930c015760a719" },
                AKSians: { courseId: "69942dc6d6d99b252e3a54fe", versionId: "69942dc6d6d99b252e3a54ff" },
            };

            // 2. Apply Overrides (Fall back to body values if cohort isn't in the map)
            const finalCourseId = COHORT_OVERRIDES[cohort]?.courseId ?? body.courseId;
            const finalVersionId = COHORT_OVERRIDES[cohort]?.versionId ?? body.courseVersionId;

            // 3. Fetch Enrollment using the CORRECT (overridden) IDs
            const enrollment = await this.cohortRepository.findEnrollment(
                student.id,
                finalCourseId,
                finalVersionId,
                session
            );

            // if (!enrollment) {
            //     console.error(`Enrollment check failed for Student: ${student.id} in Course: ${finalCourseId}`);
            //     throw new BadRequestError(`Student is not enrolled in the required course context for cohort: ${cohort}`);
            // }

            // Determine if submission is late based on activity rule config deadline
            const deadline = activityRuleConfig?.deadlineAt
                ? new Date(activityRuleConfig.deadlineAt)
                : null;

            const now = new Date();

            const isLate = deadline ? now.getTime() > deadline.getTime() : false;


            if (isLate && activityRuleConfig.allowLateSubmission === false) {
                throw new BadRequestError("Late submission is not allowed for this activity");
            }

            const basePayload = {
                textResponse: body.payload?.textResponse ?? "",
                links: body.payload?.links ?? [],
            };

            const files = upload?.files ?? [];
            const images = upload?.images ?? [];

            // Validate uploads 
            for (const f of files) {
                if (f.mimetype !== "application/pdf") {
                    throw new BadRequestError(`Only PDF allowed in files. Invalid: ${f.originalname}`);
                }
            }
            for (const img of images) {
                if (!img.mimetype.startsWith("image/")) {
                    throw new BadRequestError(`Only images allowed in images. Invalid: ${img.originalname}`);
                }
            }

            // GCP Storage setup
            const storage = new Storage({
                keyFilename: appConfig.GOOGLE_APPLICATION_CREDENTIALS,
            });

            const bucketName = appConfig.GCP_BACKUP_ACTIVITY_BUCKET;
            const bucket = storage.bucket(bucketName);


            const uploadToGcp = async (f: Express.Multer.File, folder: string) => {
                const ext = path.extname(f.originalname) || "";
                const baseName = path.basename(f.originalname, ext);

                const safeBase = baseName.replace(/[^\w\-]+/g, "_");

                const unique = randomBytes(8).toString("hex");
                const timestamp = Date.now();

                const fileName = `${student.id}_${safeBase}_${timestamp}_${unique}${ext}`;

                const objectPath = `${folder}/${fileName}`;

                const file = bucket.file(objectPath);

                await file.save(f.buffer, {
                    resumable: false,
                    contentType: f.mimetype,
                    metadata: {
                        contentDisposition: `inline; filename="${f.originalname}"`,
                    },
                });

                const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

                const [signedUrl] = await file.getSignedUrl({
                    action: "read",
                    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
                });

                return {
                    fileId: objectPath,
                    url: signedUrl,
                    name: fileName,
                    mimeType: f.mimetype,
                    sizeBytes: f.size,
                };
            };

            // Upload concurrently
            const [uploadedPdfs, uploadedImages] = await Promise.all([
                Promise.all(
                    files.map((f) =>
                        uploadToGcp(
                            f,
                            `hp-activity-submissions/${body.cohort}/${body.activityId}/${student.id}/files`
                        )
                    )
                ),
                Promise.all(
                    images.map((img) =>
                        uploadToGcp(
                            img,
                            `hp-activity-submissions/${body.cohort}/${body.activityId}/${student.id}/images`
                        )
                    )
                ),
            ]);

            const payload = {
                ...basePayload,
                files: [
                    ...uploadedPdfs.map((x) => ({
                        fileId: x.fileId,
                        url: x.url,
                        name: x.name,
                        mimeType: x.mimeType,
                        sizeBytes: x.sizeBytes,
                    })),
                ],
                images: [
                    ...uploadedImages.map((x) => ({
                        fileId: x.fileId,
                        url: x.url,
                        name: x.name,
                    })),
                ],
            };


            // Create submission record, then calculate and apply rewards if applicable
            const submissionId = await this.activitySubmissionsRepository.create(
                {
                    courseId: new ObjectId(body.courseId),
                    courseVersionId: new ObjectId(body.courseVersionId),
                    cohort: body.cohort,
                    activityId: new ObjectId(body.activityId),

                    studentId: new ObjectId(student.id),
                    studentEmail: student.email,
                    studentName: student.name,

                    payload,
                    submissionSource: body.submissionSource ?? "IN_PLATFORM",
                    isLate,
                },
                { session }
            );

            if (!submissionId) {
                throw new Error("Failed to create submission");
            }

            const activityReward = activityRuleConfig.reward;
            console.log(activityReward, "Activity Reward Config");

            if (activityReward?.enabled && activityReward.applyWhen === "ON_SUBMISSION") {
                const totalStudentHpPoints = enrollment?.hpPoints ?? 0;
                const ruleType = activityReward.type;
                const rewardValue = activityReward.value ?? 0;

                let incrementAmount = 0;

                // 1. Calculate the Reward
                if (ruleType === "ABSOLUTE") {
                    incrementAmount = rewardValue;
                } else if (ruleType === "PERCENTAGE") {
                    // Percentage based on current total
                    incrementAmount = Math.round((totalStudentHpPoints * rewardValue) / 100);
                }

                // For transparency in the audit trail, we create a human-readable note about how the reward was calculated
                const rewardDetail = ruleType === "PERCENTAGE"
                    ? `${rewardValue}% of current HP`
                    : `${rewardValue} fixed points`;
                const statusDetail = isLate ? "Late Submission" : "On-time Submission";
                const readableNote = `[${statusDetail}] Received ${incrementAmount} HP (${rewardDetail}) for submitting activity: "${activity.title}".`;

                // 2. Prepare the Ledger Entry (Centralized)
                const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
                    courseId: new ObjectId(body.courseId),
                    courseVersionId: new ObjectId(body.courseVersionId),
                    cohort: body.cohort,
                    studentId: new ObjectId(student.id),
                    studentEmail: student.email,
                    activityId: new ObjectId(body.activityId),
                    submissionId: new ObjectId(submissionId),
                    eventType: "CREDIT",
                    direction: "CREDIT",
                    amount: incrementAmount,
                    calc: {
                        ruleType,
                        percentage: ruleType === "PERCENTAGE" ? rewardValue : undefined,
                        absolutePoints: ruleType === "ABSOLUTE" ? rewardValue : 0,
                        baseHpAtTime: totalStudentHpPoints,
                        computedAmount: totalStudentHpPoints + incrementAmount,
                        deadlineAt: activityRuleConfig.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null,
                        withinDeadline: !isLate,
                        reasonCode: "SUBMISSION_REWARD"
                    },
                    links: null,
                    meta: {
                        triggeredBy: "SYSTEM",
                        triggeredByUserId: new ObjectId(student.id),
                        note: readableNote
                    }
                };

                // 3. Atomic Database Operations
                // We create the audit trail and update the current balance
                await Promise.all([
                    this.ledgerRepository.create(ledgerEntry, session),
                    this.cohortRepository.setHPForEnrollment(
                        student.id,
                        body.courseId,
                        body.courseVersionId,
                        totalStudentHpPoints + incrementAmount,
                        session
                    )
                ]);
            }

            return { success: true, submissionId };

        });
    }

    async getById(id: string): Promise<any> {
        const doc = await this.activitySubmissionsRepository.findById(id);
        if (!doc) throw new NotFoundError("Submission not found");

        return {
            ...doc,
            _id: doc._id?.toString?.() ?? String(doc._id),
            submittedAt: doc.submittedAt?.toISOString?.() ?? doc.submittedAt,
            createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
            updatedAt: doc.updatedAt?.toISOString?.() ?? doc.updatedAt,
        };


    }

    async list(query: ListSubmissionsQueryDto): Promise<any[]> {
        const docs = await this.activitySubmissionsRepository.list(query);

        return docs.map((d) => ({
            ...d,
            _id: d._id?.toString?.() ?? String(d._id),
            submittedAt: d.submittedAt?.toISOString?.() ?? d.submittedAt,
            createdAt: d.createdAt?.toISOString?.() ?? d.createdAt,
            updatedAt: d.updatedAt?.toISOString?.() ?? d.updatedAt,
        }));
    }

    async listStudentWiseSubmssions(teacherId: string, studentId: string, body: ReviewHpActivitySubmissionBodyDto, query: FilterQueryDto): Promise<any> {
        const submissions = await this.activitySubmissionsRepository.getByStudentId(studentId, query);

        return {
            success: true,
            data: submissions,
            meta: {
                total: submissions.length,
                page: query.page ?? 1,
                limit: query.limit ?? 20,
            },
        };
    }

    async listMySubmissions(studentId: string, query: FilterQueryDto): Promise<any> {
        const submissions = await this.activitySubmissionsRepository.getByStudentId(studentId, query);

        return {
            success: true,
            data: submissions,
            meta: {
                total: submissions.length,
                page: query.page ?? 1,
                limit: query.limit ?? 20,
            },
        };
    }

    async review(submissionId: string, teacherId: string, body: ReviewHpActivitySubmissionBodyDto) {
        return this._withTransaction(async (session) => {
            const existing = await this.activitySubmissionsRepository.findById(submissionId, { session });
            if (!existing) throw new NotFoundError("Submission not found");

            // Only allow review from SUBMITTED
            // if (existing.status !== "SUBMITTED" && body.decision !== "REVERT") {
            //     throw new BadRequestError(`Cannot review submission in status ${existing.status}`);
            // }

            const statusMap = {
                APPROVE: "APPROVED",
                REJECT: "REJECTED",
                REVERT: "REVERTED",
            } as const;

            const newStatus = statusMap[body.decision];
            const review = {
                reviewedByTeacherId: teacherId,
                reviewedAt: new Date(),
                decision: body.decision,
                note: body.note ?? "",
            };

            await this.activitySubmissionsRepository.updateStatusAndReview(
                submissionId,
                { status: newStatus, review },
                { session }
            );

            // TODO: ledger updates in same transaction later
            return { success: true };
        });
    }

}