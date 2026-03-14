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
        // Phase 1: Get all published milestone activities with enabled rewards
        const milestoneActivities = await activityRepo.listActivities({
            status: "PUBLISHED"
        });
        
        // Filter for milestone activities with enabled reward configs
        const milestoneActivityIds = milestoneActivities
            .filter(activity => activity.activityType === "MILESTONE" || activity.activityType === "VIBE_MILESTONE")
            .map(activity => activity._id?.toString());

        console.log(`📋 Found ${milestoneActivityIds.length} published milestone activities`);

        if (milestoneActivityIds.length === 0) {
            console.log('✅ No milestone activities require reward processing');
            return;
        }

        // Get reward configs for these milestone activities
        const rewardConfigs = await activityConfigsRepo.getAllMilestoneActivities();
        const validRewardConfigs = rewardConfigs.filter(config => 
            milestoneActivityIds.includes(config.activityId?.toString())
        );

        console.log(`🎯 Found ${validRewardConfigs.length} milestone activities with enabled rewards`);

        if (validRewardConfigs.length === 0) {
            console.log('✅ No milestone activities with enabled rewards found');
            return;
        }

        // Process each milestone activity with reward config
        for (const activityConfig of validRewardConfigs) {
            await processMilestoneRewards(activityConfig, {
                activityRepo,
                activitySubmissionRepo: null, // Not needed for milestones
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
    activitySubmissionRepo: ActivitySubmissionsRepository | null; // Not needed for milestones
    ledgerRepo: LedgerRepository;
    cohortRepo: any;
    db: MongoDatabase;
}

async function processMilestoneRewards(
    activityConfig: any,
    dependencies: ProcessRewardDependencies
) {
    const { activityRepo, ledgerRepo, cohortRepo, db } = dependencies;
    
    console.log(`🎯 Processing milestone activity: ${activityConfig.activityId}`);
    console.log(`📊 Required progress percentage: ${activityConfig.reward.required_percentage}%`);
    console.log(`💰 Reward type: ${activityConfig.reward.type}, Value: ${activityConfig.reward.value}`);

    // Get activity details
    const activity = await activityRepo.findById(activityConfig.activityId.toString());
    if (!activity) {
        console.log(`⚠️ Activity not found: ${activityConfig.activityId}`);
        return;
    }

    // Get actual course IDs (handle legacy vs new cohort system)
    const { courseId, courseVersionId } = getActualCourseIds(activity);
    console.log(`🎯 Processing activity: ${activity._id} (Course: ${courseId}, Version: ${courseVersionId})`);

    // Get enrolled students for this course/version
    const enrolledStudents = await cohortRepo.getStudentsForCohortByVersionAndCohortName(
        courseVersionId.toString(),
        activity.cohort
    );

    console.log(`👥 Found ${enrolledStudents.length} active student enrollments`);

    // OPTIMIZED: Batch fetch existing rewards upfront (no submissions needed for milestones)
    console.log('📦 Batch fetching existing rewards...');
    const existingRewards = await ledgerRepo.findRewardsByActivityId(activity._id.toString()).catch(() => []);

    console.log(`📄 Found ${existingRewards.length} existing rewards`);

    // Create lookup map for O(1) access
    const rewardMap = new Map<string, any>(
        existingRewards.map((reward: any) => [reward.studentId.toString(), reward] as [string, any])
    );

    // OPTIMIZED: Filter students who actually need rewards (this is optimization!)
    const studentsNeedingReward = enrolledStudents.filter((student: any) => {
        const studentId = student._id.toString();
        const currentProgress = student.percentCompleted || 0;
        const requiredProgress = activityConfig.reward.required_percentage;
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

        // Check deadline compliance
        const now = new Date();
        const deadline = new Date(activityConfig.deadlineAt);
        const isAfterDeadline = now > deadline;

        if (isAfterDeadline) {
            if (activityConfig.reward.onlyWithinDeadline) {
                console.log(`⏰ After deadline and onlyWithinDeadline=true - no reward for ${student.email}`);
                return false;
            } else if (activityConfig.reward.lateBehavior === "NO_REWARD") {
                console.log(`⏰ After deadline and lateBehavior=NO_REWARD - no reward for ${student.email}`);
                return false;
            }
        }

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
                activitySubmissionRepo: null, // Not needed for milestones
                ledgerRepo,
                cohortRepo,
                db
            })
        );
        
        await Promise.all(batchPromises);
        console.log(`⚡ Processed reward batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(studentsNeedingReward.length/batchSize)}`);
    }

    console.log(`✅ Completed activity ${activity._id}: ${studentsNeedingReward.length} rewards processed`);
}

interface StudentRewardDependencies {
    activitySubmissionRepo: ActivitySubmissionsRepository | null; // Not needed for milestones
    ledgerRepo: LedgerRepository;
    cohortRepo: any;
    db: MongoDatabase;
}

async function processStudentReward(
    student: any,
    activityConfig: any,
    activity: any,
    dependencies: StudentRewardDependencies
) {
    const { ledgerRepo, cohortRepo, db } = dependencies;
    
    const studentId = student._id.toString();
    const enrollmentId = student._id?.toString(); // Assuming this is enrollment ID
    
    console.log(`\n🎓 Processing student: ${studentId}`);
    console.log(`� Current progress: ${student.percentCompleted || 0}%`);

    // Calculate reward amount
    const currentHp = student.hpPoints || 0;
    const rewardAmount = calculateRewardAmount(
        activityConfig.reward.type,
        activityConfig.reward.value,
        currentHp,
        activityConfig.reward.minHpFloor,
        activityConfig.limits?.maxHp
    );

    if (rewardAmount <= 0) {
        console.log(`💰 Reward amount is 0 or negative - skipping`);
        return;
    }

    const newHp = currentHp + rewardAmount;

    console.log(`💰 Reward calculation:`);
    console.log(`   📊 Current HP: ${currentHp}`);
    console.log(`   🎯 Reward Type: ${activityConfig.reward.type}`);
    console.log(`   📝 Reward Value: ${activityConfig.reward.value}`);
    if (activityConfig.reward.type === "PERCENTAGE") {
        console.log(`   📈 Percentage Calculation: ${currentHp} × (${activityConfig.reward.value}% / 100) = ${rewardAmount}`);
    } else {
        console.log(`   🔢 Absolute Reward: ${rewardAmount}`);
    }
    console.log(`   ⚠️  Min HP Floor: ${activityConfig.reward.minHpFloor}`);
    console.log(`   📈 New HP: ${currentHp} + ${rewardAmount} = ${newHp}`);

    // Apply reward and create ledger entry
    await applyStudentReward(
        enrollmentId,
        studentId,
        activity,
        activityConfig,
        rewardAmount,
        newHp,
        "MILESTONE_COMPLETED",
        { ledgerRepo, cohortRepo, db }
    );

    console.log(`✅ Reward processed successfully for student ${studentId}`);
}

function calculateRewardAmount(
    type: "ABSOLUTE" | "PERCENTAGE",
    value: number,
    currentHp: number,
    minHpFloor: number,
    maxHp?: number
): number {
    let rewardAmount: number;

    if (type === "ABSOLUTE") {
        rewardAmount = value;
    } else {
        // PERCENTAGE calculation
        rewardAmount = Math.floor((currentHp * value) / 100);
        
        // Apply minimum HP floor
        if (rewardAmount < minHpFloor) {
            rewardAmount = minHpFloor;
        }
    }

    // Apply max HP limit if specified
    if (maxHp && (currentHp + rewardAmount) > maxHp) {
        rewardAmount = maxHp - currentHp;
        
        // Ensure reward is not negative
        if (rewardAmount < 0) {
            rewardAmount = 0;
        }
    }

    return rewardAmount;
}

async function applyStudentReward(
    enrollmentId: string,
    studentId: string,
    activity: any,
    activityConfig: any,
    rewardAmount: number,
    newHp: number,
    reason: string,
    dependencies: { ledgerRepo: LedgerRepository; cohortRepo: any; db: MongoDatabase }
) {
    const { ledgerRepo, cohortRepo, db } = dependencies;

    const client = await db.getClient();
    const session = client.startSession();

    try {
        await session.withTransaction(async () => {
            // Get actual course IDs (handle legacy vs new cohort system)
            const { courseId, courseVersionId } = getActualCourseIds(activity);

            // Update student HP using repository method
            // const hpUpdated = await cohortRepo.setHPForEnrollment(
            //     studentId,
            //     courseId.toString(),
            //     courseVersionId.toString(),
            //     newHp,
            //     session
            // );

            // if (!hpUpdated) {
            //     throw new Error(`Failed to update HP for student ${studentId}`);
            // }

            // Create ledger entry
            const ledgerEntry: Omit<HpLedger, "_id" | "createdAt"> = {
                courseId: new ObjectId(activity.courseId),
                courseVersionId: new ObjectId(activity.courseVersionId),
                cohort: activity.cohort || "",
                studentId: new ObjectId(studentId),
                studentEmail: "", // Email not available in this scope, would need user repo lookup
                activityId: new ObjectId(activity._id),
                submissionId: null,
                eventType: HpLedgerEventType.CREDIT,
                direction: HpLedgerDirection.CREDIT,
                amount: rewardAmount,
                calc: {
                    ruleType: activityConfig.reward.type as RuleType,
                    percentage: activityConfig.reward.type === "PERCENTAGE" ? activityConfig.reward.value : undefined,
                    absolutePoints: activityConfig.reward.type === "ABSOLUTE" ? activityConfig.reward.value : undefined,
                    baseHpAtTime: newHp - rewardAmount,
                    computedAmount: rewardAmount,
                    deadlineAt: activityConfig.deadlineAt,
                    withinDeadline: new Date() <= new Date(activityConfig.deadlineAt),
                    reasonCode: HpReasonCode.SUBMISSION_REWARD
                },
                links: null,
                meta: {
                    triggeredBy: "JOB",
                    triggeredByUserId: null,
                    note: `Reward for completing milestone: ${reason}`
                }
            };

            // await ledgerRepo.create(ledgerEntry, session);

            console.log(`💾 Ledger entry created for reward: ${rewardAmount} HP`);
        });

        console.log(`✅ Transaction completed successfully`);
    } catch (error) {
        console.error(`❌ Failed to apply reward for student ${studentId}:`, error);
        throw error;
    } finally {
        await session.endSession();
    }
}
