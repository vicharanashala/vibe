/**
 * One-off backfill of users whose firstName is blank. Many accounts were
 * auto-provisioned from Firebase without a `displayName` (email/password and
 * some SSO sign-ins), leaving firstName = "" (and often lastName = ""). Those
 * users render as "Unknown User" across enrollments, anomalies, flags, exports
 * and the leaderboard, and — because the signup validators enforce
 * /^[A-Za-z ]+$/ on firstName — they cannot save their profile until the name
 * is fixed.
 *
 * For each candidate we derive an alphabetic-only name from the email
 * local-part (the same rule the signup path now uses):
 *   "sghara200@gmail.com" -> firstName "sghara"
 *   "john.doe@x.com"      -> firstName "john doe"
 *
 * Degenerate derivations (< 2 alphabetic chars — e.g. "21f2000891" -> "f",
 * "123@x.com" -> "") carry no real name, so we SKIP them: the user is left
 * untouched (still renders as "Unknown User") rather than stamped with junk.
 * The live signup path can't skip (firstName is required) so it substitutes
 * "User" there instead — see deriveUserNames() in FirebaseAuthService.ts.
 *
 * Idempotent: only touches users whose firstName is missing/blank/whitespace —
 * never overwrites a real name. lastName is left untouched. Dry-run by default;
 * pass --apply to write.
 *
 * The derivation MUST stay in sync with `deriveUserNames` in
 * backend/src/modules/auth/services/FirebaseAuthService.ts. Self-contained raw
 * Mongo (the DI container can't be bootstrapped from a script).
 *
 * Usage:
 *   npx ts-node src/modules/users/scripts/backfillEmptyUserNames.ts            # dry-run
 *   npx ts-node src/modules/users/scripts/backfillEmptyUserNames.ts --apply    # write
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";

const MONGO_URI = process.env.DB_URL!;
const DB_NAME = process.env.DB_NAME || "vibe";
const APPLY = process.argv.includes("--apply");

/**
 * Mirror of deriveUserNames() in FirebaseAuthService.ts. Keep in sync.
 * Returns only the firstName here — the backfill never rewrites lastName.
 * Returns "" when the email yields fewer than 2 alphabetic chars; the caller
 * skips those (the signup path substitutes "User" instead, but the backfill
 * leaves degenerate accounts untouched).
 */
function deriveFirstName(
  rawFirstName: string | undefined | null,
  email: string | undefined | null,
): string {
  const sanitize = (s: string | undefined | null): string =>
    (s ?? "")
      .replace(/[^A-Za-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  let firstName = sanitize(rawFirstName);
  if (!firstName) firstName = sanitize((email ?? "").split("@")[0]);

  // Degenerate (e.g. "f" from a roll-number email) — signal "skip" to caller.
  return firstName.replace(/ /g, "").length < 2 ? "" : firstName;
}

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (no writes)"}`);
    console.log(`DB: ${DB_NAME}\n`);

    // Candidates: firstName missing, null, empty, or whitespace-only.
    const users = await db
      .collection("users")
      .find({
        $or: [
          { firstName: { $exists: false } },
          { firstName: null },
          { firstName: "" },
          { firstName: { $regex: /^\s+$/ } },
        ],
      })
      .project({ _id: 1, email: 1, firstName: 1, lastName: 1, firebaseUID: 1 })
      .toArray();

    console.log(`Users with blank firstName: ${users.length}`);
    if (users.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    const toUpdate: {
      _id: string;
      email: string;
      oldFirstName: string;
      newFirstName: string;
    }[] = [];
    const skipped: { _id: string; email: string }[] = [];

    for (const u of users) {
      const newFirstName = deriveFirstName(u.firstName, u.email);
      if (!newFirstName) {
        // Degenerate derivation — leave untouched (still "Unknown User").
        skipped.push({ _id: String(u._id), email: u.email ?? "" });
        continue;
      }
      toUpdate.push({
        _id: String(u._id),
        email: u.email ?? "",
        oldFirstName: u.firstName ?? "",
        newFirstName,
      });
    }

    console.log(`  will backfill        : ${toUpdate.length}`);
    console.log(`  skipped (degenerate) : ${skipped.length}`);
    toUpdate.slice(0, 20).forEach((t, i) =>
      console.log(
        `    ${String(i + 1).padStart(3)}. ${t.email.padEnd(32)} "${t.oldFirstName}" -> "${t.newFirstName}"`
      )
    );
    if (toUpdate.length > 20) console.log(`    …(+${toUpdate.length - 20} more)`);
    if (skipped.length) {
      console.log(`  skipped:`);
      skipped.forEach((s) => console.log(`    - ${s.email}`));
    }

    // Snapshot.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(
      process.cwd(),
      `backfillEmptyUserNames.${APPLY ? "apply" : "dryrun"}.${stamp}.json`
    );
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          apply: APPLY,
          totals: {
            candidates: users.length,
            willBackfill: toUpdate.length,
            skippedDegenerate: skipped.length,
          },
          toUpdate,
          skipped,
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

    // Apply.
    let updated = 0;
    for (const t of toUpdate) {
      const res = await db
        .collection("users")
        .updateOne(
          { _id: new ObjectId(t._id) },
          { $set: { firstName: t.newFirstName } }
        );
      updated += res.modifiedCount;
    }
    console.log(`\n✅ Backfilled firstName on ${updated} users.`);
  } finally {
    await client.close();
  }
}
run().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
