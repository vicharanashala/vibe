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
import { getActualCourseIds } from "./getActualCourseId.js";
import { HpRewardRule, HpRuleConfigTransformer, HpRuleLimits } from "../classes/transformers/RuleConfigs.js";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { CohortStudentItemDto } from "../classes/validators/courseAndCohorts.js";
import { HpActivityTransformer } from "../classes/transformers/Activity.js";


export const allocateReward = async () => {
    console.log('🔍 allocateReward function called!');

    const container = getContainer();

    const activityRepo = container.get<ActivityRepository>(HP_SYSTEM_TYPES.activityRepository);
    const activityConfigsRepo = container.get<RuleConfigsRepository>(HP_SYSTEM_TYPES.ruleConfigsRepository);
    const ledgerRepo = container.get<LedgerRepository>(HP_SYSTEM_TYPES.ledgerRepository);
    const cohortRepo = container.get<any>(HP_SYSTEM_TYPES.cohortRepository);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);

    console.log('🔍 Starting milestone reward allocation cron job...');

    try {

        // Get reward configs for these milestone activities
        const milestoneActivityConfigs = await activityConfigsRepo.getAllMilestoneActivities();

        console.log(`🎯 Found ${milestoneActivityConfigs.length} milestone activities with enabled rewards`);

        if (milestoneActivityConfigs.length === 0) {
            console.log('✅ No milestone activities found with rewards enabled');
            return;
        }

        // Process each milestone activity with reward config
        for (const activityConfig of milestoneActivityConfigs) {
            await processMilestoneRewards(activityConfig, {
                activityRepo,
                ledgerRepo,
                cohortRepo,
                db
            });
        }

        console.log('✅ Milestone reward allocation cron job completed successfully');

    } catch (error) {
        console.error('❌ Milestone reward allocation failed:', error);
        throw error;
    }
}

interface ProcessRewardDependencies {
    activityRepo: ActivityRepository;
    ledgerRepo: LedgerRepository;
    cohortRepo: CohortRepository;
    db: MongoDatabase;
}

const processMilestoneRewards = async (
    activityConfig: HpRuleConfigTransformer,
    dependencies: ProcessRewardDependencies
) => {
    const { activityRepo, ledgerRepo, cohortRepo, db } = dependencies;
    // Get activity details
    const activity = await activityRepo.findById(activityConfig.activityId.toString());
    if (!activity) {
        console.log(`⚠️ Activity not found: ${activityConfig.activityId}`);
        return;
    }

    if (!activity.required_percentage) {
        console.log(`Required Percentage is not defined, required_percentage:  ${activity.required_percentage}`);
        return;
    }

    if (activityConfig.reward.enabled == false) {
        console.log(`Activity reward is disabled, rewardConfig: ${activityConfig.reward.enabled}`)
        return;
    }

    console.log(`🎯 Processing milestone activity: ${activityConfig.activityId}`);
    console.log(`📊 Required progress percentage: ${activity.required_percentage}%`);
    console.log(`💰 Reward type: ${activityConfig.reward.type}, Value: ${activityConfig.reward.value}`);

    // Get actual course IDs (handle legacy vs new cohort system)
    const { courseId, courseVersionId } = getActualCourseIds(activity);
    console.log(`🎯 Processing activity: ${activity._id} (Course: ${courseId}, Version: ${courseVersionId})`);


    // <<<<<<<<<<<<<<<<<<<< CHANGE THIS WHIEN UPDATING COHORT NAME TO COHORT ID IN THE DB >>>>>>>>>>>>>>>
    const cohortId = await cohortRepo.getCohortIdByCohortName(activity.cohort);


    // Get enrolled students for this course/version
    const enrolledStudents = await cohortRepo.getStudentsForCohortByVersionAndCohortName(
        courseVersionId.toString(),
        cohortId
    );

    if (!enrolledStudents || enrolledStudents.length == 0) return false



    console.log(`👥 Found ${enrolledStudents.length} active student enrollments`);

    // OPTIMIZED: Batch fetch existing rewards upfront
    console.log('📦 Batch fetching existing rewards...');
    const existingRewards = await ledgerRepo.findRewardsByActivityId(activity._id.toString()).catch(() => []);

    console.log(`📄 Found ${existingRewards.length} existing rewards`);

    // Create lookup map for O(1) access
    const rewardMap = new Map<string, HpLedger>(
        existingRewards.map((reward: HpLedger) => [reward.studentId.toString(), reward] as [string, HpLedger])
    );


    // OPTIMIZED: Filter students who actually need rewards (this is optimization!)
    const studentsNeedingReward = enrolledStudents.filter((student: CohortStudentItemDto) => {
        const studentId = student._id.toString();
        const currentProgress = student.completionPercentage || 0;
        const requiredProgress = activity.required_percentage;
        const hasReward = rewardMap.has(studentId);

        // Check progress requirement
        if (currentProgress < requiredProgress) {
            console.log(`❌ Student ${student.email} not eligible: ${currentProgress}% < ${requiredProgress}% required`);
            return false;
        }

        // Check if reward already given
        if (hasReward) {
            console.log(`🔄 Student ${student.email} already has reward for this milestone`);
            return false;
        }

        if (!activityConfig.deadlineAt) {
            console.log("No deadline configured for this activity...")
            return false
        }
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Check if the milestone completed after deadline or not
        // const isAfterDeadline = Date.now() > activityConfig.deadlineAt.getTime();

        // if (isAfterDeadline && activityConfig.reward.lateBehavior === "NO_REWARD") {
        //     console.log(`⏰ After deadline and lateBehavior=NO_REWARD - no reward for ${student.email}`);
        //     return false;
        // }

        console.log(`✅ Student ${student.email} eligible for reward: ${currentProgress}% >= ${requiredProgress}%`);
        return true; // This student needs reward
    });

    console.log(`🎯 Students needing reward: ${studentsNeedingReward.length}/${enrolledStudents.length}`);

    if (studentsNeedingReward.length === 0) {
        console.log(`✅ No students require rewards for activity ${activity._id}`);
        return;
    }

    // OPTIMIZED: Process only students who need rewards in parallel batches
    const batchSize = 10; // Process in parallel batches
    for (let i = 0; i < studentsNeedingReward.length; i += batchSize) {
        const batch = studentsNeedingReward.slice(i, i + batchSize);

        const batchPromises = batch.map(student =>
            processStudentReward(student, activityConfig, activity, {
                ledgerRepo,
                cohortRepo,
                db
            })
        );

        await Promise.all(batchPromises);
        console.log(`⚡ Processed reward batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studentsNeedingReward.length / batchSize)}`);
    }

    console.log(`✅ Completed activity ${activity._id}: ${studentsNeedingReward.length} rewards processed`);
}

interface StudentRewardDependencies {
    ledgerRepo: LedgerRepository;
    cohortRepo: CohortRepository;
    db: MongoDatabase;
}

const processStudentReward = async (
    student: CohortStudentItemDto,
    activityConfig: HpRuleConfigTransformer,
    activity: HpActivityTransformer,
    dependencies: StudentRewardDependencies
) => {
    const { ledgerRepo, cohortRepo, db } = dependencies;

    const studentId = student._id.toString();

    console.log(`\n🎓 Processing student: ${student.email}, ==> Current progress: ${student.completionPercentage || 0}%`);

    // Calculate reward amount
    const currentHp = student.totalHp || 0;
    const rewardAmount = calculateRewardAmount(
        currentHp,
        activityConfig.reward,
        activityConfig.limits
    );

    // if (rewardAmount <= 0) {
    //     console.log(`💰 Reward amount is 0 or negative - skipping`);
    //     return;
    // }

    const newHp = currentHp + rewardAmount;

    console.log(`💰 Reward: +${rewardAmount} HP (Current: ${currentHp} → New: ${newHp})`);

    const requiredPercentage = activity.required_percentage ?? 0;

    const note = `Milestone completed for "${activity.title}". Progress: ${student.completionPercentage}% (required: ${requiredPercentage}%). Rewarded ${rewardAmount} HP.`;    // Apply reward and create ledger entry

    await applyStudentReward(
        student,
        activity,
        activityConfig,
        rewardAmount,
        newHp,
        note,
        { ledgerRepo, cohortRepo, db }
    );

    console.log(`✅ Reward processed successfully for student ${studentId}`);
}

const calculateRewardAmount = (
    currentHp: number,
    reward: HpRewardRule,
    limits: HpRuleLimits
): number => {
    if (reward.type === "ABSOLUTE") {
        return reward.value;
    } else if (reward.type === "PERCENTAGE") {
        const rewardMaxLimit = limits?.maxHp;
        const rewardMinLimit = limits?.minHp;

        const calculatedReward = Math.round((currentHp * reward.value) / 100);

        let finalReward = calculatedReward;

        if (rewardMinLimit != null && finalReward < rewardMinLimit) {
            finalReward = rewardMinLimit;
        }

        if (rewardMaxLimit != null && finalReward > rewardMaxLimit) {
            finalReward = rewardMaxLimit;
        }

        return Math.max(0, finalReward);
    }

    return 0;
};

// const applyStudentReward = async (
//     student: CohortStudentItemDto,
//     activity: HpActivityTransformer,
//     activityConfig: HpRuleConfigTransformer,
//     rewardAmount: number,
//     newHp: number,
//     note: string,
//     dependencies: { ledgerRepo: LedgerRepository; cohortRepo: CohortRepository; db: MongoDatabase }
// ) => {
//     const { ledgerRepo, cohortRepo, db } = dependencies;
//     const studentId = student._id.toString();

//     const client = await db.getClient();
//     const session = client.startSession();

//     try {
//         await session.withTransaction(async () => {
//             // Get actual course IDs (handle legacy vs new cohort system)
//             const { courseId, courseVersionId } = getActualCourseIds(activity);

//             // Update student HP using repository method
//             const hpUpdated = await cohortRepo.setHPForEnrollment(
//                 studentId.toString(),
//                 courseId.toString(),
//                 courseVersionId.toString(),
//                 activity.cohort,
//                 newHp,
//                 session
//             );

//             if (!hpUpdated) {
//                 throw new Error(`Failed to update HP for student ${studentId}`);
//             }

//             // Create ledger entry
//             const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
//                 courseId: new ObjectId(activity.courseId),
//                 courseVersionId: new ObjectId(activity.courseVersionId),
//                 cohort: activity.cohort || "",
//                 studentId: new ObjectId(studentId),
//                 studentEmail: student.email,
//                 activityId: new ObjectId(activity._id),
//                 submissionId: null,
//                 eventType: HpLedgerEventType.CREDIT,
//                 direction: HpLedgerDirection.CREDIT,
//                 amount: rewardAmount,
//                 calc: {
//                     ruleType: activityConfig.reward.type as RuleType,
//                     percentage: activityConfig.reward.type === "PERCENTAGE" ? activityConfig.reward.value : undefined,
//                     absolutePoints: activityConfig.reward.type === "ABSOLUTE" ? activityConfig.reward.value : undefined,
//                     baseHpAtTime: newHp - rewardAmount,
//                     computedAmount: rewardAmount,
//                     deadlineAt: activityConfig.deadlineAt,
//                     withinDeadline: new Date() <= new Date(activityConfig.deadlineAt),
//                     reasonCode: HpReasonCode.MILESTONE_REWARD
//                 },
//                 links: null,
//                 meta: {
//                     triggeredBy: "SYSTEM_AUTOMATION",
//                     triggeredByUserId: null,
//                     note
//                 }
//             };

//             await ledgerRepo.create(ledgerEntry, session);

//             console.log(`💾 Ledger entry created for reward: ${rewardAmount} HP`);
//         });

//         console.log(`✅ Transaction completed successfully`);
//     } catch (error) {
//         console.error(`❌ Failed to apply reward for student ${studentId}:`, error);
//         throw error;
//     } finally {
//         await session.endSession();
//     }
// }


const applyStudentReward = async (
    student: CohortStudentItemDto,
    activity: HpActivityTransformer,
    activityConfig: HpRuleConfigTransformer,
    rewardAmount: number,
    newHp: number,
    note: string,
    dependencies: { ledgerRepo: LedgerRepository; cohortRepo: CohortRepository; db: MongoDatabase }
) => {
    const { ledgerRepo, cohortRepo, db } = dependencies;
    const studentId = student._id.toString();

    const client = await db.getClient();
    const session = client.startSession();

    try {
        await session.withTransaction(async () => {
            const { courseId, courseVersionId } = getActualCourseIds(activity);

            const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
                courseId: new ObjectId(activity.courseId),
                courseVersionId: new ObjectId(activity.courseVersionId),
                cohort: activity.cohort || "",
                studentId: new ObjectId(studentId),
                studentEmail: student.email,
                activityId: new ObjectId(activity._id),
                submissionId: null,
                eventType: HpLedgerEventType.CREDIT,
                direction: HpLedgerDirection.CREDIT,
                amount: rewardAmount,
                calc: {
                    ruleType: activityConfig.reward.type as RuleType,
                    percentage: activityConfig.reward.type === "PERCENTAGE" ? activityConfig.reward.value : undefined,
                    absolutePoints: activityConfig.reward.type === "ABSOLUTE" ? activityConfig.reward.value : undefined,
                    baseHpAtTime: student.totalHp ?? 0,
                    computedAmount: newHp,
                    deadlineAt: activityConfig.deadlineAt,
                    withinDeadline: new Date() <= new Date(activityConfig.deadlineAt),
                    reasonCode: HpReasonCode.MILESTONE_REWARD
                },
                links: null,
                meta: {
                    triggeredBy: "SYSTEM_AUTOMATION",
                    triggeredByUserId: null,
                    note
                }
            };

            try {
                await ledgerRepo.create(ledgerEntry, session);
            } catch (error: any) {
                if (error?.code === 11000) {
                    console.log(`⚠️ Reward already exists for student ${studentId} and activity ${activity._id}`);
                    return;
                }
                throw error;
            }

            const hpUpdated = await cohortRepo.setHPForEnrollment(
                studentId,
                courseId.toString(),
                courseVersionId.toString(),
                activity.cohort,
                newHp,
                session
            );

            if (!hpUpdated) {
                throw new Error(`Failed to update HP for student ${studentId}`);
            }

            console.log(`💾 Ledger entry created for reward: ${rewardAmount} HP`);
        });

        console.log(`✅ Transaction completed successfully`);
    } catch (error) {
        console.error(`❌ Failed to apply reward for student ${studentId}:`, error);
        throw error;
    } finally {
        await session.endSession();
    }
};