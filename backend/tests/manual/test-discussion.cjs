/**
 * Manual smoke harness for the Cohort Discussion Board demo.
 *
 * Lives under `tests/manual/` (not `tests/`) because:
 *   1. it requires a *live* backend + MongoDB + Firebase Auth emulator
 *      stack to run, which the standard vitest suite doesn't spin up;
 *   2. it's a debugging aid, not a CI regression test;
 *   3. running it against an unset demo stack will simply print a
 *      connection error rather than silently passing.
 *
 * The script auto-discovers the latest seeded demo course from MongoDB
 * by name ("Milestone E Discussion Demo Course"), so it doesn't drift
 * out of sync after each seed re-run.
 *
 * Usage (assumes the demo stack is already up — see the seed script
 * README):
 *
 *   DB_URL=mongodb://127.0.0.1:27018/vibe?replicaSet=rs0 \
 *     node tests/manual/test-discussion.cjs
 *
 * Exit code 0 means the smoke run finished (not that anything passed);
 * the operator reads the printed per-persona `body:` to confirm
 * cohort isolation. A connection / auth error prints and exits non-zero.
 */
"use strict";

require("dotenv").config();

const { MongoClient } = require("mongodb");

const DB_URL = process.env.DB_URL || "mongodb://127.0.0.1:27018/vibe";
const DB_NAME = process.env.DB_NAME || "vibe";
const BACKEND_BASE = process.env.BACKEND_BASE || "http://localhost:3141/api";
const EMULATOR_BASE =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const EMULATOR_API_KEY =
  process.env.EMULATOR_API_KEY ||
  "AIzaSyCfnTPb50ixe_SRMzzeV8dCAQEdBRNmpXk";
const COURSE_NAME = "Milestone E Discussion Demo Course";

async function login(email, password) {
  const r = await fetch(
    `http://${EMULATOR_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${EMULATOR_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const j = await r.json();
  if (!j.idToken) {
    throw new Error(`login failed for ${email}: ${JSON.stringify(j)}`);
  }
  return j.idToken;
}

async function listDiscussions(courseId, token) {
  const r = await fetch(`${BACKEND_BASE}/course/${courseId}/discussions`, {
    headers: { Authorization: "Bearer " + token },
  });
  return { status: r.status, body: await r.text() };
}

async function resolveCourseId() {
  const mongo = new MongoClient(DB_URL);
  await mongo.connect();
  try {
    const doc = await mongo
      .db(DB_NAME)
      .collection("newCourse")
      .findOne(
        { name: COURSE_NAME },
        { sort: { _id: -1 } }, // latest by insertion order
      );
    if (!doc) {
      throw new Error(
        `no course named "${COURSE_NAME}" in ${DB_NAME} (db ${DB_URL}). ` +
          `Did you run scripts/seed-discussion-demo.cjs?`,
      );
    }
    return doc._id.toString();
  } finally {
    await mongo.close();
  }
}

(async () => {
  const courseId = await resolveCourseId();
  console.log(`[smoke] using courseId=${courseId}`);

  const personas = [
    { label: "Teacher",     email: "teacher.discussion@demo.test", password: "DemoTeacherPass123!" },
    { label: "Student A",   email: "studenta.discussion@demo.test", password: "DemoStudentPass123!" },
    { label: "Student B",   email: "studentb.discussion@demo.test", password: "DemoStudentPass123!" },
  ];

  for (const p of personas) {
    const token = await login(p.email, p.password);
    const r = await listDiscussions(courseId, token);
    console.log(`--- ${p.label} (${p.email}) ---`);
    console.log("status:", r.status);
    let arr=[]; try { arr = JSON.parse(r.body); } catch (e) { console.log("body (non-JSON):", r.body.substring(0, 400)); continue; } console.log("count:", Array.isArray(arr) ? arr.length : "(not an array)"); if (Array.isArray(arr)) { arr.forEach(t => { const cid = String(t.cohortId || "").slice(-8); console.log("  cohort=" + cid + " pinned=" + t.pinned + " title=" + t.title); }); }
  }
})().catch(err => {
  console.error("[smoke] failed:", err && err.message ? err.message : err);
  process.exit(1);
});
