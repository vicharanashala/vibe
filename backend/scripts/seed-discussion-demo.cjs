/**
 * Milestone E demo seeding script — populates the local MongoDB and the
 * local Firebase Auth emulator with deterministic accounts for the
 * Discussion Board end-to-end walkthrough.
 *
 * SAFETY: This script is opt-in via `--confirm-demo` (or the
 * `DEMO_SEED_CONFIRMED` env var). Without it, the script refuses to run.
 * It also asserts the Mongo target resolves to `127.0.0.1` / `localhost`
 * — a non-local target (e.g. the Atlas cluster) is rejected so an
 * accidental `DB_URL` override can't write demo rows to production.
 *
 * Usage:
 *   node scripts/seed-discussion-demo.cjs --confirm-demo
 *   DEMO_SEED_CONFIRMED=1 node scripts/seed-discussion-demo.cjs
 *
 *   # to point at a non-default local stack:
 *   DB_URL=mongodb://127.0.0.1:27018/vibe?replicaSet=rs0 node \
 *       scripts/seed-discussion-demo.cjs --confirm-demo
 *
 * The script is idempotent: rerunning tears down the previously-seeded
 * demo course (matched by course name) and recreates it from scratch.
 */

"use strict";

require("dotenv").config();

const admin = require("firebase-admin");
const { MongoClient, ObjectId } = require("mongodb");

// --- Safety gate ----------------------------------------------------
const argv = process.argv.slice(2);
const hasConfirmFlag =
  argv.includes("--confirm-demo") || argv.includes("--yes");
const hasEnvConfirm = process.env.DEMO_SEED_CONFIRMED === "1";
if (!hasConfirmFlag && !hasEnvConfirm) {
  console.error(
    "\n[seed-discussion-demo] Refusing to run without explicit confirmation.\n" +
      "Pass --confirm-demo (or set DEMO_SEED_CONFIRMED=1) after you've\n" +
      "verified DB_URL points at a local emulator DB, not production.\n",
  );
  process.exit(2);
}

const DB_URL = process.env.DB_URL || "mongodb://127.0.0.1:27018/vibe";
const DB_NAME = process.env.DB_NAME || "vibe";
const FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-test";

// Hard guard: only allow localhost / 127.0.0.1 targets. This catches
// accidental DB_URL overrides that point at the real Atlas cluster.
// Override with DEMO_SEED_ALLOW_REMOTE=1 only if you really know what
// you're doing (e.g. a one-off demo against a throwaway cluster).
if (process.env.DEMO_SEED_ALLOW_REMOTE !== "1") {
  const u = (() => {
    try {
      return new URL(DB_URL);
    } catch {
      return null;
    }
  })();
  const host = u ? u.hostname : "";
  const isLocal =
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "";
  if (!isLocal) {
    console.error(
      `\n[seed-discussion-demo] Refusing to write to non-local target: ${host}\n` +
        `DB_URL=${DB_URL}\n` +
        "Set DEMO_SEED_ALLOW_REMOTE=1 to override this guard.\n",
    );
    process.exit(3);
  }
}

const PERSONAS = [
  {
    key: "teacher",
    email: "teacher.discussion@demo.test",
    password: "DemoTeacherPass123!",
    firstName: "Demo",
    lastName: "Teacher",
    role: "INSTRUCTOR",
    firebaseUid: "demo-teacher-uid-0001",
  },
  {
    key: "studentA",
    email: "studenta.discussion@demo.test",
    password: "DemoStudentPass123!",
    firstName: "Demo",
    lastName: "StudentA",
    role: "STUDENT",
    firebaseUid: "demo-studentA-uid-0001",
  },
  {
    key: "studentB",
    email: "studentb.discussion@demo.test",
    password: "DemoStudentPass123!",
    firstName: "Demo",
    lastName: "StudentB",
    role: "STUDENT",
    firebaseUid: "demo-studentB-uid-0001",
  },
];

const COURSE_NAME = "Milestone E Discussion Demo Course";
const DEMO_VERSION = "1.0";
const COHORT_A_NAME = "Cohort A";
const COHORT_B_NAME = "Cohort B";

const TEACHER = PERSONAS.find((p) => p.key === "teacher");
const STUDENT_A = PERSONAS.find((p) => p.key === "studentA");
const STUDENT_B = PERSONAS.find((p) => p.key === "studentB");

function now() {
  return new Date();
}

async function upsertAuthUser(auth, persona) {
  try {
    await auth.getUser(persona.firebaseUid);
    // Already exists — leave it (UID is the join key on the Mongo side).
    return;
  } catch (e) {
    if (e && e.code !== "auth/user-not-found") throw e;
  }
  await auth.createUser({
    uid: persona.firebaseUid,
    email: persona.email,
    password: persona.password,
    displayName: `${persona.firstName} ${persona.lastName}`.trim(),
    emailVerified: true,
  });
}

async function main() {
  // The Firebase Admin SDK auto-detects FIREBASE_AUTH_EMULATOR_HOST and
  // routes there; we still need a fake projectId for initialisation
  // because the Admin SDK refuses to initialise without one.
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const auth = admin.auth();

  console.log(
    `→ Connecting to Firebase Auth emulator at ${FIREBASE_AUTH_EMULATOR_HOST} (project=${PROJECT_ID})`,
  );

  for (const persona of PERSONAS) {
    await upsertAuthUser(auth, persona);
    console.log(`  ✓ Auth user: ${persona.email} (uid=${persona.firebaseUid})`);
  }

  console.log(`→ Connecting to MongoDB at ${DB_URL}`);
  const mongo = new MongoClient(DB_URL);
  await mongo.connect();
  const db = mongo.db(DB_NAME);

  try {
    const usersCol = db.collection("users");
    // The live backend uses singular collection names for these:
    //   newCourse, newCourseVersion, enrollment.
    // Pluralising them (as the test suites do with vitest-mongodb)
    // would silently miss every lookup, which is why a
    // correctly-seeded enrollment row was invisible to AbilityDecorator.
    const coursesCol = db.collection("newCourse");
    const versionsCol = db.collection("newCourseVersion");
    const cohortsCol = db.collection("cohorts");
    const enrollmentsCol = db.collection("enrollment");
    const threadsCol = db.collection("discussion_threads");
    const repliesCol = db.collection("discussion_replies");

    // ── 1. Tear down any previous instance of the demo course so the
    //    seed is idempotent across re-runs. ──────────────────────────
    const prevCourse = await coursesCol.findOne({ name: COURSE_NAME });
    if (prevCourse) {
      const prevId = prevCourse._id;
      const prevVersions = await versionsCol
        .find({ courseId: new ObjectId(prevId) })
        .toArray();
      const prevVersionIds = prevVersions.map((v) => v._id);
      await threadsCol.deleteMany({ courseId: prevId });
      await enrollmentsCol.deleteMany({ courseId: prevId });
      await cohortsCol.deleteMany({
        courseVersionId: { $in: prevVersionIds },
      });
      await versionsCol.deleteMany({ courseId: prevId });
      await coursesCol.deleteOne({ _id: prevId });
      console.log(
        `  ✓ Removed previous demo course (id=${prevId.toHexString()}, versions=${prevVersionIds.length})`,
      );
    }

    // ── 2. Wipe any leftover demo-only users (matched by demo.test email).
    //    Other users in the DB are kept untouched. ───────────────────
    for (const persona of PERSONAS) {
      const res = await usersCol.deleteMany({ email: persona.email });
      if (res.deletedCount > 0) {
        console.log(`  ✓ Cleared old mongo user for ${persona.email}`);
      }
    }

    // ── 3. Insert the three personas.
    //    We mimic exactly the shape signup would produce (so the
    //    AbilityDecorator's role-normalisation step accepts them). ──
    const teacherId = new ObjectId();
    const studentAId = new ObjectId();
    const studentBId = new ObjectId();
    await usersCol.insertMany([
      {
        _id: teacherId,
        firebaseUID: TEACHER.firebaseUid,
        email: TEACHER.email,
        firstName: TEACHER.firstName,
        lastName: TEACHER.lastName,
        roles: TEACHER.role.toLowerCase(),
        role: TEACHER.role,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: studentAId,
        firebaseUID: STUDENT_A.firebaseUid,
        email: STUDENT_A.email,
        firstName: STUDENT_A.firstName,
        lastName: STUDENT_A.lastName,
        roles: STUDENT_A.role.toLowerCase(),
        role: STUDENT_A.role,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: studentBId,
        firebaseUID: STUDENT_B.firebaseUid,
        email: STUDENT_B.email,
        firstName: STUDENT_B.firstName,
        lastName: STUDENT_B.lastName,
        roles: STUDENT_B.role.toLowerCase(),
        role: STUDENT_B.role,
        createdAt: now(),
        updatedAt: now(),
      },
    ]);
    console.log("  ✓ Inserted 3 users");

    // ── 4. Course + version + cohorts (2 cohorts).
    //    The course collection uses an `instructors` array on the
    //    existing code-path, so the teacher goes in there. Both
    //    cohorts live on the version's cohort list; both enrollments
    //    reference their own cohort id separately so the discussion
    //    Ability filter is per-cohort. ───────────────────────────────
    const courseId = new ObjectId();
    await coursesCol.insertOne({
      _id: courseId,
      name: COURSE_NAME,
      description:
        "Seed course for the Milestone E Cohort Discussion Board demo.",
      versions: [],
      instructors: [teacherId],
      createdBy: teacherId,
      createdAt: now(),
      updatedAt: now(),
    });

    const versionId = new ObjectId();
    const cohortAId = new ObjectId();
    const cohortBId = new ObjectId();

    await versionsCol.insertOne({
      _id: versionId,
      courseId,
      version: DEMO_VERSION,
      description: "Demo version",
      versionStatus: "active",
      modules: [],
      cohorts: [COHORT_A_NAME, COHORT_B_NAME],
      createdAt: now(),
      updatedAt: now(),
    });

    await cohortsCol.insertMany([
      {
        _id: cohortAId,
        courseId,
        courseVersionId: versionId,
        name: COHORT_A_NAME,
        studentCount: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: cohortBId,
        courseId,
        courseVersionId: versionId,
        name: COHORT_B_NAME,
        studentCount: 0,
        createdAt: now(),
        updatedAt: now(),
      },
    ]);

    await coursesCol.updateOne(
      { _id: courseId },
      {
        $set: {
          versions: [versionId],
          cohorts: [cohortAId, cohortBId],
          updatedAt: now(),
        },
      },
    );

    console.log(
      `  ✓ Created course ${courseId.toHexString()} / version ${versionId.toHexString()}`,
    );
    console.log(
      `    cohortA=${cohortAId.toHexString()}, cohortB=${cohortBId.toHexString()}`,
    );

    // ── 5. Enrollments. The discussion board's ability layer
    //    (EnrollmentService.getAllEnrollments) reads
    //      enrollment.role, enrollment.status, enrollment.cohortId,
    //      enrollment.courseId, enrollment.courseVersionId
    //    so we populate those fields exactly. ────────────────────────
    await enrollmentsCol.insertMany([
      {
        _id: new ObjectId(),
        userId: studentAId,
        courseId,
        courseVersionId: versionId,
        role: "STUDENT",
        status: "ACTIVE",
        cohortId: cohortAId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: new ObjectId(),
        userId: studentBId,
        courseId,
        courseVersionId: versionId,
        role: "STUDENT",
        status: "ACTIVE",
        cohortId: cohortBId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: new ObjectId(),
        userId: teacherId,
        courseId,
        courseVersionId: versionId,
        role: "INSTRUCTOR",
        status: "ACTIVE",
        cohortId: cohortAId,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        _id: new ObjectId(),
        userId: teacherId,
        courseId,
        courseVersionId: versionId,
        role: "INSTRUCTOR",
        status: "ACTIVE",
        cohortId: cohortBId,
        createdAt: now(),
        updatedAt: now(),
      },
    ]);
    console.log("  ✓ Inserted 4 enrollments (2 students + 2 teacher-in-cohort)");

    // ── 6. Pre-existing threads. Two threads per cohort, all
    //    authored by the teacher. Each cohort contains:
    //      a) one PINNED announcement (so cohort isolation tests
    //         have pinned + unpinned variants to compare)
    //      b) one standard discussion thread with a teacher reply
    //    Cohort A threads are visible only to Student A; Cohort B
    //    threads only to Student B. The teacher sees both.
    const seededThreadIds = [];
    for (const cohortSpec of [
        {
            cohortId: cohortAId,
            cohortName: COHORT_A_NAME,
            announcements: [
                {
                    title: "[Cohort A] Course kickoff and cohort calendar",
                    body:
                        "Welcome to Cohort A! This is the pinned announcement thread for our cohort. " +
                        "Only Cohort A students will see this. Cohort B has its own kickoff post.",
                    pinned: true,
                },
                {
                    title: "[Cohort A] Office hours this Friday",
                    body:
                        "Cohort A: drop your questions here ahead of Friday office hours and I will " +
                        "triage them at the start of the session.",
                    pinned: false,
                },
            ],
        },
        {
            cohortId: cohortBId,
            cohortName: COHORT_B_NAME,
            announcements: [
                {
                    title: "[Cohort B] Course kickoff and cohort calendar",
                    body:
                        "Welcome to Cohort B! This is the pinned announcement thread for our cohort. " +
                        "Only Cohort B students will see this. Cohort A has its own kickoff post.",
                    pinned: true,
                },
                {
                    title: "[Cohort B] Office hours this Friday",
                    body:
                        "Cohort B: drop your questions here ahead of Friday office hours and I will " +
                        "triage them at the start of the session.",
                    pinned: false,
                },
            ],
        },
    ]) {
        for (const ann of cohortSpec.announcements) {
            const tid = new ObjectId();
            seededThreadIds.push(tid.toHexString());
            await threadsCol.insertOne({
                _id: tid,
                courseId,
                cohortId: cohortSpec.cohortId,
                authorId: teacherId,
                authorFirebaseUid: TEACHER.firebaseUid,
                title: ann.title,
                body: ann.body,
                pinned: ann.pinned,
                createdAt: now(),
                updatedAt: now(),
            });
            await repliesCol.insertOne({
                _id: new ObjectId(),
                threadId: tid,
                authorId: teacherId,
                authorFirebaseUid: TEACHER.firebaseUid,
                body:
                    "First reply on this " + cohortSpec.cohortName + " thread — students in this cohort should be able to reply.",
                createdAt: now(),
                updatedAt: now(),
            });
        }
    }

    console.log(
        "  ✓ Seeded " + seededThreadIds.length + " threads (2 per cohort, each with 1 teacher reply)",
    );


    console.log("\nDone. Demo personas (email / password):");
    for (const p of PERSONAS) {
      console.log(`  • ${p.email}  /  ${p.password}  (${p.role})`);
    }
    console.log(
      `\nCourse URL slug (use in the UI): /teacher/courses/${courseId.toHexString()}`,
    );
    console.log(
      `Student open URL:        /student/courses/${courseId.toHexString()}/discussions`,
    );
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
