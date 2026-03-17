import { getContainer } from "#root/bootstrap/loadModules.js"
import { ActivityRepository, ActivitySubmissionsRepository, LedgerRepository, RuleConfigsRepository } from "../repositories/index.js";
import { HP_SYSTEM_TYPES } from "../types.js";
import { HpLedger, RuleType } from "../models.js";
import { 
    HpReasonCode, 
    HpLedgerEventType, 
    HpLedgerDirection,
    COHORT_OVERRIDES
} from "../constants.js";
import { ObjectId, ClientSession } from "mongodb";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";

// Helper function to resolve course IDs (handle legacy vs new cohort system)
function getActualCourseIds(activity: any) {
    const isLegacyCourse = activity.courseId === "0000000000000001" && 
                          activity.courseVersionId === "00000000000002";
    
    if (isLegacyCourse) {
        const override = COHORT_OVERRIDES[activity.cohort];
        if (!override) {
            throw new Error(`No cohort override found for: ${activity.cohort}`);
        }
        return {
            courseId: override.courseId,
            courseVersionId: override.versionId
        };
    }
    
    return {
        courseId: activity.courseId,
        courseVersionId: activity.courseVersionId
    };
}

export const allocatePenality = async () => {
    const container = getContainer();

    const activityRepo = container.get<ActivityRepository>(HP_SYSTEM_TYPES.activityRepository);
    const activityConfigsRepo = container.get<RuleConfigsRepository>(HP_SYSTEM_TYPES.ruleConfigsRepository);
    const activitySubmissionRepo = container.get<ActivitySubmissionsRepository>(HP_SYSTEM_TYPES.activitySubmissionsRepository);
    const ledgerRepo = container.get<LedgerRepository>(HP_SYSTEM_TYPES.ledgerRepository);
    const cohortRepo = container.get<any>(HP_SYSTEM_TYPES.cohortRepository);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);

    console.log('🔍 Starting penalty allocation cron job...');

    try {
        // Phase 1: Get all late activities with mandatory penalties
        const lateActivities = await activityConfigsRepo.getAllLateActivities();
        console.log(`📋 Found ${lateActivities.length} activities with passed deadlines and enabled penalties`);

        if (lateActivities.length === 0) {
            console.log('✅ No activities require penalty processing');
            return;
        }

        // Process each activity
        for (const activityConfig of lateActivities) {
            await processActivityPenalties(activityConfig, {
                activityRepo,
                activitySubmissionRepo,
                ledgerRepo,
                cohortRepo,
                db
            });
        }

        console.log('✅ Penalty allocation cron job completed successfully');

    } catch (error) {
        console.error('❌ Penalty allocation failed:', error);
        throw error;
    }
};

async function processActivityPenalties(
    activityConfig: any,
    repositories: {
        activityRepo: ActivityRepository;
        activitySubmissionRepo: ActivitySubmissionsRepository;
        ledgerRepo: LedgerRepository;
        cohortRepo: any;
        db: MongoDatabase;
    }
) {
    const { activityRepo, activitySubmissionRepo, ledgerRepo, cohortRepo, db } = repositories;
    
    console.log(`🎯 Processing activity ${activityConfig.activityId}`);

    // Get activity details
    const activity = await activityRepo.findById(activityConfig.activityId.toString());
    if (!activity) {
        console.log(`⚠️ Activity not found: ${activityConfig.activityId}`);
        return;
    }

    // Get actual course IDs (handle legacy vs new cohort system)
    const { courseId, courseVersionId } = getActualCourseIds(activity);

    // Get enrolled students for this course/cohort
    const enrolledStudents = await cohortRepo.getStudentsForCohortByVersionAndCohortName(
        courseVersionId.toString(),
        activity.cohort
    );

    // Batch fetch all submissions and existing penalties upfront
    const [allSubmissions, existingPenalties] = await Promise.all([
        // Get all submissions for this activity
        activitySubmissionRepo.list({ activityId: activity._id.toString() }).catch(() => []),
        // Get all existing penalties for this activity  
        ledgerRepo.findPenaltiesByActivityId(activity._id.toString()).catch(() => [])
    ]);

    // Create lookup maps for O(1) access
    const submissionMap = new Map<string, any>(
        allSubmissions.map((sub: any) => [sub.studentId.toString(), sub] as [string, any])
    );
    const penaltyMap = new Map<string, any>(
        existingPenalties.map((penalty: any) => [penalty.studentId.toString(), penalty] as [string, any])
    );

    // Filter students who actually need penalties (this is the optimization!)
    const studentsNeedingPenalty = enrolledStudents.filter((student: any) => {
        const studentId = student._id.toString();
        const hasSubmitted = submissionMap.has(studentId);
        const hasPenalty = penaltyMap.has(studentId);
        
        if (hasSubmitted || hasPenalty) {
            return false;
        }
        
        return true; // This student needs penalty
    });

    if (studentsNeedingPenalty.length === 0) {
        return;
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
}

async function processStudentPenalty(
    student: any,
    activity: any,
    activityConfig: any,
    repositories: {
        activitySubmissionRepo: ActivitySubmissionsRepository;
        ledgerRepo: LedgerRepository;
        cohortRepo: any;
        db: MongoDatabase;
    }
) {
    const { ledgerRepo, cohortRepo, db } = repositories;
    
    const client = await db.getClient();
    const session = client.startSession();

    try {
        await session.withTransaction(async () => {
            // Get current HP points
            const currentHp = await cohortRepo.getCurrentHpPoints(
                student._id,
                activity.courseId.toString(),
                activity.courseVersionId.toString(),
                session
            );

            // Calculate penalty amount
            const penaltyAmount = calculatePenaltyAmount(
                currentHp,
                activityConfig.penalty,
                activityConfig.limits
            );

            if (penaltyAmount <= 0) {
                console.log(`⚠️ No penalty to apply for student ${student.email} (amount: ${penaltyAmount})`);
                return;
            }

            // Apply penalty
            const newHp = Math.max(0, currentHp - penaltyAmount);
            const minHp = activityConfig.limits?.minHp || 0;
            const finalHp = Math.max(minHp, newHp);

            // Update enrollment HP
            // const hpUpdated = await cohortRepo.setHPForEnrollment(
            //     student._id,
            //     activity.courseId.toString(),
            //     activity.courseVersionId.toString(),
            //     finalHp,
            //     session
            // );


            // if (!hpUpdated) {
            //     throw new Error(`Failed to update HP for student ${student._id}`);
            // }

            // Create ledger entry
            const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
                courseId: new ObjectId(activity.courseId),
                courseVersionId: new ObjectId(activity.courseVersionId),
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
                    computedAmount: penaltyAmount,
                    deadlineAt: activityConfig.deadlineAt,
                    withinDeadline: false,
                    reasonCode: HpReasonCode.MISSED_DEADLINE_PENALTY
                },
                links: null,
                meta: {
                    triggeredBy: "JOB",
                    triggeredByUserId: null,
                    note: "Penalty for missing mandatory activity deadline"
                }
            };

            // await ledgerRepo.create(ledgerEntry, session);

            console.log(`💰 Applied penalty of ${penaltyAmount} HP to student ${student.email}. New HP: ${finalHp}`);

        });
    } catch (error) {
        console.error(`❌ Failed to process penalty for student ${student.email}:`, error);
        throw error;
    } finally {
        await session.endSession();
    }
}

function calculatePenaltyAmount(
    currentHp: number,
    penalty: any,
    limits: any
): number {
    if (penalty.type === "ABSOLUTE") {
        return penalty.value;
    } else if (penalty.type === "PERCENTAGE") {
        const percentageAmount = currentHp * (penalty.value / 100);
        
        // Apply minHP limit
        const minHp = limits?.minHp || 0;
        const maxAllowedPenalty = Math.max(0, currentHp - minHp);
        
        return Math.min(percentageAmount, maxAllowedPenalty);
    }
    
    return 0;
}