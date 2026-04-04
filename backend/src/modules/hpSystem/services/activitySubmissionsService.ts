import { BaseService, IUser, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityRepository, ActivitySubmissionsRepository, LedgerRepository } from "../repositories/index.js";
import { CreateOrUpdateHpActivitySubmissionBodyDto, FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsResponseDto, StudentActivitySubmissionStatsResponseDto, StudentActivitySubmissionStatsViewDto, StudentActivitySubmissionsViewDto, StudentCohortWiseActivitySubmissionsStatsDto } from "../classes/validators/activitySubmissionValidators.js";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { appConfig } from "#root/config/app.js";
import { Bucket, Storage } from '@google-cloud/storage';
import path from "path";
import { randomBytes } from "crypto";
import { ActivityService } from "./activityService.js";
import { RuleConfigService } from "./ruleConfigsService.js";
import { HpActivitySubmission, HpLedger, HpLedgerDirection, HpLedgerEventType, HpReasonCode, ReviewDecision, SubmissionField, TriggeredBy } from "../models.js";
import { ClientSession, ObjectId } from "mongodb";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { SubmissionFeedbackItem } from "../classes/transformers/ActivitySubmission.js";
import { COHORT_OVERRIDES, ID } from "../constants.js";
import { getHpLedgerOperationId } from "../utils/getHpLedgerOperationId .js";
import { ISettingRepository } from "#root/shared/database/interfaces/ISettingRepository.js";
import { ICourseRepository } from "#root/shared/database/interfaces/ICourseRepository.js";


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
        @inject(GLOBAL_TYPES.SettingRepo) private readonly settingRepository: ISettingRepository,
        @inject(GLOBAL_TYPES.CourseRepo) private readonly courseRepo: ICourseRepository,

    ) {
        super(mongoDatabase);
    }

    private getActivitySubmissionBucket() {
        const storage = new Storage({
            keyFilename: appConfig.GOOGLE_APPLICATION_CREDENTIALS,
        });

        return storage.bucket(appConfig.GCP_BACKUP_ACTIVITY_BUCKET);
    }

    private async uploadSubmissionFileToGcp(
        bucket: Bucket,
        studentId: string,
        file: Express.Multer.File,
        folder: string
    ) {
        const ext = path.extname(file.originalname) || "";
        const baseName = path.basename(file.originalname, ext);
        const safeBase = baseName.replace(/[^\w\-]+/g, "_");
        const unique = randomBytes(8).toString("hex");
        const timestamp = Date.now();

        const fileName = `${studentId}_${safeBase}_${timestamp}_${unique}${ext}`;
        const objectPath = `${folder}/${fileName}`;
        const gcpFile = bucket.file(objectPath);

        await gcpFile.save(file.buffer, {
            resumable: false,
            contentType: file.mimetype,
            metadata: {
                contentDisposition: `inline; filename="${file.originalname}"`,
            },
        });

        const [signedUrl] = await gcpFile.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        });

        return {
            fileId: objectPath,
            url: signedUrl,
            name: fileName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
        };
    }

    private async uploadSubmissionAssets(
        studentId: string,
        cohort: string,
        activityId: string,
        files: Express.Multer.File[],
        images: Express.Multer.File[]
    ) {

        const bucket = this.getActivitySubmissionBucket();
        // Determine environment prefix
        const isProduction = appConfig.isProduction;
        const envPrefix = isProduction ? "" : `[${appConfig.sentry.environment}]`;

        const basePath = `${envPrefix} hp-activity-submissions/${cohort}/${activityId}/${studentId}`;

        const [uploadedPdfs, uploadedImages] = await Promise.all([
            Promise.all(
                files.map((file) =>
                    this.uploadSubmissionFileToGcp(
                        bucket,
                        studentId,
                        file,
                        `${basePath}/files`
                    )
                )
            ),
            Promise.all(
                images.map((image) =>
                    this.uploadSubmissionFileToGcp(
                        bucket,
                        studentId,
                        image,
                        `${basePath}/images`
                    )
                )
            ),
        ]);

        return { uploadedPdfs, uploadedImages };
    }

    // private getActivitySubmissionBucket() {
    //     const storage = new Storage({
    //         keyFilename: appConfig.GOOGLE_APPLICATION_CREDENTIALS,
    //     });

    //     return storage.bucket(appConfig.GCP_BACKUP_ACTIVITY_BUCKET);
    // }

    // private async uploadSubmissionFileToGcp(
    //     bucket: Bucket,
    //     studentId: string,
    //     file: Express.Multer.File,
    //     folder: string
    // ) {
    //     const ext = path.extname(file.originalname) || "";
    //     const baseName = path.basename(file.originalname, ext);
    //     const safeBase = baseName.replace(/[^\w\-]+/g, "_");
    //     const unique = randomBytes(8).toString("hex");
    //     const timestamp = Date.now();

    //     const fileName = `${studentId}_${safeBase}_${timestamp}_${unique}${ext}`;
    //     const objectPath = `${folder}/${fileName}`;
    //     const gcpFile = bucket.file(objectPath);

    //     await gcpFile.save(file.buffer, {
    //         resumable: false,
    //         contentType: file.mimetype,
    //         metadata: {
    //             contentDisposition: `inline; filename="${file.originalname}"`,
    //         },
    //     });

    //     const [signedUrl] = await gcpFile.getSignedUrl({
    //         action: "read",
    //         expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    //     });

    //     return {
    //         fileId: objectPath,
    //         url: signedUrl,
    //         name: fileName,
    //         mimeType: file.mimetype,
    //         sizeBytes: file.size,
    //     };
    // }

    // private async uploadSubmissionAssets(
    //     studentId: string,
    //     cohort: string,
    //     activityId: string,
    //     files: Express.Multer.File[],
    //     images: Express.Multer.File[]
    // ) {
    //     const bucket = this.getActivitySubmissionBucket();

    //     const [uploadedPdfs, uploadedImages] = await Promise.all([
    //         Promise.all(
    //             files.map((file) =>
    //                 this.uploadSubmissionFileToGcp(
    //                     bucket,
    //                     studentId,
    //                     file,
    //                     `hp-activity-submissions/${cohort}/${activityId}/${studentId}/files`
    //                 )
    //             )
    //         ),
    //         Promise.all(
    //             images.map((image) =>
    //                 this.uploadSubmissionFileToGcp(
    //                     bucket,
    //                     studentId,
    //                     image,
    //                     `hp-activity-submissions/${cohort}/${activityId}/${studentId}/images`
    //                 )
    //             )
    //         ),
    //     ]);

    //     return { uploadedPdfs, uploadedImages };
    // }


    async submit(student: { id: string; email: string; name: string }, body: CreateOrUpdateHpActivitySubmissionBodyDto, upload?: { files?: Express.Multer.File[]; images?: Express.Multer.File[] }
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
            if (activity.status !== "PUBLISHED")
                throw new BadRequestError("You can't submit this activity, it is not set to public")
            if (activity.activityType !== "ASSIGNMENT")
                throw new BadRequestError("You can't submit this activity")

            const activityRuleConfig = await this.ruleConfigService.getByActivityId(activityId);
            if (!activityRuleConfig) {
                throw new BadRequestError("Activity rule config not found");
            }

            const ledger = await this.ledgerRepository.findByStudentAndActivityId(activityId, student.id);
            if (ledger && ledger.direction == "CREDIT") {
                throw new BadRequestError(
                    activityRuleConfig.reward.applyWhen === "ON_APPROVAL"
                        ? "This activity has already been submitted. Please wait for the instructor to review it and credit the HP points."
                        : "This activity has already been submitted and the HP points for this activity have already been credited."
                );
            }

            const latestSubmissions = await this.activitySubmissionsRepository.getLatestByStudentId(student.id, activityId)
            if (latestSubmissions && latestSubmissions.status !== "REVERTED")
                throw new BadRequestError("You have already attended this activity.")

            const cohort = body.cohort;

            // 2. Apply Overrides (Fall back to body values if cohort isn't in the map)
            const finalCourseId = COHORT_OVERRIDES[cohort]?.courseId ?? body.courseId;
            const finalVersionId = COHORT_OVERRIDES[cohort]?.versionId ?? body.courseVersionId;


            // 3. Fetch Enrollment using the CORRECT (overridden) IDs
            const enrollment = await this.cohortRepository.findEnrollment(
                student.id,
                finalCourseId,
                finalVersionId,
                cohort,
                session
            );

            if (!enrollment) {
                console.error(`Enrollment check failed for Student: ${student.id} in Course: ${finalCourseId}`);
                throw new BadRequestError(`Student is not enrolled in the required course context for cohort: ${cohort}`);
            }

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


            let uploadedPdfs: any[] = [];
            let uploadedImages: any[] = [];


            // To create proper unique folder names based on cohort (exisiting cohort=>cohortName, new cohorts=>id)
            let cohortFileName = body.cohort
            const isOverride = COHORT_OVERRIDES[body.cohort]
            if (!isOverride) {
                const cohortId = await this.cohortRepository.getCohortIdByCohortName(body.cohort);
                if (cohortId)
                    cohortFileName = cohortId;
            }

            // Only call upload when there are files/images
            if (files.length > 0 || images.length > 0) {
                const uploadResult = await this.uploadSubmissionAssets(
                    student.id,
                    cohortFileName,
                    body.activityId,
                    files,
                    images
                );

                uploadedPdfs = uploadResult.uploadedPdfs ?? [];
                uploadedImages = uploadResult.uploadedImages ?? [];
            }

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

            const validation = activityRuleConfig.submissionValidation ?? [SubmissionField.TEXT];

            if (validation.includes(SubmissionField.TEXT) && !payload.textResponse?.trim()) {
                throw new BadRequestError("Text response is required");
            }

            if (validation.includes(SubmissionField.PDF) && (!payload.files || payload.files.length === 0)) {
                throw new BadRequestError("At least one PDF file is required");
            }

            if (validation.includes(SubmissionField.IMAGE) && (!payload.images || payload.images.length === 0)) {
                throw new BadRequestError("At least one image is required");
            }

            if (validation.includes(SubmissionField.URL) && (!payload.links || payload.links.length === 0)) {
                throw new BadRequestError("At least one URL is required");
            }

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

                const shouldSkipReward =
                    isLate && activityReward.lateBehavior === "NO_REWARD";

                if (shouldSkipReward) {
                    return;
                }


                const totalStudentHpPoints = enrollment?.hpPoints ?? 0;
                const ruleType = activityReward.type;
                const rewardValue = activityReward.value ?? 0;

                let incrementAmount = 0;

                // 1. Calculate the Reward
                if (ruleType === "ABSOLUTE") {
                    incrementAmount = rewardValue;
                } else if (ruleType === "PERCENTAGE") {
                    const rewardMaxLimit = activityRuleConfig.limits?.maxHp;
                    const rewardMinLimit = activityRuleConfig.limits?.minHp;

                    // Fetch course base HP from settings for percentage calculation baseline
                    const courseSettings = await this.settingRepository.readCourseSettings(finalCourseId, finalVersionId, session);
                    const courseBaseHp = courseSettings?.settings?.baseHp ?? 100;

                    // Calculate percentage reward using current HP, or base HP if current is 0
                    const calculationBase = totalStudentHpPoints > 0 ? totalStudentHpPoints : courseBaseHp;
                    const calculatedReward = Math.round((calculationBase * rewardValue) / 100);

                    let finalReward = calculatedReward;

                    if (rewardMinLimit && finalReward < rewardMinLimit) {
                        finalReward = rewardMinLimit;
                    }

                    if (rewardMaxLimit && finalReward > rewardMaxLimit) {
                        finalReward = rewardMaxLimit;
                    }

                    incrementAmount = Math.max(0, finalReward);
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
                        finalCourseId,
                        finalVersionId,
                        cohort,
                        totalStudentHpPoints + incrementAmount,
                        session
                    )
                ]);
            }

            return { success: true, submissionId };

        });
    }



    async updateSubmission(
        submissionId: string,
        student: { id: string; email: string; name: string },
        body: CreateOrUpdateHpActivitySubmissionBodyDto,
        upload?: { files?: Express.Multer.File[]; images?: Express.Multer.File[] }
    ) {
        return this._withTransaction(async (session) => {
            if (!body.courseId || !body.courseVersionId || !body.activityId || !body.cohort) {
                throw new BadRequestError("Missing required fields");
            }

            const submission = await this.activitySubmissionsRepository.findById(submissionId, { session });
            if (!submission) {
                throw new NotFoundError(`Submission ${submissionId} not found.`);
            }

            const ledger = await this.ledgerRepository.findByStudentAndSubmissionId(submissionId, student.id);
            if (ledger) {
                throw new BadRequestError(
                    "This submission cannot be updated because it has already been reviewed or approved by the instructor."
                );
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

            let uploadedPdfs: any[] = [];
            let uploadedImages: any[] = [];

            // Only call upload when there are files/images
            if (files.length > 0 || images.length > 0) {
                const uploadResult = await this.uploadSubmissionAssets(
                    student.id,
                    body.cohort,
                    body.activityId,
                    files,
                    images
                );

                uploadedPdfs = uploadResult.uploadedPdfs ?? [];
                uploadedImages = uploadResult.uploadedImages ?? [];
            }

            const payload = {
                ...basePayload,
                files: [
                    ...(body.payload?.files ?? []),
                    ...uploadedPdfs.map((x) => ({
                        fileId: x.fileId,
                        url: x.url,
                        name: x.name,
                        mimeType: x.mimeType,
                        sizeBytes: x.sizeBytes,
                    })),
                ],
                images: [
                    ...(body.payload?.images ?? []),
                    ...uploadedImages.map((x) => ({
                        fileId: x.fileId,
                        url: x.url,
                        name: x.name,
                    })),
                ],
            };

            const activityRuleConfig = await this.ruleConfigService.getByActivityId(body.activityId);
            if (!activityRuleConfig) {
                throw new BadRequestError("Activity rule config not found");
            }

            const validation: SubmissionField[] = activityRuleConfig.submissionValidation ?? [SubmissionField.TEXT];

            if (validation.includes(SubmissionField.TEXT) && !payload.textResponse?.trim()) {
                throw new BadRequestError("Text response is required");
            }

            if (validation.includes(SubmissionField.PDF) && (!payload.files || payload.files.length === 0)) {
                throw new BadRequestError("At least one PDF file is required");
            }

            if (validation.includes(SubmissionField.IMAGE) && (!payload.images || payload.images.length === 0)) {
                throw new BadRequestError("At least one image is required");
            }

            if (validation.includes(SubmissionField.URL) && (!payload.links || payload.links.length === 0)) {
                throw new BadRequestError("At least one URL is required");
            }

            await this.activitySubmissionsRepository.updateById(
                submissionId,
                {
                    payload,
                },
                { session }
            );

            const updatedSubmission = await this.activitySubmissionsRepository.findById(submissionId, { session });
            if (!updatedSubmission) {
                throw new Error("Failed to update submission");
            }

            return updatedSubmission;
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

        const effectiveQuery: ListSubmissionsQueryDto = { ...query };

        if (query.cohort && COHORT_OVERRIDES[query.cohort])
            effectiveQuery.courseVersionId = COHORT_OVERRIDES[query.cohort].versionId;


        const docs = await this.activitySubmissionsRepository.list(effectiveQuery);

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

        // Get ledger data for all submissions
        const submissionIds = submissions.map(sub => sub.submission?._id).filter(Boolean);
        const ledgerEntries = submissionIds.length > 0
            ? await this.ledgerRepository.findBySubmissionIds(submissionIds)
            : [];

        // Create a map of submissionId to ledger entries for quick lookup
        const ledgerMap = new Map();
        ledgerEntries.forEach(entry => {
            const submissionId = entry.submissionId?.toString();
            if (submissionId) {
                if (!ledgerMap.has(submissionId)) {
                    ledgerMap.set(submissionId, []);
                }
                ledgerMap.get(submissionId).push(entry);
            }
        });

        // Attach ledger data to each submission
        const submissionsWithLedger = submissions.map(submission => {
            const submissionId = submission.submission?._id;
            const relatedLedgerEntries = ledgerMap.get(submissionId) || [];

            return {
                ...submission,
                ledgerEntries: relatedLedgerEntries
            };
        });

        return {
            success: true,
            data: submissionsWithLedger,
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


        // if (override) {
        //     courseId = override.courseId;
        //     courseVersionId = override.versionId;
        // } else {
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
                    bestPerformingCohort: cohortName,
                    coursePerformance: [],
                    weeklyActivity: [],
                },
            };
        }

        const courseId = latestActivity.courseId.toString();
        const courseVersionId = latestActivity.courseVersionId.toString();
        // }

        const [
            totalActivities,
            totalSubmissions,
            totalLateSubmissions,
            totalPendingActivites,
            enrollment,
        ] = await Promise.all([
            this.activityRepository.getCountByCohortName(cohortName),
            this.activitySubmissionsRepository.getCountByStudentId(studentId, courseId, courseVersionId, cohortName),
            this.activitySubmissionsRepository.getLateSubmissionCountByStudentId(studentId, courseId, courseVersionId, cohortName),
            this.activityRepository.getPendingActivitesCount(studentId, courseId, courseVersionId, cohortName),
            this.cohortRepository.findEnrollment(studentId, courseId, courseVersionId, cohortName),
            // this.activityRepository.getLatestActivityByCohortName(cohortName),
        ]);

        const data: StudentActivitySubmissionStatsViewDto = {
            totalActivities,
            totalSubmissions,
            totalLateSubmissions,
            totalPendings: totalPendingActivites,
            currentHp: enrollment?.hpPoints ?? 0,
            bestPerformingCohort: cohortName,
            coursePerformance: [],
            weeklyActivity: [],
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
            // Custom validation for required notes - only for REJECT and REVERTED
            if (body.decision === "REJECTED" && (!body.note || body.note.trim().length < 10)) {
                throw new BadRequestError("Note must be at least 10 characters long for reject action");
            }
            if (body.decision === "REVERTED" && (!body.note || body.note.trim().length < 10)) {
                throw new BadRequestError("Note must be at least 10 characters long for revert action");
            }

            // Points deduction validation for reject action
            if (body.decision === "REJECTED" && body.pointsToDeduct !== undefined && body.pointsToDeduct < 0) {
                throw new BadRequestError("Points to deduct cannot be negative");
            }

            // 1. Initial Data Fetching
            const submission = await this.activitySubmissionsRepository.findById(submissionId, { session });
            if (!submission) throw new NotFoundError(`Submission ${submissionId} not found.`);

            const cohort = submission.cohort;
            let courseId = submission.courseId.toString()
            let courseVersionId = submission.courseVersionId.toString()

            const override = COHORT_OVERRIDES[cohort];
            if (override) {
                courseId = override.courseId;
                courseVersionId = override.versionId;
            }

            const [activityRuleConfig, user, enrollment, courseSettings] = await Promise.all([
                this.ruleConfigService.getByActivityId(submission.activityId.toString()),
                this.userRepo.findById(submission.studentId.toString()),
                this.cohortRepository.findEnrollment(submission.studentId.toString(), courseId, courseVersionId, submission.cohort, session),
                this.settingRepository.readCourseSettings(courseId, courseVersionId, session)
            ]);

            if (!user || !enrollment) throw new BadRequestError(!user ? "Student account missing." : "Enrollment data missing.");

            const baseHpValue = courseSettings?.settings?.baseHp ?? 100;

            // 2. Flags & Config
            const rewardConfig = activityRuleConfig?.reward;
            const currentStatus = submission.status;
            const totalStudentHpPoints = enrollment.hpPoints ?? 0;
            const ruleType = rewardConfig?.type ?? "ABSOLUTE";
            const isApprovalRequired = rewardConfig?.enabled && rewardConfig.applyWhen === "ON_APPROVAL";
            const baseHp = rewardConfig?.value ?? 0;

            const isApprove = body.decision === "APPROVED";
            const isRevert = body.decision === "REVERTED";
            const isReject = body.decision === "REJECTED";

            const deadline = activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null;
            const isLate = deadline && new Date() > deadline;

            // 3. Validation
            if (["REVERTED", "REJECTED"].includes(currentStatus)) throw new BadRequestError(`Submission is already ${currentStatus}.`);

            if (isApprovalRequired && isRevert && currentStatus == "SUBMITTED") {
                throw new BadRequestError("This activity requires approval. Only APPROVE/REJECT is allowed.");
            }

            if (isApprove && currentStatus === "APPROVED") {
                throw new BadRequestError("Conflict: This submission is already approved.");
            }

            if (isReject && body.pointsToDeduct !== undefined && body.pointsToDeduct > baseHp) {
                throw new BadRequestError(`Points to deduct cannot exceed base HP of ${baseHp}`);
            }


            // 3. Deadline Checks for Approval
            if (isApprove) {
                // 1. Identify if the submission is late
                const deadline = activityRuleConfig?.deadlineAt ? new Date(activityRuleConfig.deadlineAt) : null;
                const isLate = deadline && new Date() > deadline;

                // 2. Define the "Hard Block" conditions
                const isLatePolicyViolated = isLate && rewardConfig?.lateBehavior === "NO_REWARD";

                // 3. Throw Detailed Errors
                if (isLatePolicyViolated) {
                    throw new BadRequestError(`Approval Denied: This submission is late, and the activity policy is set to 'No Reward' for late work.`);
                }
            }

            // 4. Calculate Changes
            const ledgerPromises: Promise<any>[] = [];
            let finalHpBalance = totalStudentHpPoints;
            const teacherNote = body.note ?? "";

            // CASE A: APPROVE
            if (isApprove) {
                const rewardValue = rewardConfig?.value ?? 0;
                let rewardDetailsNote = "";
                let incrementAmount = 0;

                // Prevention of double-rewarding for ON_SUBMISSION activities
                if (rewardConfig?.applyWhen === "ON_SUBMISSION") {
                    incrementAmount = 0;
                    rewardDetailsNote = "Reward already applied on submission.";
                } else {
                    if (ruleType === "ABSOLUTE") {
                        incrementAmount = rewardValue;
                        rewardDetailsNote = `Reward Type: ABSOLUTE, Reward HP: ${rewardValue}`;

                    } else if (ruleType === "PERCENTAGE") {
                        const rewardMaxLimit = activityRuleConfig.limits?.maxHp;
                        const rewardMinLimit = activityRuleConfig.limits?.minHp;

                        // Calculate percentage reward using current HP, or base HP if current is 0
                        const calculationBase = totalStudentHpPoints > 0 ? totalStudentHpPoints : baseHpValue;
                        const calculatedReward = Math.round((calculationBase * rewardValue) / 100);

                        let finalReward = calculatedReward;

                        if (rewardMinLimit && finalReward < rewardMinLimit) {
                            finalReward = rewardMinLimit;
                        }

                        if (rewardMaxLimit && finalReward > rewardMaxLimit) {
                            finalReward = rewardMaxLimit;
                        }

                        incrementAmount = Math.max(0, finalReward);
                        rewardDetailsNote = `Reward Type: PERCENTAGE, Base HP: ${calculationBase}${totalStudentHpPoints === 0 ? " (from course settings)" : ""}, Percentage: ${rewardValue}%`;
                    }
                }

                const finalTeacherNote = teacherNote
                    ? `${teacherNote} | ${rewardDetailsNote}`
                    : rewardDetailsNote;

                finalHpBalance += incrementAmount;

                ledgerPromises.push(this.ledgerRepository.create(
                    this._buildLedgerData(submission, user, "CREDIT", "CREDIT", incrementAmount, totalStudentHpPoints, finalHpBalance, "SUBMISSION_REWARD", finalTeacherNote || "Activity approved.", null, teacherId, activityRuleConfig, isLate),
                    session
                ));
            }

            // CASE B: REVERT OR REJECT (Common Step: Undo Original Reward)
            if (isRevert || isReject) {
                const originalLedger = await this.ledgerRepository.findByStudentAndSubmissionId(submissionId, submission.studentId.toString());
                if (isRevert && !originalLedger) {
                    throw new BadRequestError("Original reward ledger not found to reverse.");
                }
                // If ledger is there to revert then only revert
                let rewardToUndo = 0;
                if (originalLedger && originalLedger.direction == "CREDIT") {
                    rewardToUndo = originalLedger.amount ?? 0;
                    const hpBeforeReversal = finalHpBalance;
                    // finalHpBalance -= rewardToUndo;
                    finalHpBalance = Math.max(0, finalHpBalance - rewardToUndo);


                    // First Ledger: The Reversal
                    ledgerPromises.push(this.ledgerRepository.create(
                        this._buildLedgerData(submission, user, "REVERSAL", "DEBIT", rewardToUndo, hpBeforeReversal, finalHpBalance, isRevert ? "REWARD_REVERSAL" : "REJECTION_PENALTY", `Reversed original reward of ${rewardToUndo} HP.`, originalLedger._id.toString(), teacherId, activityRuleConfig),
                        session
                    ));
                }
                // CASE C: ADDITIONAL REJECTION PENALTY
                if (isReject) {
                    const penaltyAmount = Number(body.pointsToDeduct) ?? 0;
                    if (penaltyAmount > 0) {
                        const hpBeforePenalty = finalHpBalance;
                        // finalHpBalance -= penaltyAmount;
                        finalHpBalance = Math.max(0, finalHpBalance - penaltyAmount);

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
                this.cohortRepository.setHPForEnrollment(submission.studentId.toString(), courseId, courseVersionId, submission.cohort, finalHpBalance, session)
            ]);

            return { success: true };
        });
    }

    async restore(submissionId: string, teacherId: string, note?: string) {
    return this._withTransaction(async (session) => {
        // 1. Fetch submission
        const submission = await this.activitySubmissionsRepository.findById(submissionId, { session });
        if (!submission) throw new NotFoundError(`Submission ${submissionId} not found.`);

        // 2. Validate — only REVERTED or REJECTED submissions can be restored
        if (submission.status !== "REVERTED" && submission.status !== "REJECTED") {
            throw new BadRequestError("Only reverted or rejected submissions can be restored.");
        }

        const cohort = submission.cohort;
        let courseId = submission.courseId.toString();
        let courseVersionId = submission.courseVersionId.toString();

        // 3. Handle both existing and new cohorts
        const override = COHORT_OVERRIDES[cohort];
        if (override) {
            courseId = override.courseId;
            courseVersionId = override.versionId;
        }

        // 4. Find the DEBIT ledger entry
        const debitLedger = await this.ledgerRepository.findDebitBySubmissionId(submissionId);
        if (!debitLedger) {
            throw new BadRequestError("No debit ledger entry found for this submission. Cannot restore.");
        }

        // 5. Validate — only allow if ledger is DEBIT
        if (debitLedger.direction !== "DEBIT") {
            throw new BadRequestError("Restore is only allowed for debit ledger entries.");
        }

        // 6. Fetch user and enrollment
        const [user, enrollment] = await Promise.all([
            this.userRepo.findById(submission.studentId.toString()),
            this.cohortRepository.findEnrollment(
                submission.studentId.toString(),
                courseId,
                courseVersionId,
                cohort,
                session
            )
        ]);

        if (!user || !enrollment) {
            throw new BadRequestError(!user ? "Student account missing." : "Enrollment data missing.");
        }

        // 7. Calculate new HP balance
        const totalStudentHpPoints = enrollment.hpPoints ?? 0;
        const restoreAmount = debitLedger.amount ?? 0;
        const finalHpBalance = totalStudentHpPoints + restoreAmount;

        const activityRuleConfig = await this.ruleConfigService.getByActivityId(
            submission.activityId.toString()
        );

        const ledgerNote = note
            ? `Restored ${restoreAmount} HP. Instructor note: ${note}`
            : `Restored ${restoreAmount} HP. Original debit reversed by instructor.`;
        const operationId = getHpLedgerOperationId("restore");

        // 8. Create CREDIT ledger entry
        await this.ledgerRepository.create(
            this._buildLedgerData(
                submission,
                user,
                "RESTORE",
                "CREDIT",
                restoreAmount,
                totalStudentHpPoints,
                finalHpBalance,
                "MANUAL",
                ledgerNote,
                debitLedger._id.toString(),
                teacherId,
                activityRuleConfig,
                undefined,
                operationId
            ),
            session
        );

        // 9. Update HP in enrollment
        await this.cohortRepository.setHPForEnrollment(
            submission.studentId.toString(),
            courseId,
            courseVersionId,
            cohort,
            finalHpBalance,
            session
        );

        // 10. Update submission status back to APPROVED
        await this.activitySubmissionsRepository.updateStatusAndReview(
            submissionId,
            {
                status: "APPROVED",
                review: {
                    reviewedByTeacherId: teacherId,
                    reviewedAt: new Date(),
                    decision: "APPROVED",
                    note: note || "Restored by instructor"
                }
            },
            { session }
        );

        return { success: true };
    });
}

    private _buildLedgerData(sub: HpActivitySubmission, user: IUser, event: HpLedgerEventType, dir: HpLedgerDirection, amt: number, base: number, computed: number, reasonCode: HpReasonCode, note: string, refId: string | null, teacherId: string, config: any, isLate?: boolean, operationId?: string) {
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
            meta: { triggeredBy: "TEACHER" as TriggeredBy, triggeredByUserId: new ObjectId(teacherId), note, operationId }
        };
    }


    async addfeedback(id: string, teacherId: string, feedback: string): Promise<{ success: boolean; message: string }> {
        return this._withTransaction(async (session) => {

            if (!id || !ObjectId.isValid(id)) {
                throw new BadRequestError("Valid submission id is required");
            }

            if (!teacherId || !ObjectId.isValid(teacherId)) {
                throw new BadRequestError("Valid teacher id is required");
            }

            if (!feedback || !feedback.trim()) {
                throw new BadRequestError("Feedback is required");
            }

            const feedbackPayload: SubmissionFeedbackItem = {
                feedback: feedback.trim(),
                teacherId: teacherId as ID,
                feedbackAt: new Date(),
            };

            const result = await this.activitySubmissionsRepository.updateFeedbackById(id, feedbackPayload, session);

            return {
                success: result,
                message: result ? "Feedback added successfully" : "Failed to add feedback"
            };
        })
    }

    async getCohortActivityStats(cohortName: string, activityId: string, session?: ClientSession): Promise<StudentCohortWiseActivitySubmissionsStatsDto> {
        return this._withTransaction(async (session) => {
            const data = await this.activitySubmissionsRepository.getCohortActivityStats(cohortName, activityId, session);
            return {
                data
            };
        });
    }

    async getBulkCohortActivityStats(cohortName: string, courseVersionId: string, session?: ClientSession): Promise<StudentActivitySubmissionStatsViewDto> {
        return this._withTransaction(async (session) => {
            
            // Get cohort override info once to avoid repeated lookups
            const cohortOverride = COHORT_OVERRIDES[cohortName];
            const effectiveVersionId = cohortOverride?.versionId || courseVersionId;
            
            // Get cohort ID once if needed for HP calculations
            let cohortId: string | null = null;
            if (!cohortOverride) {
                cohortId = await this.cohortRepository.getCohortIdByCohortName(cohortName);
            }
            
            // Execute all queries in parallel for optimal performance
            const [
                statsMap,
                totalActivitiesCounts,
                weeklyActivity,
                hpDistribution,
                studentProgress,
                lateSubmissionCount,
                pendingSubmissionsCount
            ] = await Promise.all([
                // Get submission statistics
                this.activitySubmissionsRepository.getCohortStatsMap(cohortName, courseVersionId, session),
                
                // Get total activities count only
                this.activityRepository.getCountByCohortName(cohortName, courseVersionId, session),
                
                // Get weekly activity data
                this.getWeeklyActivityData(cohortName, courseVersionId, session),
                
                // Get HP distribution data
                this.ledgerRepository.getHpDistributionForCohort(cohortName, courseVersionId, session),
                
                // Get student progress data
                this.activitySubmissionsRepository.getStudentProgressForCohort(cohortName, courseVersionId, session),
                
                // Get late submission count
                this.activitySubmissionsRepository.getLateSubmissionCount(cohortName, courseVersionId, session),
                
                // Get pending submissions count
                this.activitySubmissionsRepository.getPendingSubmissionsCount(cohortName, courseVersionId, session)
            ]);

            // Build result object
            const result = {
                totalActivities: totalActivitiesCounts || 0,
                totalSubmissions: totalActivitiesCounts || 0,
                totalPendings: pendingSubmissionsCount || 0,
                totalLateSubmissions: lateSubmissionCount || 0,
                currentHp: 0,
                reward: null,
                bestPerformingCohort: cohortName,
                coursePerformance: [],
                weeklyActivity: weeklyActivity || [],
                completionRates: this.formatCompletionRates(statsMap),
                hpDistribution: this.formatHpDistribution(hpDistribution),
                studentProgress: [studentProgress || { completed: 0, inProgress: 0, notStarted: 0 }]
            };
            
            return result;
        });
    }

    // Helper methods for data formatting to keep main method clean
    private formatCompletionRates(statsMap: any): any[] {
        if (!statsMap) return [];
        
        return Object.entries(statsMap).map(([activityId, stats]: [string, any]) => ({
            activityId,
            activityTitle: `Activity ${activityId}`,
            submittedCount: stats.submittedCount || 0,
            pendingCount: stats.submittedCount || 0,
            revertedCount: stats.revertedCount || 0,
            totalAssigned: (stats.submittedCount || 0) + (stats.approvedCount || 0) + (stats.rejectedCount || 0) + (stats.revertedCount || 0)
        }));
    }

    private formatHpDistribution(distribution: any): any[] {
        if (!distribution) return [];
        
        const total = distribution.low + distribution.medium + distribution.high + distribution.veryHigh;
        
        return [
            { range: '0-50 HP', count: distribution.low, percentage: total > 0 ? Math.round((distribution.low / total) * 100) : 0 },
            { range: '51-100 HP', count: distribution.medium, percentage: total > 0 ? Math.round((distribution.medium / total) * 100) : 0 },
            { range: '101-200 HP', count: distribution.high, percentage: total > 0 ? Math.round((distribution.high / total) * 100) : 0 },
            { range: '200+ HP', count: distribution.veryHigh, percentage: total > 0 ? Math.round((distribution.veryHigh / total) * 100) : 0 }
        ];
    }


    private async getWeeklyActivityData(cohortName: string, courseVersionId: string, session: ClientSession): Promise<any[]> {
        // Get real weekly activity data from activity submissions
        try {
            const weeklyData = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const startDate = new Date(date);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(date);
                endDate.setHours(23, 59, 59, 999);
                
                // Get activity counts for this specific day by status
                const [submittedCount, approvedCount, rejectedCount] = await Promise.all([
                    this.activitySubmissionsRepository.getDailyActivityCountByStatus(
                        cohortName, courseVersionId, startDate, endDate, 'SUBMITTED', session
                    ),
                    this.activitySubmissionsRepository.getDailyActivityCountByStatus(
                        cohortName, courseVersionId, startDate, endDate, 'APPROVED', session
                    ),
                    this.activitySubmissionsRepository.getDailyActivityCountByStatus(
                        cohortName, courseVersionId, startDate, endDate, 'REJECTED', session
                    )
                ]);
                
                weeklyData.push({
                    date: date.toISOString().split('T')[0], // YYYY-MM-DD format
                    submitted: submittedCount || 0,
                    approved: approvedCount || 0,
                    rejected: rejectedCount || 0
                });
            }
            
            return weeklyData;
        } catch (error) {
            console.error('Error getting weekly activity data:', error);
            // Fallback to empty array if there's an error
            return [];
        }
    }

    async getStudentDashboardStats(
        studentId: string,
        cohortName: string,
        courseVersionId: string,
        timelineDays: number = 7,
        session?: ClientSession
    ): Promise<{
        myStats: {
            totalHp: number;
            completedActivities: number;
            pendingSubmissions: number;
            completionPercentage: number;
        };
        progressTimeline: Array<{
            date: string;
            hpChange: number;
            activitiesCompleted: number;
        }>;
        activityBreakdown: {
            notStarted: number;
            submitted: number;
            approved: number;
            rejected: number;
        };
        upcomingDeadlines: Array<{
            activityTitle: string;
            deadlineDate: string;
            daysLeft: number;
        }>;
        recentSubmissions: Array<{
            activityTitle: string;
            submittedAt: string;
            status: string;
            hpEarned: number;
        }>;
    }> {
        return this._withTransaction(async (session) => {
            // Only apply cohort overrides for legacy courses
            const legacyCourseIds = ["000000000000000000000001", "000000000000000000000002"];
            const isLegacyCourse = legacyCourseIds.includes(courseVersionId);
            
            // Resolve effective versionId from legacy cohort overrides only for legacy courses
            const cohortOverride = isLegacyCourse ? COHORT_OVERRIDES[cohortName] : null;
            const effectiveVersionId = cohortOverride?.versionId || courseVersionId;

            // 1. Get student dashboard stats from submissions repository
            const dashboardStats = await this.activitySubmissionsRepository.getStudentDashboardStats(
                studentId,
                cohortName,
                effectiveVersionId,
                session
            );

            // 2. Get current HP from enrollment
            const courseVersion = await this.courseRepo.readVersion(effectiveVersionId, session);
            const courseId = courseVersion?.courseId?.toString() ?? "";
            const enrollment = await this.cohortRepository.findEnrollment(
                studentId,
                courseId,
                effectiveVersionId,
                cohortName,
                session
            );
            const totalHp = enrollment?.hpPoints ?? 0; 

            // 3. Get progress timeline from ledger
            const progressTimeline = await this.ledgerRepository.getStudentHpTimeline(
                studentId,
                cohortName,
                effectiveVersionId,
                timelineDays,
                session
            );

            // 4. Get upcoming deadlines (within 7 days)
            const upcomingDeadlines = await this.activityRepository.getUpcomingDeadlinesForStudent(
                studentId,
                cohortName,
                effectiveVersionId,
                7, // days
                5, // limit
                session
            );

            // 5. Get recent submissions (last 5)
            const recentSubmissions = await this.activitySubmissionsRepository.getStudentRecentSubmissions(
                studentId,
                cohortName,
                effectiveVersionId,
                5,
                session
            );

            return {
                myStats: {
                    ...dashboardStats.myStats,
                    totalHp
                },
                progressTimeline,
                activityBreakdown: dashboardStats.activityBreakdown,
                upcomingDeadlines,
                recentSubmissions
            };
        });
    }
}


