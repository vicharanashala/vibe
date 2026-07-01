/**
 * Clear legacy enrollment.assignedTimeSlots so the booking system is the sole
 * source of truth for time-slot access. The access gate honors legacy assigned
 * slots as a transition fallback — leftover ones let a student in without a
 * fresh booking (e.g. the Jatish case). This retires them.
 *
 * READ-ONLY by default (dry run). Pass --apply to write.
 * Scope: by default only courses where time-slot booking is ACTIVE (where the
 * legacy slots actually grant access). Pass --all to clear on every course.
 *
 *   npx ts-node src/modules/users/scripts/clearLegacyAssignedTimeSlots.ts          # dry run, active courses
 *   npx ts-node src/modules/users/scripts/clearLegacyAssignedTimeSlots.ts --apply  # apply, active courses
 *   npx ts-node src/modules/users/scripts/clearLegacyAssignedTimeSlots.ts --all --apply
 */
import 'dotenv/config';
import {MongoClient, ObjectId} from 'mongodb';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const idIn = (id: any) => ({$in: [String(id), new ObjectId(String(id))]});

(async () => {
  const c = new MongoClient(process.env.DB_URL!);
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'vibe');
  console.log(`MODE: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (read-only)'} · SCOPE: ${ALL ? 'ALL courses' : 'time-slot ACTIVE courses only'}\n`);

  // Which course versions have time-slot booking active?
  const activeVersions = new Set<string>();
  const settings = await db.collection('courseSettings').find({}).toArray();
  for (const s of settings as any[]) {
    if (s?.settings?.timeslots?.isActive) {
      activeVersions.add(String(s.courseVersionId));
    }
  }

  // Enrollments still carrying legacy assignedTimeSlots.
  const enrs = await db
    .collection('enrollment')
    .find({assignedTimeSlots: {$exists: true, $ne: []}})
    .toArray();

  const targets: any[] = [];
  for (const e of enrs as any[]) {
    const vId = String(e.courseVersionId);
    const isActive = activeVersions.has(vId);
    if (!ALL && !isActive) continue; // out of scope
    const u = await db
      .collection('users')
      .findOne({_id: new ObjectId(String(e.userId))}, {projection: {email: 1, firstName: 1, lastName: 1}});
    targets.push({enrollmentId: e._id, vId, isActive, slots: e.assignedTimeSlots, email: u?.email});
  }

  console.log(`Enrollments with legacy assignedTimeSlots: ${enrs.length}`);
  console.log(`In scope to clear: ${targets.length}\n`);
  targets.forEach(t =>
    console.log(
      `  ${t.email ?? t.enrollmentId}  version=${t.vId}  active=${t.isActive}  slots=${JSON.stringify(t.slots)}`,
    ),
  );

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to clear these.`);
    await c.close();
    return;
  }

  let cleared = 0;
  for (const t of targets) {
    const res = await db
      .collection('enrollment')
      .updateOne(
        {_id: t.enrollmentId},
        {$set: {assignedTimeSlots: [], updatedAt: new Date()}},
      );
    cleared += res.modifiedCount;
  }
  console.log(`\nAPPLIED — cleared assignedTimeSlots on ${cleared} enrollment(s).`);
  await c.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
