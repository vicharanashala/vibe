import { getContainer } from "#root/bootstrap/loadModules.js"
import { ActivityRepository, ActivitySubmissionsRepository, LedgerRepository, RuleConfigsRepository } from "../repositories/index.js";
import { HP_SYSTEM_TYPES } from "../types.js";
import { HpActivity, HpLedger, RuleType } from "../models.js";
import {
    HpReasonCode,
    HpLedgerEventType,
    HpLedgerDirection,
    COHORT_OVERRIDES,
    LEGACY_COURSE_KEYS
} from "../constants.js";
import { ObjectId, ClientSession } from "mongodb";
import { IUser, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { HpActivityTransformer } from "../classes/transformers/Activity.js";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { HpPenaltyRule, HpRuleConfigTransformer, HpRuleLimits } from "../classes/transformers/RuleConfigs.js";
import { CohortStudentItemDto } from "../classes/validators/courseAndCohorts.js";
import { getActualCourseIds } from "./getActualCourseId.js";
import { HpActivitySubmission } from "../classes/transformers/ActivitySubmission.js";



export const allocatePenalty = async (): Promise<void> => {
    const container = getContainer();

    const activityRepo = container.get<ActivityRepository>(HP_SYSTEM_TYPES.activityRepository);
    const activityConfigsRepo = container.get<RuleConfigsRepository>(HP_SYSTEM_TYPES.ruleConfigsRepository);
    const activitySubmissionRepo = container.get<ActivitySubmissionsRepository>(HP_SYSTEM_TYPES.activitySubmissionsRepository);
    const ledgerRepo = container.get<LedgerRepository>(HP_SYSTEM_TYPES.ledgerRepository);
    const cohortRepo = container.get<CohortRepository>(HP_SYSTEM_TYPES.cohortRepository);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);

    console.log("🔍 Starting penalty allocation cron job...");

    try { 
        const lateMandatoryActivities = await activityConfigsRepo.getAllMandatoryLateActivities();


        console.log(`📋 Found ${lateMandatoryActivities.length} activities with passed deadlines and enabled penalties`);

        if (!lateMandatoryActivities.length) {
            console.log("✅ No activities require penalty processing");
            return;
        }

        type PenaltyProcessingDeps = {
            activityRepo: ActivityRepository;
            activitySubmissionRepo: ActivitySubmissionsRepository;
            ledgerRepo: LedgerRepository;
            cohortRepo: CohortRepository;
            db: MongoDatabase;
        };

        const deps: PenaltyProcessingDeps = {
            activityRepo,
            activitySubmissionRepo,
            ledgerRepo,
            cohortRepo,
            db,
        };

        let successCount = 0;
        let skippedCount = 0;
        let failureCount = 0;

        for (const activityConfig of lateMandatoryActivities) {
            console.log("activityConfig: ", lateMandatoryActivities)

            try {
                const isNotSkipped = await processActivityPenalties(activityConfig, deps);

                isNotSkipped ? successCount++ : skippedCount++;
            } catch (error) {
                failureCount++;
                console.error(
                    `❌ Failed processing penalties for activityConfig ${activityConfig._id?.toString?.() ?? "unknown"}:`,
                    error
                );
            }
        }

        console.log(
            `✅ Penalty allocation cron job completed.Skipped: ${skippedCount} Success: ${successCount}, Failed: ${failureCount}`
        );
    } catch (error) {
        console.error("❌ Penalty allocation failed:", error);
        throw error;
    }
};

const processActivityPenalties = async (
    activityConfig: HpRuleConfigTransformer,
    repositories: {
        activityRepo: ActivityRepository;
        activitySubmissionRepo: ActivitySubmissionsRepository;
        ledgerRepo: LedgerRepository;
        cohortRepo: CohortRepository;
        db: MongoDatabase;
    }
): Promise<boolean> => {
    const { activityRepo, activitySubmissionRepo, ledgerRepo, cohortRepo, db } = repositories;

    console.log(`🎯 Processing activity ${activityConfig.activityId}`);

    // Get activity details
    const activity = await activityRepo.findById(activityConfig.activityId.toString());
    if (!activity) {
        console.log(`⚠️ Activity not found: ${activityConfig.activityId}`);
        return;
    }

    // Get actual course IDs (handle legacy vs new cohort system)
    const { courseVersionId } = getActualCourseIds(activity);


    // <<<<<<<<<<<<<<<<<<<< CHANGE THIS WHIEN UPDATING COHORT NAME TO COHORT ID IN THE DB >>>>>>>>>>>>>>>
    const cohortId = await cohortRepo.getCohortIdByCohortName(activity.cohort);

    // Get enrolled students for this course/cohort
    const enrolledStudents = await cohortRepo.getStudentsForCohortByVersionAndCohortName(
        courseVersionId.toString(),
        cohortId
    );
    if (!enrolledStudents || enrolledStudents.length == 0) return false


    // Batch fetch all submissions and existing penalties upfront
    const [allSubmissionsBeforeDeadline, existingPenalties, existingMilestoneRewards] = await Promise.all([
        // Get all submissions for this activity
        activitySubmissionRepo.listSubmissionsBeforeDeadline(activity._id.toString()).catch(() => []),
        // Get all existing penalties for this activity  
        ledgerRepo.findPenaltiesByActivityId(activity._id.toString()).catch(() => []),

        // Get all existing penalties for this activity  
        ledgerRepo.findAllExisitingMilestoneRewards(activity._id.toString()).catch(() => [])
    ]);

    // Create lookup maps for O(1) access
    const submissionMap = new Map<string, HpActivitySubmission>(
        allSubmissionsBeforeDeadline.map((sub) => [sub.studentId.toString(), sub] as [string, HpActivitySubmission])
    );

    const penaltyMap = new Map<string, HpLedger>(
        existingPenalties.map((penalty) => [penalty.studentId.toString(), penalty] as [string, HpLedger])
    );

    const milestoneRewardsMap = new Map<string, HpLedger>(
        existingMilestoneRewards.map((reward) => [reward.studentId.toString(), reward] as [string, HpLedger])
    );

    // Filter students who actually need penalties (this is the optimization!)
    const studentsNeedingPenalty = enrolledStudents.filter((student: CohortStudentItemDto) => {
        const studentId = student._id.toString();
        const hasSubmitted = submissionMap.has(studentId);
        const hasPenalty = penaltyMap.has(studentId);
        const hasMilestoneReward = milestoneRewardsMap.has(studentId);

        if (hasSubmitted || hasPenalty || hasMilestoneReward) {
            return false;
        }

        return true; // This student needs penalty
    });

    if (studentsNeedingPenalty.length === 0) {
        return false
    }

    // Process only the students who need penalties
    const batchSize = 10; // Process in parallel batches
    for (let i = 0; i < studentsNeedingPenalty.length; i += batchSize) {
        const batch = studentsNeedingPenalty.slice(i, i + batchSize);

        const batchPromises = batch.map(student =>
            processStudentPenalty(student, activity, activityConfig, repositories)
        );

        await Promise.all(batchPromises);
    }


    console.log(`✅ Activity ${activity._id}: ${studentsNeedingPenalty.length} penalties processed`);
    return true
}

// async function processStudentPenalty(
//     student: CohortStudentItemDto,
//     activity: HpActivityTransformer,
//     activityConfig: HpRuleConfigTransformer,
//     repositories: {
//         activitySubmissionRepo: ActivitySubmissionsRepository;
//         ledgerRepo: LedgerRepository;
//         cohortRepo: CohortRepository;
//         db: MongoDatabase;
//     }
// ) {
//     const { ledgerRepo, cohortRepo, db } = repositories;
//     const client = await db.getClient();
//     const session = client.startSession();

//     const cohortId = await cohortRepo.getCohortIdByCohortName(activity.cohort)

//     try {
//         await session.withTransaction(async () => {
//             // Get current HP points
//             const currentHp = await cohortRepo.getCurrentHpPointsByCohortId(
//                 student._id,
//                 activity.courseId.toString(),
//                 activity.courseVersionId.toString(),
//                 cohortId,
//                 session
//             );

//             // Calculate penalty amount
//             const penaltyAmount = calculatePenaltyAmount(
//                 currentHp,
//                 activityConfig.penalty,
//                 activityConfig.limits
//             );

//             if (penaltyAmount <= 0) {
//                 console.log(`⚠️ No penalty to apply for student ${student.email} (amount: ${penaltyAmount})`);
//                 return;
//             }

//             // Apply penalty
//             const newHp = Math.max(0, currentHp - penaltyAmount);

//             const { courseId, courseVersionId } = getActualCourseIds(activity);

//             // Update enrollment HP
//             const hpUpdated = await cohortRepo.setHPForEnrollment(
//                 student._id.toString(),
//                 courseId,
//                 courseVersionId,
//                 activity.cohort,
//                 newHp,
//                 session
//             );


//             if (!hpUpdated) {
//                 throw new Error(`Failed to update HP for student ${student._id}`);
//             }
//             const penaltyNote = `Penalty applied for missing deadline of mandatory activity "${activity.title}". Deducted ${penaltyAmount} HP. Deadline: ${activityConfig.deadlineAt.toISOString()}.`;
//             // Create ledger entry
//             const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
//                 courseId: new ObjectId(activity.courseId.toString()),
//                 courseVersionId: new ObjectId(activity.courseVersionId.toString()),
//                 cohort: activity.cohort,
//                 studentId: new ObjectId(student._id),
//                 studentEmail: student.email,
//                 activityId: new ObjectId(activity._id),
//                 submissionId: null,
//                 eventType: HpLedgerEventType.DEBIT,
//                 direction: HpLedgerDirection.DEBIT,
//                 amount: penaltyAmount,
//                 calc: {
//                     ruleType: activityConfig.penalty.type as RuleType,
//                     percentage: activityConfig.penalty.type === "PERCENTAGE" ? activityConfig.penalty.value : undefined,
//                     absolutePoints: activityConfig.penalty.type === "ABSOLUTE" ? activityConfig.penalty.value : undefined,
//                     baseHpAtTime: currentHp,
//                     computedAmount: penaltyAmount,
//                     deadlineAt: activityConfig.deadlineAt,
//                     withinDeadline: false,
//                     reasonCode: HpReasonCode.MISSED_DEADLINE_PENALTY
//                 },
//                 links: null,
//                 meta: {
//                     triggeredBy: "SYSTEM_AUTOMATION",
//                     triggeredByUserId: null,
//                     note: penaltyNote
//                 }
//             };

//             await ledgerRepo.create(ledgerEntry, session);

//             console.log(`💰 Applied penalty of ${penaltyAmount} HP to student ${student.email}. New HP: ${newHp}`);

//         });
//     } catch (error) {
//         console.error(`❌ Failed to process penalty for student ${student.email}:`, error);
//         throw error;
//     } finally {
//         await session.endSession();
//     }
// }
async function processStudentPenalty(
    student: CohortStudentItemDto,
    activity: HpActivityTransformer,
    activityConfig: HpRuleConfigTransformer,
    repositories: {
        activitySubmissionRepo: ActivitySubmissionsRepository;
        ledgerRepo: LedgerRepository;
        cohortRepo: CohortRepository;
        db: MongoDatabase;
    }
) {
    const { ledgerRepo, cohortRepo, db } = repositories;
    const client = await db.getClient();
    const session = client.startSession();

    const cohortId = await cohortRepo.getCohortIdByCohortName(activity.cohort);

    try {
        await session.withTransaction(async () => {
            const currentHp = student.totalHp || 0;
            // await cohortRepo.getCurrentHpPointsByCohortId(
            //     student._id,
            //     activity.courseId.toString(),
            //     activity.courseVersionId.toString(),
            //     cohortId,
            //     session
            // );

            const penaltyAmount = calculatePenaltyAmount(
                currentHp,
                activityConfig.penalty,
                activityConfig.limits
            );

            if (penaltyAmount <= 0) {
                console.log(`⚠️ No penalty to apply for student ${student.email} (amount: ${penaltyAmount})`);
                return;
            }

            const newHp = Math.max(0, currentHp - penaltyAmount);
            const { courseId, courseVersionId } = getActualCourseIds(activity);

            const penaltyNote = `Penalty applied for missing deadline of mandatory activity "${activity.title}". Deducted ${penaltyAmount} HP. Deadline: ${activityConfig.deadlineAt.toISOString()}.`;

            const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
                courseId: new ObjectId(activity.courseId.toString()),
                courseVersionId: new ObjectId(activity.courseVersionId.toString()),
                cohort: activity.cohort,
                studentId: new ObjectId(student._id),
                studentEmail: student.email,
                activityId: new ObjectId(activity._id),
                submissionId: null,
                eventType: HpLedgerEventType.DEBIT,
                direction: HpLedgerDirection.DEBIT,
                amount: penaltyAmount,
                calc: {
                    ruleType: activityConfig.penalty.type as RuleType,
                    percentage: activityConfig.penalty.type === "PERCENTAGE" ? activityConfig.penalty.value : undefined,
                    absolutePoints: activityConfig.penalty.type === "ABSOLUTE" ? activityConfig.penalty.value : undefined,
                    baseHpAtTime: currentHp,
                    computedAmount: newHp,
                    deadlineAt: activityConfig.deadlineAt,
                    withinDeadline: false,
                    reasonCode: HpReasonCode.MISSED_DEADLINE_PENALTY
                },
                links: null,
                meta: {
                    triggeredBy: "SYSTEM_AUTOMATION",
                    triggeredByUserId: null,
                    note: penaltyNote
                }
            };

            try {
                await ledgerRepo.create(ledgerEntry, session);
            } catch (error: any) {
                if (error?.code === 11000) {
                    console.log(`⚠️ Penalty already exists for student ${student.email} and activity ${activity._id}`);
                    return;
                }
                throw error;
            }

            const hpUpdated = await cohortRepo.setHPForEnrollment(
                student._id.toString(),
                courseId,
                courseVersionId,
                activity.cohort,
                newHp,
                session
            );

            if (!hpUpdated) {
                throw new Error(`Failed to update HP for student ${student._id}`);
            }

            console.log(`💰 Applied penalty of ${penaltyAmount} HP to student ${student.email}. New HP: ${newHp}`);
        });
    } catch (error) {
        console.error(`❌ Failed to process penalty for student ${student.email}:`, error);
        throw error;
    } finally {
        await session.endSession();
    }
}

const calculatePenaltyAmount = (
    currentHp: number,
    penalty: HpPenaltyRule,
    limits: HpRuleLimits
): number => {

    if (penalty.type === "ABSOLUTE") {
        return penalty.value;
    } else if (penalty.type === "PERCENTAGE") {

        const penaltyMaxLimit = limits?.maxHp;
        const penaltyMinLimit = limits?.minHp;

        // Calculate percentage reward
        const calculatedReward = Math.round((currentHp * penalty.value) / 100);

        let finalReward = calculatedReward;

        if (penaltyMinLimit && finalReward < penaltyMinLimit) {
            finalReward = penaltyMinLimit;
        }

        if (penaltyMaxLimit && finalReward > penaltyMaxLimit) {
            finalReward = penaltyMaxLimit;
        }

        return Math.max(0, finalReward);
    }

    return 0;
}


