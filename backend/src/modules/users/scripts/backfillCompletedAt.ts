/**
 * One-off backfill of progress.completedAt for learners who reached 100% but
 * whose progress doc has no recorded finish date (legacy completions). Without
 * completedAt the leaderboard can't place them in the Finishers league, so they
 * leak into the "This Week" league shown as 100% complete.
 *
 * For each candidate we set:
 *   progress.completed   = true
 *   progress.completedAt = max(watchTime.endTime)   // when they finished the last item
 *
 * Idempotent: only fills docs that are MISSING completedAt — never overwrites an
 * existing finish date. Dry-run by default; pass --apply to write. Optionally
 * scope to one course version via positional args.
 *
 * Self-contained raw Mongo (the DI container can't be bootstrapped from a script).
 *
 * Usage:
 *   npx ts-node src/modules/users/scripts/backfillCompletedAt.ts                       # ALL versions, dry-run
 *   npx ts-node src/modules/users/scripts/backfillCompletedAt.ts --apply               # ALL versions, write
 *   npx ts-node src/modules/users/scripts/backfillCompletedAt.ts <courseId> <versionId> [--apply]
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";

const MONGO_URI = process.env.DB_URL!;
const DB_NAME = process.env.DB_NAME || "vibe";
const APPLY = process.argv.includes("--apply");
const THRESHOLD = 100; // matches the leaderboard's finisher rule (>= 100%)

// Build an $in that matches an id stored either as string or ObjectId.
const idVariants = (id: string) => {
  const out: any[] = [String(id)];
  try {
    out.push(new ObjectId(String(id)));
  } catch {
    /* not a valid ObjectId — string form only */
  }
  return out;
};
const key = (userId: any, versionId: any) => `${String(userId)}|${String(versionId)}`;

async function run() {
  const pos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const scopeCourseId = pos[0];
  const scopeVersionId = pos[1];

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (no writes)"}`);
    console.log(`DB: ${DB_NAME}`);
    console.log(
      scopeVersionId
        ? `Scope: course ${scopeCourseId} / version ${scopeVersionId}\n`
        : `Scope: ALL course versions\n`
    );

    const versionFilter = scopeVersionId
      ? { courseVersionId: { $in: idVariants(scopeVersionId) } as any }
      : {};

    // 1. Candidates: active STUDENT enrollments at >= 100%.
    const enrollments = await db
      .collection("enrollment")
      .find({
        ...versionFilter,
        role: "STUDENT",
        status: { $regex: /^active$/i },
        isDeleted: { $ne: true },
        percentCompleted: { $gte: THRESHOLD },
      })
      .project({ userId: 1, courseId: 1, courseVersionId: 1 })
      .toArray();

    const candidateKeys = new Set(
      enrollments.map((e: any) => key(e.userId, e.courseVersionId))
    );
    console.log(`100% enrollments: ${enrollments.length}`);

    if (enrollments.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    // 2. Their progress docs that are MISSING a completedAt.
    const progressDocs = await db
      .collection("progress")
      .find({
        ...versionFilter,
        $or: [{ completedAt: { $exists: false } }, { completedAt: null }],
      })
      .project({ userId: 1, courseId: 1, courseVersionId: 1, completed: 1, completedAt: 1 })
      .toArray();

    const needFix = progressDocs.filter((p: any) =>
      candidateKeys.has(key(p.userId, p.courseVersionId))
    );
    console.log(`Progress docs missing completedAt (and 100%): ${needFix.length}`);

    if (needFix.length === 0) {
      console.log("All caught up — nothing to backfill.");
      return;
    }

    // 3. Last watchTime.endTime per (user, version) — the finish moment.
    const userIds = [...new Set(needFix.map((p: any) => String(p.userId)))];
    const versionIds = [...new Set(needFix.map((p: any) => String(p.courseVersionId)))];
    const lastEnd = await db
      .collection("watchTime")
      .aggregate([
        {
          $match: {
            userId: { $in: userIds.flatMap(idVariants) },
            courseVersionId: { $in: versionIds.flatMap(idVariants) },
            isDeleted: { $ne: true },
            endTime: { $ne: null, $exists: true },
          },
        },
        {
          $group: {
            _id: { userId: "$userId", courseVersionId: "$courseVersionId" },
            lastEndTime: { $max: "$endTime" },
          },
        },
      ])
      .toArray();

    const lastEndByKey = new Map<string, Date>();
    for (const row of lastEnd) {
      lastEndByKey.set(key(row._id.userId, row._id.courseVersionId), row.lastEndTime);
    }

    // 4. Resolve each doc to a completedAt.
    const toUpdate: {
      _id: string;
      userId: string;
      courseVersionId: string;
      completedAt: string;
    }[] = [];
    const unresolved: { userId: string; courseVersionId: string }[] = [];

    for (const p of needFix) {
      const k = key(p.userId, p.courseVersionId);
      const end = lastEndByKey.get(k);
      if (!end) {
        unresolved.push({ userId: String(p.userId), courseVersionId: String(p.courseVersionId) });
        continue;
      }
      toUpdate.push({
        _id: String(p._id),
        userId: String(p.userId),
        courseVersionId: String(p.courseVersionId),
        completedAt: new Date(end).toISOString(),
      });
    }

    console.log(`  resolvable (have watchTime) : ${toUpdate.length}`);
    console.log(`  unresolved (no watchTime)   : ${unresolved.length}`);
    toUpdate.slice(0, 15).forEach((t, i) =>
      console.log(`    ${String(i + 1).padStart(3)}. progress ${t._id} → ${t.completedAt}`)
    );
    if (toUpdate.length > 15) console.log(`    …(+${toUpdate.length - 15} more)`);

    // 5. Snapshot.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(
      process.cwd(),
      `backfillCompletedAt.${APPLY ? "apply" : "dryrun"}.${stamp}.json`
    );
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          apply: APPLY,
          scope: scopeVersionId ? { scopeCourseId, scopeVersionId } : "ALL",
          threshold: THRESHOLD,
          totals: {
            enrollments100: enrollments.length,
            needFix: needFix.length,
            resolvable: toUpdate.length,
            unresolved: unresolved.length,
          },
          toUpdate,
          unresolved,
        },
        null,
        2
      )
    );
    console.log(`\nWrote snapshot → ${outPath}`);

    if (!APPLY) {
      console.log("\nDRY-RUN: no writes. Re-run with --apply to backfill.");
      return;
    }

    // 6. Apply.
    let updated = 0;
    for (const t of toUpdate) {
      const res = await db.collection("progress").updateOne(
        { _id: new ObjectId(t._id) },
        { $set: { completed: true, completedAt: new Date(t.completedAt) } }
      );
      updated += res.modifiedCount;
    }
    console.log(`\n✅ Backfilled completedAt on ${updated} progress docs.`);
  } finally {
    await client.close();
  }
}
run().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
