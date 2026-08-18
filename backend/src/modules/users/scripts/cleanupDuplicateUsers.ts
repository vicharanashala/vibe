/**
 * One-off cleanup of duplicate user documents that share the same firebaseUID.
 *
 * A race condition during first login can create multiple user documents for the
 * same Firebase account. This script identifies every duplicate group, picks a
 * "keeper" userId, migrates all related data to it, then deletes the leftover
 * user documents.
 *
 * Keeper selection:
 *   1. The userId with the most watchTime records.
 *   2. Tie-break: lowest ObjectId (earliest created).
 *
 * Collections migrated (in order):
 *   watchTime, enrollment, progress, quiz_attempts, quiz_submission_results,
 *   user_quiz_metrics, slotBookings, project_submissions
 *
 * Dry-run by default; pass --apply to write. Saves a JSON snapshot before any
 * writes. Each duplicate group is processed independently — a failure in one
 * group does not abort the rest.
 *
 * Self-contained raw Mongo (no DI container).
 *
 * Usage:
 *   npx ts-node src/modules/users/scripts/cleanupDuplicateUsers.ts            # dry-run
 *   npx ts-node src/modules/users/scripts/cleanupDuplicateUsers.ts --apply    # write
 */
import "dotenv/config";
import { MongoClient, ObjectId, Db } from "mongodb";
import * as fs from "fs";
import * as path from "path";

const MONGO_URI = process.env.DB_URL!;
const DB_NAME = process.env.DB_NAME || "vibe";
const APPLY = process.argv.includes("--apply");

interface DuplicateGroup {
  firebaseUID: string;
  keeperId: string;
  duplicateIds: string[];
  keeperWatchTimeCount: number;
}

interface MigrationAction {
  group: string; // firebaseUID
  keeperId: string;
  duplicateId: string;
  collection: string;
  operation: string;
  detail: string;
  count?: number;
}

interface GroupSummary {
  firebaseUID: string;
  keeperId: string;
  duplicateIds: string[];
  status: "processed" | "skipped";
  error?: string;
  actions: MigrationAction[];
}

interface Summary {
  groupsFound: number;
  groupsProcessed: number;
  groupsSkipped: number;
  watchTimeMoved: number;
  enrollmentsMoved: number;
  enrollmentsDeleted: number;
  progressMoved: number;
  progressDeleted: number;
  quizAttemptsMoved: number;
  submissionResultsMoved: number;
  metricsMoved: number;
  metricsDeleted: number;
  slotBookingsMoved: number;
  projectSubmissionsMoved: number;
  usersDeleted: number;
}

async function findDuplicateGroups(db: Db): Promise<DuplicateGroup[]> {
  const usersCol = db.collection("users");

  const dupes = await usersCol
    .aggregate([
      { $match: { firebaseUID: { $ne: null, $exists: true } } },
      { $group: { _id: "$firebaseUID", userIds: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  const watchTimeCol = db.collection("watchTime");
  const groups: DuplicateGroup[] = [];

  for (const dupe of dupes) {
    const userIds: ObjectId[] = dupe.userIds;
    const counts: { id: ObjectId; count: number }[] = [];

    for (const uid of userIds) {
      const count = await watchTimeCol.countDocuments({ userId: uid });
      counts.push({ id: uid, count });
    }

    counts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.toHexString().localeCompare(b.id.toHexString());
    });

    const keeper = counts[0];
    const duplicates = counts.slice(1).map((c) => c.id.toHexString());

    groups.push({
      firebaseUID: dupe._id as string,
      keeperId: keeper.id.toHexString(),
      duplicateIds: duplicates,
      keeperWatchTimeCount: keeper.count,
    });
  }

  return groups;
}

async function migrateGroup(
  db: Db,
  group: DuplicateGroup,
  apply: boolean,
): Promise<{ actions: MigrationAction[]; counts: Partial<Summary> }> {
  const actions: MigrationAction[] = [];
  const counts: Partial<Summary> = {
    watchTimeMoved: 0,
    enrollmentsMoved: 0,
    enrollmentsDeleted: 0,
    progressMoved: 0,
    progressDeleted: 0,
    quizAttemptsMoved: 0,
    submissionResultsMoved: 0,
    metricsMoved: 0,
    metricsDeleted: 0,
    slotBookingsMoved: 0,
    projectSubmissionsMoved: 0,
    usersDeleted: 0,
  };

  const keeperOid = new ObjectId(group.keeperId);

  for (const dupId of group.duplicateIds) {
    const dupOid = new ObjectId(dupId);

    // 1. watchTime — updateMany userId to keeper
    {
      const col = db.collection("watchTime");
      const matched = await col.countDocuments({ userId: dupOid });
      if (matched > 0) {
        const action: MigrationAction = {
          group: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateId: dupId,
          collection: "watchTime",
          operation: "updateMany",
          detail: `reassign ${matched} watchTime records from ${dupId} to ${group.keeperId}`,
          count: matched,
        };
        actions.push(action);
        if (apply) {
          await col.updateMany({ userId: dupOid }, { $set: { userId: keeperOid } });
        }
        counts.watchTimeMoved! += matched;
      }
    }

    // 2. enrollment — move or delete
    {
      const col = db.collection("enrollment");
      const dupEnrollments = await col.find({ userId: dupOid }).toArray();
      for (const enrollment of dupEnrollments) {
        const courseId = enrollment.courseId;
        const courseVersionId = enrollment.courseVersionId;
        const cohortId = enrollment.cohortId ?? null;

        const keeperHas = await col.findOne({
          userId: keeperOid,
          courseId,
          courseVersionId,
          ...(cohortId ? { cohortId } : { $or: [{ cohortId: null }, { cohortId: { $exists: false } }] }),
        });

        if (keeperHas) {
          const action: MigrationAction = {
            group: group.firebaseUID,
            keeperId: group.keeperId,
            duplicateId: dupId,
            collection: "enrollment",
            operation: "delete",
            detail: `delete duplicate enrollment ${enrollment._id} (course ${courseId}, keeper already enrolled)`,
          };
          actions.push(action);
          if (apply) {
            await col.deleteOne({ _id: enrollment._id });
          }
          counts.enrollmentsDeleted! += 1;
        } else {
          const action: MigrationAction = {
            group: group.firebaseUID,
            keeperId: group.keeperId,
            duplicateId: dupId,
            collection: "enrollment",
            operation: "updateOne",
            detail: `move enrollment ${enrollment._id} (course ${courseId}) from ${dupId} to ${group.keeperId}`,
          };
          actions.push(action);
          if (apply) {
            await col.updateOne({ _id: enrollment._id }, { $set: { userId: keeperOid } });
          }
          counts.enrollmentsMoved! += 1;
        }
      }
    }

    // 3. progress — move or delete (same logic as enrollment)
    {
      const col = db.collection("progress");
      const dupProgress = await col.find({ userId: dupOid }).toArray();
      for (const prog of dupProgress) {
        const courseId = prog.courseId;
        const courseVersionId = prog.courseVersionId;

        const keeperHas = await col.findOne({
          userId: keeperOid,
          courseId,
          courseVersionId,
        });

        if (keeperHas) {
          const action: MigrationAction = {
            group: group.firebaseUID,
            keeperId: group.keeperId,
            duplicateId: dupId,
            collection: "progress",
            operation: "delete",
            detail: `delete duplicate progress ${prog._id} (course ${courseId}, keeper already has progress)`,
          };
          actions.push(action);
          if (apply) {
            await col.deleteOne({ _id: prog._id });
          }
          counts.progressDeleted! += 1;
        } else {
          const action: MigrationAction = {
            group: group.firebaseUID,
            keeperId: group.keeperId,
            duplicateId: dupId,
            collection: "progress",
            operation: "updateOne",
            detail: `move progress ${prog._id} (course ${courseId}) from ${dupId} to ${group.keeperId}`,
          };
          actions.push(action);
          if (apply) {
            await col.updateOne({ _id: prog._id }, { $set: { userId: keeperOid } });
          }
          counts.progressMoved! += 1;
        }
      }
    }

    // 4. quiz_attempts — updateMany userId to keeper
    {
      const col = db.collection("quiz_attempts");
      const matched = await col.countDocuments({ userId: { $in: [dupOid, dupId] } });
      if (matched > 0) {
        const action: MigrationAction = {
          group: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateId: dupId,
          collection: "quiz_attempts",
          operation: "updateMany",
          detail: `reassign ${matched} quiz attempts from ${dupId} to ${group.keeperId}`,
          count: matched,
        };
        actions.push(action);
        if (apply) {
          await col.updateMany(
            { userId: { $in: [dupOid, dupId] } },
            { $set: { userId: keeperOid } },
          );
        }
        counts.quizAttemptsMoved! += matched;
      }
    }

    // 5. quiz_submission_results — updateMany userId to keeper
    {
      const col = db.collection("quiz_submission_results");
      const matched = await col.countDocuments({ userId: { $in: [dupOid, dupId] } });
      if (matched > 0) {
        const action: MigrationAction = {
          group: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateId: dupId,
          collection: "quiz_submission_results",
          operation: "updateMany",
          detail: `reassign ${matched} submission results from ${dupId} to ${group.keeperId}`,
          count: matched,
        };
        actions.push(action);
        if (apply) {
          await col.updateMany(
            { userId: { $in: [dupOid, dupId] } },
            { $set: { userId: keeperOid } },
          );
        }
        counts.submissionResultsMoved! += matched;
      }
    }

    // 6. user_quiz_metrics — move or merge
    {
      const col = db.collection("user_quiz_metrics");
      const dupMetrics = await col.find({ userId: { $in: [dupOid, dupId] } }).toArray();
      for (const metric of dupMetrics) {
        const quizId = metric.quizId;

        // Check if keeper already has metrics for this quiz (match both ObjectId and string)
        const keeperMetric = await col.findOne({
          userId: { $in: [keeperOid, group.keeperId] },
          quizId: { $in: [quizId, typeof quizId === "string" ? new ObjectId(quizId) : quizId.toHexString()] },
        });

        if (keeperMetric) {
          const dupAttemptCount = Array.isArray(metric.attempts) ? metric.attempts.length : 0;
          const keeperAttemptCount = Array.isArray(keeperMetric.attempts) ? keeperMetric.attempts.length : 0;

          if (dupAttemptCount > keeperAttemptCount) {
            // Duplicate has more attempts — replace keeper's metrics with duplicate's
            const action: MigrationAction = {
              group: group.firebaseUID,
              keeperId: group.keeperId,
              duplicateId: dupId,
              collection: "user_quiz_metrics",
              operation: "replace",
              detail: `quiz ${quizId}: dup has ${dupAttemptCount} attempts vs keeper's ${keeperAttemptCount} — reassign dup metrics ${metric._id}, delete keeper metrics ${keeperMetric._id}`,
            };
            actions.push(action);
            if (apply) {
              await col.updateOne({ _id: metric._id }, { $set: { userId: keeperOid } });
              await col.deleteOne({ _id: keeperMetric._id });
            }
            counts.metricsMoved! += 1;
            counts.metricsDeleted! += 1;
          } else {
            // Keeper has equal or more — delete duplicate's metrics
            const action: MigrationAction = {
              group: group.firebaseUID,
              keeperId: group.keeperId,
              duplicateId: dupId,
              collection: "user_quiz_metrics",
              operation: "delete",
              detail: `quiz ${quizId}: keeper has ${keeperAttemptCount} attempts vs dup's ${dupAttemptCount} — delete dup metrics ${metric._id}`,
            };
            actions.push(action);
            if (apply) {
              await col.deleteOne({ _id: metric._id });
            }
            counts.metricsDeleted! += 1;
          }
        } else {
          const action: MigrationAction = {
            group: group.firebaseUID,
            keeperId: group.keeperId,
            duplicateId: dupId,
            collection: "user_quiz_metrics",
            operation: "updateOne",
            detail: `move metrics ${metric._id} (quiz ${quizId}) from ${dupId} to ${group.keeperId}`,
          };
          actions.push(action);
          if (apply) {
            await col.updateOne({ _id: metric._id }, { $set: { userId: keeperOid } });
          }
          counts.metricsMoved! += 1;
        }
      }
    }

    // 7. slotBookings — updateMany userId to keeper
    {
      const col = db.collection("slotBookings");
      const matched = await col.countDocuments({ userId: dupOid });
      if (matched > 0) {
        const action: MigrationAction = {
          group: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateId: dupId,
          collection: "slotBookings",
          operation: "updateMany",
          detail: `reassign ${matched} slot bookings from ${dupId} to ${group.keeperId}`,
          count: matched,
        };
        actions.push(action);
        if (apply) {
          await col.updateMany({ userId: dupOid }, { $set: { userId: keeperOid } });
        }
        counts.slotBookingsMoved! += matched;
      }
    }

    // 8. project_submissions — updateMany userId to keeper
    {
      const col = db.collection("project_submissions");
      const matched = await col.countDocuments({ userId: dupOid });
      if (matched > 0) {
        const action: MigrationAction = {
          group: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateId: dupId,
          collection: "project_submissions",
          operation: "updateMany",
          detail: `reassign ${matched} project submissions from ${dupId} to ${group.keeperId}`,
          count: matched,
        };
        actions.push(action);
        if (apply) {
          await col.updateMany({ userId: dupOid }, { $set: { userId: keeperOid } });
        }
        counts.projectSubmissionsMoved! += matched;
      }
    }

    // 9. Delete the duplicate user document
    {
      const action: MigrationAction = {
        group: group.firebaseUID,
        keeperId: group.keeperId,
        duplicateId: dupId,
        collection: "users",
        operation: "deleteOne",
        detail: `delete duplicate user ${dupId} (keeper: ${group.keeperId})`,
      };
      actions.push(action);
      if (apply) {
        await db.collection("users").deleteOne({ _id: dupOid });
      }
      counts.usersDeleted! += 1;
    }
  }

  return { actions, counts };
}

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (no writes)"}`);
    console.log(`DB: ${DB_NAME}\n`);

    console.log("Scanning for duplicate firebaseUID groups...");
    const groups = await findDuplicateGroups(db);
    console.log(`Found ${groups.length} duplicate group(s).\n`);

    if (groups.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    for (const g of groups) {
      console.log(
        `  firebaseUID: ${g.firebaseUID}` +
        `  keeper: ${g.keeperId} (${g.keeperWatchTimeCount} watchTime records)` +
        `  duplicates: [${g.duplicateIds.join(", ")}]`,
      );
    }
    console.log();

    // Snapshot before any writes — capture all users that will be affected.
    const allUserIds = groups.flatMap((g) => [g.keeperId, ...g.duplicateIds]);
    const usersSnapshot = await db
      .collection("users")
      .find({ _id: { $in: allUserIds.map((id) => new ObjectId(id)) } })
      .toArray();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const snapshotPath = path.join(
      process.cwd(),
      `cleanupDuplicateUsers.${APPLY ? "apply" : "dryrun"}.${stamp}.json`,
    );

    const summary: Summary = {
      groupsFound: groups.length,
      groupsProcessed: 0,
      groupsSkipped: 0,
      watchTimeMoved: 0,
      enrollmentsMoved: 0,
      enrollmentsDeleted: 0,
      progressMoved: 0,
      progressDeleted: 0,
      quizAttemptsMoved: 0,
      submissionResultsMoved: 0,
      metricsMoved: 0,
      metricsDeleted: 0,
      slotBookingsMoved: 0,
      projectSubmissionsMoved: 0,
      usersDeleted: 0,
    };

    const groupResults: GroupSummary[] = [];

    for (const group of groups) {
      console.log(`\nProcessing firebaseUID=${group.firebaseUID} ...`);
      try {
        const { actions, counts } = await migrateGroup(db, group, APPLY);

        for (const a of actions) {
          console.log(`  [${a.collection}] ${a.operation}: ${a.detail}`);
        }

        for (const key of Object.keys(counts) as (keyof Summary)[]) {
          (summary[key] as number) += (counts[key] as number) ?? 0;
        }
        summary.groupsProcessed += 1;

        groupResults.push({
          firebaseUID: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateIds: group.duplicateIds,
          status: "processed",
          actions,
        });
      } catch (err: any) {
        console.error(`  ERROR processing group ${group.firebaseUID}: ${err.message}`);
        summary.groupsSkipped += 1;

        groupResults.push({
          firebaseUID: group.firebaseUID,
          keeperId: group.keeperId,
          duplicateIds: group.duplicateIds,
          status: "skipped",
          error: err.message,
          actions: [],
        });
      }
    }

    // Write snapshot (includes pre-migration user docs and planned/executed actions).
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify(
        {
          apply: APPLY,
          timestamp: new Date().toISOString(),
          summary,
          groups: groupResults,
          usersSnapshot,
        },
        null,
        2,
      ),
    );
    console.log(`\nWrote snapshot -> ${snapshotPath}`);

    // Print summary.
    console.log(`\n=== SUMMARY ===`);
    console.log(`  Groups found        : ${summary.groupsFound}`);
    console.log(`  Groups processed    : ${summary.groupsProcessed}`);
    console.log(`  Groups skipped      : ${summary.groupsSkipped}`);
    console.log(`  watchTime moved     : ${summary.watchTimeMoved}`);
    console.log(`  enrollments moved   : ${summary.enrollmentsMoved}`);
    console.log(`  enrollments deleted : ${summary.enrollmentsDeleted}`);
    console.log(`  progress moved      : ${summary.progressMoved}`);
    console.log(`  progress deleted    : ${summary.progressDeleted}`);
    console.log(`  quiz attempts moved : ${summary.quizAttemptsMoved}`);
    console.log(`  submissions moved   : ${summary.submissionResultsMoved}`);
    console.log(`  metrics moved       : ${summary.metricsMoved}`);
    console.log(`  metrics deleted     : ${summary.metricsDeleted}`);
    console.log(`  slot bookings moved : ${summary.slotBookingsMoved}`);
    console.log(`  project subs moved  : ${summary.projectSubmissionsMoved}`);
    console.log(`  users deleted       : ${summary.usersDeleted}`);

    if (!APPLY) {
      console.log("\nDRY-RUN: no writes. Re-run with --apply to execute cleanup.");
    } else {
      console.log("\nAPPLY: all changes committed.");
    }
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
