import { BaseService, IUser, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityRepository, ActivitySubmissionsRepository, LedgerRepository } from "../repositories/index.js";
import { CreateHpActivitySubmissionBodyDto, FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsResponseDto, StudentActivitySubmissionStatsResponseDto, StudentActivitySubmissionStatsViewDto, StudentActivitySubmissionsViewDto } from "../classes/validators/activitySubmissionValidators.js";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { appConfig } from "#root/config/app.js";
import { Bucket, Storage } from '@google-cloud/storage';
import path from "path";
import { randomBytes } from "crypto";
import { ActivityService } from "./activityService.js";
import { RuleConfigService } from "./ruleConfigsService.js";
import { HpActivitySubmission, HpLedger, HpLedgerDirection, HpLedgerEventType, HpReasonCode, ReviewDecision, TriggeredBy } from "../models.js";
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


        @inject(HP_SYSTEM_TYPES.activityRepository)
        private readonly activityRepository: ActivityRepository,

        @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,

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

            const latestSubmissions = await this.activitySubmissionsRepository.getLatestByStudentId(student.id, activityId)
            if (latestSubmissions && latestSubmissions.status !== "REVERTED")
                throw new BadRequestError("You have already attended this activity.")

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

    async listStudentCohortWiseSubmssions(teacherId: string, studentId: string, query: FilterQueryDto, cohortName: string): Promise<StudentActivitySubmissionsResponseDto> {

        const submissions = await this.activitySubmissionsRepository.getByStudentId(studentId, query, undefined,
            undefined, cohortName);

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

    async listStudentWiseSubmissionsStats(
        studentId: string,
        cohortName: string
    ): Promise<StudentActivitySubmissionStatsResponseDto> {
        if (!studentId) {
            throw new BadRequestError("Student id not found");
        }

        const student = await this.userRepo.findById(studentId);
        if (!student) {
            throw new BadRequestError("Student not found");
        }

        const COHORT_OVERRIDES: Record<string, { courseId: string; versionId: string }> = {
            Euclideans: { courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af" },
            Dijkstrians: { courseId: "6970f87e30644cbc74b6714f", versionId: "6970f87e30644cbc74b67150" },
            Kruskalians: { courseId: "697b4e262942654879011c56", versionId: "697b4e262942654879011c57" },
            RSAians: { courseId: "69903415e1930c015760a718", versionId: "69903415e1930c015760a719" },
            AKSians: { courseId: "69942dc6d6d99b252e3a54fe", versionId: "69942dc6d6d99b252e3a54ff" },
        };

        let courseId: string;
        let courseVersionId: string;

        const override = COHORT_OVERRIDES[cohortName];

        if (override) {
            courseId = override.courseId;
            courseVersionId = override.versionId;
        } else {
            const latestActivity = await this.activityRepository.getLatestActivityByCohortName(cohortName);

            if (!latestActivity) {
                return {
                    success: true,
                    data: {
                        totalActivities: 0,
                        totalSubmissions: 0,
                        totalLateSubmissions: 0,
                        totalPendings: 0,
                        currentHp: 0,
                    },
                };
            }

            courseId = latestActivity.courseId.toString();
            courseVersionId = latestActivity.courseVersionId.toString();
        }

        const [
            totalActivities,
            totalSubmissions,
            totalLateSubmissions,
            totalPendingActivites,
            enrollment,
        ] = await Promise.all([
            this.activityRepository.getCountByCohortName(cohortName),
            this.activitySubmissionsRepository.getCountByStudentId(studentId, courseId, courseVersionId),
            this.activitySubmissionsRepository.getLateSubmissionCountByStudentId(studentId, courseId, courseVersionId),
            this.activityRepository.getPendingActivitesCount(studentId, courseId, courseVersionId),
            this.cohortRepository.findEnrollment(studentId, courseId, courseVersionId),
        ]);

        const data: StudentActivitySubmissionStatsViewDto = {
            totalActivities,
            totalSubmissions,
            totalLateSubmissions,
            totalPendings: totalPendingActivites,
            currentHp: enrollment?.hpPoints ?? 0,
        };

        return {
            success: true,
            data,
        };
    }

    async listMySubmissions(studentId: string, query: FilterQueryDto, cohortName?: string): Promise<any> {
        const submissions = await this.activitySubmissionsRepository.getByStudentId(studentId, query, undefined, undefined, cohortName);

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
            // 1. Initial Data Fetching
            const submission = await this.activitySubmissionsRepository.findById(submissionId, { session });
            if (!submission) throw new NotFoundError(`Submission ${submissionId} not found.`);

            const [activityRuleConfig, user, enrollment] = await Promise.all([
                this.ruleConfigService.getByActivityId(submission.activityId.toString()),
                this.userRepo.findById(submission.studentId.toString()),
                this.cohortRepository.findEnrollment(submission.studentId.toString(), submission.courseId.toString(), submission.courseVersionId.toString())
            ]);

            if (!user || !enrollment) throw new BadRequestError(!user ? "Student account missing." : "Enrollment data missing.");

            // 2. Flags & Config
            const rewardConfig = activityRuleConfig?.reward;
            const currentStatus = submission.status;
            const totalStudentHpPoints = enrollment.hpPoints ?? 0;
            const ruleType = rewardConfig?.type ?? "ABSOLUTE";
            const isApprovalRequired = rewardConfig?.enabled && rewardConfig.applyWhen === "ON_APPROVAL";

            const isApprove = body.decision === "APPROVED";
            const isRevert = body.decision === "REVERTED";
            const isReject = body.decision === "REJECTED";

            const deadline = activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null;
            const isLate = deadline && new Date() > deadline;

            // 3. Validation
            if (["REVERTED", "REJECTED"].includes(currentStatus)) throw new BadRequestError(`Submission is already ${currentStatus}.`);

            if (isApprovalRequired && !isApprove && currentStatus == "SUBMITTED") {
                throw new BadRequestError("This activity requires approval. Only APPROVE is allowed.");
            }

            if (isApprove && (currentStatus === "APPROVED" || (currentStatus === "SUBMITTED" && rewardConfig?.applyWhen !== "ON_APPROVAL"))) {
                throw new BadRequestError("Conflict: Points already granted. Use REVERT or REJECT.");
            }


            // 3. Deadline Checks for Approval
            if (body.decision === "APPROVED") {
                // const deadline = activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null;
                // const isLate = deadline && new Date() > deadline;

                if (isLate && rewardConfig?.lateBehavior === "NO_REWARD") {
                    throw new BadRequestError("Cannot approve: Late submissions receive no reward.");
                }
                if (isLate && rewardConfig?.onlyWithinDeadline) {
                    throw new BadRequestError("Cannot approve: Submission is past the deadline.");
                }
            }


            // 4. Calculate Changes
            const ledgerPromises: Promise<any>[] = [];
            let finalHpBalance = totalStudentHpPoints;
            const teacherNote = body.note ?? "";

            // CASE A: APPROVE
            if (isApprove) {
                const rewardAmount = rewardConfig?.value ?? 0;
                finalHpBalance += rewardAmount;

                ledgerPromises.push(this.ledgerRepository.create(
                    this._buildLedgerData(submission, user, "CREDIT", "CREDIT", rewardAmount, totalStudentHpPoints, finalHpBalance, "SUBMISSION_REWARD", teacherNote || "Activity approved.", null, teacherId, activityRuleConfig, isLate),
                    session
                ));
            }

            // CASE B: REVERT OR REJECT (Common Step: Undo Original Reward)
            if (isRevert || isReject) {
                const originalLedger = await this.ledgerRepository.findByStudentAndSubmissionId(submissionId, submission.studentId.toString());
                if (!originalLedger) throw new BadRequestError("Original reward ledger not found to reverse.");

                const rewardToUndo = originalLedger.amount ?? 0;
                const hpBeforeReversal = finalHpBalance;
                finalHpBalance -= rewardToUndo;

                // First Ledger: The Reversal
                ledgerPromises.push(this.ledgerRepository.create(
                    this._buildLedgerData(submission, user, "REVERSAL", "DEBIT", rewardToUndo, hpBeforeReversal, finalHpBalance, "REWARD_REVERSAL", `Reversed original reward of ${rewardToUndo} HP.`, originalLedger._id.toString(), teacherId, activityRuleConfig),
                    session
                ));

                // CASE C: ADDITIONAL REJECTION PENALTY
                if (isReject) {
                    const penaltyAmount = Number(body.pointsToDeduct) ?? 0;
                    if (penaltyAmount > 0) {
                        const hpBeforePenalty = finalHpBalance - rewardToUndo; // consider first we reverted so need to -rewardtoUndo value after revert entry we are storing rejected ledger
                        finalHpBalance -= penaltyAmount;

                        // Second Ledger: The Penalty
                        ledgerPromises.push(this.ledgerRepository.create(
                            this._buildLedgerData(submission, user, "REJECTION", "DEBIT", penaltyAmount, hpBeforePenalty, finalHpBalance, "REJECTION_PENALTY", teacherNote || `Penalty applied for rejected submission.`, null, teacherId, activityRuleConfig),
                            session
                        ));
                    }
                }
            }

            // 5. Finalize Updates
            await this.activitySubmissionsRepository.updateStatusAndReview(
                submissionId,
                { status: body.decision, review: { reviewedByTeacherId: teacherId, reviewedAt: new Date(), decision: body.decision, note: teacherNote } },
                { session }
            );

            await Promise.all([
                ...ledgerPromises,
                this.cohortRepository.setHPForEnrollment(submission.studentId.toString(), submission.courseId.toString(), submission.courseVersionId.toString(), finalHpBalance, session)
            ]);

            return { success: true };
        });
    }


    private _buildLedgerData(sub: HpActivitySubmission, user: IUser, event: HpLedgerEventType, dir: HpLedgerDirection, amt: number, base: number, computed: number, reasonCode: HpReasonCode, note: string, refId: string | null, teacherId: string, config: any, isLate?: boolean) {
        return {
            courseId: new ObjectId(sub.courseId),
            courseVersionId: new ObjectId(sub.courseVersionId),
            cohort: sub.cohort,
            studentId: new ObjectId(sub.studentId.toString()),
            studentEmail: user.email,
            activityId: new ObjectId(sub.activityId),
            submissionId: new ObjectId(sub._id),
            eventType: event,
            direction: dir,
            amount: Math.abs(amt),
            calc: {
                ruleType: config?.reward?.type ?? "ABSOLUTE",
                baseHpAtTime: base,
                computedAmount: computed,
                withinDeadline: reasonCode == "SUBMISSION_REWARD" ? isLate : null,
                reasonCode,
                deadlineAt: config?.deadlineAt ? new Date(config.deadlineAt) : null,
            },
            links: refId ? { reversedLedgerId: new ObjectId(refId), relatedLedgerIds: [] } : null,
            meta: { triggeredBy: "TEACHER" as TriggeredBy, triggeredByUserId: new ObjectId(teacherId), note }
        };
    }
}





// async review(submissionId: string, teacherId: string, body: ReviewHpActivitySubmissionBodyDto) {
//     return this._withTransaction(async (session) => {
//         // 1. Initial Data Fetching
//         const submission = await this.activitySubmissionsRepository.findById(submissionId, { session });
//         if (!submission) throw new NotFoundError("Submission not found");

//         const [activityRuleConfig, user, enrollment] = await Promise.all([
//             this.ruleConfigService.getByActivityId(submission.activityId.toString()),
//             this.userRepo.findById(submission.studentId.toString()),
//             this.cohortRepository.findEnrollment(submission.studentId.toString(), submission.courseId.toString(), submission.courseVersionId.toString())
//         ]);

//         if (!user) throw new BadRequestError("Student not found");
//         if (!enrollment) throw new BadRequestError("Enrollment not found");

//         // 2. Validation Logic
//         const rewardConfig = activityRuleConfig?.reward;
//         const isApprovalRequired = rewardConfig?.enabled && rewardConfig.applyWhen === "ON_APPROVAL";
//         const currentStatus = submission.status;

//         if (["REVERTED", "REJECTED"].includes(currentStatus)) {
//             throw new BadRequestError("This submission has already been processed.");
//         }

//         if (isApprovalRequired && body.decision !== "APPROVED" && currentStatus == "SUBMITTED") {
//             throw new BadRequestError("This activity requires approval. Only APPROVE is allowed.");
//         }

//         if ((currentStatus === "APPROVED" || (currentStatus === "SUBMITTED" && !isApprovalRequired)) && body.decision == "APPROVED") {
//             throw new BadRequestError("This submission is already rewarded. Only REVERT is allowed.");
//         }

//         // 3. Deadline Checks for Approval
//         if (body.decision === "APPROVED") {
//             const deadline = activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null;
//             const isLate = deadline && new Date() > deadline;

//             if (isLate && rewardConfig?.lateBehavior === "NO_REWARD") {
//                 throw new BadRequestError("Cannot approve: Late submissions receive no reward.");
//             }
//             if (isLate && rewardConfig?.onlyWithinDeadline) {
//                 throw new BadRequestError("Cannot approve: Submission is past the deadline.");
//             }
//         }

//         // 4. Decision Parameters (Amount & Type)
//         let deltaAmount = 0;
//         let revertedLedgerId = null;
//         const isReverting = body.decision === "REVERTED";

//         const isRejecting = body.decision == "REJECTED";
//         const pointsToDeduct = Number(body.pointsToDeduct) ?? 0;

//         if (body.decision === "APPROVED") {
//             deltaAmount = rewardConfig?.value ?? 0;
//         } else if (isReverting || isRejecting) {
//             const ledgerToRevert = await this.ledgerRepository.findByStudentAndSubmissionId(submissionId, submission.studentId.toString());
//             if (!ledgerToRevert) throw new BadRequestError("No existing reward found to revert.");

//             revertedLedgerId = ledgerToRevert._id.toString();
//             deltaAmount = -(ledgerToRevert.amount ?? 0); // Negative to decrease HP
//         }

//         if (isRejecting) {


//             const totalStudentHpPoints = enrollment.hpPoints ?? 0;
//             const ruleType = rewardConfig?.type ?? "ABSOLUTE";

//             const rejectLedgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
//                 courseId: new ObjectId(submission.courseId),
//                 courseVersionId: new ObjectId(submission.courseVersionId),
//                 cohort: submission.cohort,
//                 studentId: new ObjectId(submission.studentId.toString()),
//                 studentEmail: user.email,
//                 activityId: new ObjectId(submission.activityId),
//                 submissionId: new ObjectId(submissionId),
//                 eventType: "REJECTION",
//                 direction: "DEBIT",
//                 amount: Math.abs(pointsToDeduct),
//                 calc: {
//                     ruleType,
//                     percentage: ruleType === "PERCENTAGE" ? (rewardConfig?.value ?? 0) : null,
//                     absolutePoints: ruleType === "ABSOLUTE" ? (rewardConfig?.value ?? 0) : null,
//                     baseHpAtTime: totalStudentHpPoints - deltaAmount,
//                     computedAmount: (totalStudentHpPoints + deltaAmount) - pointsToDeduct,
//                     deadlineAt: activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null,
//                     withinDeadline: null,
//                     reasonCode: "REJECTION_PENALTY"
//                 },
//                 links: revertedLedgerId ? { reversedLedgerId: new ObjectId(revertedLedgerId), relatedLedgerIds: [] } : null,
//                 meta: {
//                     triggeredBy: "TEACHER",
//                     triggeredByUserId: new ObjectId(teacherId),
//                     note: body.note
//                 }
//             };

//             await Promise.all([
//                 this.ledgerRepository.create(rejectLedgerEntry, session),
//                 this.cohortRepository.setHPForEnrollment(
//                     submission.studentId.toString(),
//                     submission.courseId.toString(),
//                     submission.courseVersionId.toString(),
//                     (totalStudentHpPoints + deltaAmount) - pointsToDeduct,
//                     session
//                 )
//             ]);
//         }


//         const review = {
//             reviewedByTeacherId: teacherId,
//             reviewedAt: new Date(),
//             decision: body.decision,
//             note: body.note ?? (isReverting ? "Reward Reverted" : "Approved by Instructor")
//         };

//         await this.activitySubmissionsRepository.updateStatusAndReview(
//             submissionId,
//             { status: body.decision, review },
//             { session }
//         );

//         // 6. Ledger Entry Construction
//         const totalStudentHpPoints = enrollment.hpPoints ?? 0;
//         const ruleType = rewardConfig?.type ?? "ABSOLUTE";

//         const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
//             courseId: new ObjectId(submission.courseId),
//             courseVersionId: new ObjectId(submission.courseVersionId),
//             cohort: submission.cohort,
//             studentId: new ObjectId(submission.studentId.toString()),
//             studentEmail: user.email,
//             activityId: new ObjectId(submission.activityId),
//             submissionId: new ObjectId(submissionId),
//             eventType: isReverting ? "REVERSAL" : "CREDIT",
//             direction: isReverting ? "DEBIT" : "CREDIT",
//             amount: Math.abs(deltaAmount),
//             calc: {
//                 ruleType,
//                 percentage: ruleType === "PERCENTAGE" ? (rewardConfig?.value ?? 0) : null,
//                 absolutePoints: ruleType === "ABSOLUTE" ? (rewardConfig?.value ?? 0) : null,
//                 baseHpAtTime: totalStudentHpPoints,
//                 computedAmount: totalStudentHpPoints + deltaAmount,
//                 deadlineAt: activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null,
//                 withinDeadline: null,
//                 reasonCode: isReverting ? "REWARD_REVERSAL" : "REWARD_REVERSAL"
//             },
//             links: revertedLedgerId ? { reversedLedgerId: new ObjectId(revertedLedgerId), relatedLedgerIds: [] } : null,
//             meta: {
//                 triggeredBy: "TEACHER",
//                 triggeredByUserId: new ObjectId(teacherId),
//                 note: review.note
//             }
//         };

//         // 7. Atomic Updates
//         await Promise.all([
//             this.ledgerRepository.create(ledgerEntry, session),
//             this.cohortRepository.setHPForEnrollment(
//                 submission.studentId.toString(),
//                 submission.courseId.toString(),
//                 submission.courseVersionId.toString(),
//                 totalStudentHpPoints + deltaAmount,
//                 session
//             )
//         ]);

//         return { success: true };
//     });
// }
