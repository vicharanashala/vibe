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

            // Determine if submission is late based on activity rule config deadline
            const deadline = activityRuleConfig?.deadlineAt
                ? new Date(activityRuleConfig.deadlineAt)
                : null;

            const now = new Date();

            const isLate = deadline ? now.getTime() > deadline.getTime() : false;

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

            // const ruleType = activityRuleConfig.ty

            // const ledgerEntry: Partial<HpLedger> = {
            //     courseId: body.courseId,
            //     courseVersionId: body.courseVersionId,
            //     cohort: body.cohort,
            //     activityId: body.activityId,
            //     studentId: student.id,
            //     studentEmail: student.email,
            //     submissionSource: body.submissionSource ?? "IN_PLATFORM",
            //     submissionId: "",
            //     eventType: "CREDIT",
            //     direction: "CREDIT",
            //     amount: activity.points ?? 0,

            //     calc: {

            //     }
            // }


            // const isLedgerCreated = await this.ledgerRepository.create()

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