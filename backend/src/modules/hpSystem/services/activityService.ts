import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityRepository, RuleConfigsRepository } from "../repositories/index.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "routing-controllers";
import { CreateActivityBody, ListActivitiesQuery, UpdateActivityBody } from "../classes/validators/activityValidators.js";
import { ObjectId } from "mongodb";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";



@injectable()
export class ActivityService extends BaseService {
    constructor(

        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.activityRepository)
        private readonly activityRepository: ActivityRepository,

        @inject(HP_SYSTEM_TYPES.ruleConfigsRepository)
        private readonly ruleConfigRepository: RuleConfigsRepository,

        @inject(HP_SYSTEM_TYPES.cohortRepository)
        private readonly cohortRepository: CohortRepository,


    ) {
        super(mongoDatabase);
    }


    async create(teacherId: string, body: CreateActivityBody) {
        return this._withTransaction(async (session) => {
            if (body.submissionMode === "EXTERNAL_LINK" && !body.externalLink) {
                throw new BadRequestError("externalLink is required when submissionMode is EXTERNAL_LINK");
            }
            if (body.status == "ARCHIVED") {
                throw new BadRequestError("New activity cannot be created with ARCHIVED status");
            }

            const now = new Date();
            const doc = await this.activityRepository.createActivity(
                {
                    courseId: new ObjectId(body.courseId),
                    courseVersionId: new ObjectId(body.courseVersionId),
                    cohort: body.cohort,

                    createdByTeacherId: new ObjectId(teacherId),
                    publishedByTeacherId: body.status === "PUBLISHED" ? new ObjectId(teacherId) : undefined,
                    status: body.status,

                    title: body.title,
                    description: body.description,
                    activityType: body.activityType,

                    submissionMode: body.submissionMode,
                    externalLink: body.externalLink,
                    attachments: body.attachments ?? [],
                    required_percentage: body.required_percentage,

                    stats: {
                        totalStudents: 0,
                        submittedCount: 0,
                        completedCount: 0,
                        overdueCount: 0,
                        lastRecomputedAt: now,
                    },

                    createdAt: now,
                    updatedAt: now,
                },
                session,
            );

            return doc;
        });
    }

    async update(activityId: string, body: UpdateActivityBody) {
        return this._withTransaction(async (session) => {
            const existing = await this.activityRepository.findById(activityId);
            if (!existing) throw new NotFoundError("Activity not found");
            if (existing.status === "ARCHIVED") throw new BadRequestError("Archived activity cannot be updated");

            if (body.submissionMode === "EXTERNAL_LINK" && !body.externalLink && !existing.externalLink) {
                throw new BadRequestError("externalLink is required when submissionMode is EXTERNAL_LINK");
            }

            const updated = await this.activityRepository.updateActivityById(
                activityId,
                {
                    ...(body.title !== undefined ? { title: body.title } : {}),
                    ...(body.description !== undefined ? { description: body.description } : {}),
                    ...(body.activityType !== undefined ? { activityType: body.activityType } : {}),
                    ...(body.deadlineAt !== undefined ? { deadlineAt: new Date(body.deadlineAt) } : {}),
                    ...(body.allowLateSubmission !== undefined ? { allowLateSubmission: body.allowLateSubmission } : {}),
                    ...(body.submissionMode !== undefined ? { submissionMode: body.submissionMode } : {}),
                    ...(body.externalLink !== undefined ? { externalLink: body.externalLink } : {}),
                    ...(body.attachments !== undefined ? { attachments: body.attachments } : {}),
                    ...(body.ruleConfigId !== undefined ? { ruleConfigId: new ObjectId(body.ruleConfigId) } : {}),
                    ...(body.isMandatory !== undefined ? { isMandatory: body.isMandatory } : {}),
                    ...(body.cohort !== undefined ? { cohort: body.cohort } : {}),
                    ...(body.required_percentage !== undefined ? { required_percentage: body.required_percentage } : {}),
                    updatedAt: new Date(),
                },
                session,
            );

            if (!updated) throw new NotFoundError("Activity not found");
            return updated;
        });
    }

    async publish(activityId: string, teacherId: string) {
        return this._withTransaction(async (session) => {
            const existing = await this.activityRepository.findById(activityId);
            if (!existing) throw new NotFoundError("Activity not found");
            // if (existing.status === "ARCHIVED") throw new BadRequestError("Archived activity cannot be published");

            if (existing.submissionMode === "EXTERNAL_LINK" && !existing.externalLink) {
                throw new BadRequestError("externalLink is required for EXTERNAL_LINK submission mode");
            }

            const published = await this.activityRepository.publishActivity(activityId, teacherId, session);
            if (!published) throw new NotFoundError("Activity not found");
            return published;
        });
    }

    async archive(activityId: string) {
        return this._withTransaction(async (session) => {
            const existing = await this.activityRepository.findById(activityId);
            if (!existing) throw new NotFoundError("Activity not found");

            const archived = await this.activityRepository.archiveActivity(activityId, session);
            if (!archived) throw new NotFoundError("Activity not found");
            return archived;
        });
    }

    async delete(activityId: string, teacherId: string) {
        return this._withTransaction(async (session) => {
            // Validate ids
            if (!ObjectId.isValid(activityId)) {
                throw new BadRequestError("Invalid activity id");
            }
            if (!ObjectId.isValid(teacherId)) {
                throw new BadRequestError("Invalid teacher id");
            }

            const teacherObjectId = new ObjectId(teacherId);

            // Fetch activity (within session)
            const activity = await this.activityRepository.findById(
                activityId);

            if (!activity) {
                throw new BadRequestError("Activity not found");
            }

            // Allow only owner (adjust if admins allowed)
            const createdBy = activity.createdByTeacherId
                ? new ObjectId(activity.createdByTeacherId)
                : null;

            if (!createdBy || !createdBy.equals(teacherObjectId)) {
                throw new ForbiddenError("You are not allowed to delete this activity");
            }

            // Safety rule: do not delete published activities
            if (activity.status === "PUBLISHED") {
                throw new BadRequestError(
                    "Published activities cannot be deleted. Please archive instead.",
                );
            }


            // Delete activity
            const deleteRes = await this.activityRepository.softDeleteOne(
                activityId, teacherId, session
            );

            if (!deleteRes.modifiedCount) {
                throw new BadRequestError("Failed to delete activity");
            }

            //  clean related documents 
            await this.ruleConfigRepository.softDeleteByActivityId(activityId, teacherId, session);

            return {
                message: "Activity deleted successfully",
                activityId,
            };
        });
    }

    async getById(activityId: string) {
        const doc = await this.activityRepository.findById(activityId);
        if (!doc) throw new NotFoundError("Activity not found");
        return doc;
    }

    async list(filters: ListActivitiesQuery, userId: string) {
        // const enrollment = await this.cohortRepository.findEnrollment(userId, filters.courseId, filters.courseVersionId)
        // if (!enrollment) throw new BadRequestError("Enrollment not found!")
        // const role = enrollment.role;

        return this.activityRepository.listActivities(filters);
    }
}