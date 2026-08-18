/**
 * Repair slot bookings whose stored `hoursReserved` no longer matches their
 * window length — the fallout of a misconfigured slot (e.g. a window saved as
 * 08:00–22:00 = 14h that students booked thinking it was 20:00–22:00 = 2h).
 *
 * Once the instructor corrects the slot's from/to, existing bookings keep the
 * stale `hoursReserved` frozen at booking time, so the student's budget is still
 * over-charged AND the booking sits UNFULFILLED (nobody is active 90% of 14h),
 * which keeps the red "x hours wasted" warning up. This script re-derives
 * `hoursReserved` from the booking's CURRENT window and, for bookings that were
 * wrongly marked UNFULFILLED, restores credit (FULFILLED) since the misconfig
 * was not the student's fault.
 *
 * Detection is self-identifying: any non-cancelled booking where
 * round(windowHours(from,to)) !== round(hoursReserved) is a mismatch. Legit
 * bookings always match, so they are never touched.
 *
 * READ-ONLY by default (dry run). Pass --apply to write.
 * Optional scoping:
 *   --course=<courseId>          limit to one course
 *   --version=<courseVersionId>  limit to one course version
 *   --keep-status                only fix hoursReserved, leave status as-is
 *
 *   npx ts-node src/modules/users/scripts/resetMisreservedSlotBookings.ts
 *   npx ts-node src/modules/users/scripts/resetMisreservedSlotBookings.ts --apply
 *   npx ts-node src/modules/users/scripts/resetMisreservedSlotBookings.ts --course=<id> --apply
 */
import 'dotenv/config';
import {MongoClient, ObjectId} from 'mongodb';

const APPLY = process.argv.includes('--apply');
const KEEP_STATUS = process.argv.includes('--keep-status');
const arg = (k: string) =>
  process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const COURSE = arg('course');
const VERSION = arg('version');
const idIn = (id: string) => ({$in: [id, new ObjectId(id)]});

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
/** Window length in hours, mirroring SlotBookingService.slotHours (overnight wraps). */
const windowHours = (from: string, to: string) => {
  let minutes = toMinutes(to) - toMinutes(from);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

(async () => {
  const c = new MongoClient(process.env.DB_URL!);
  await c.connect();
  const db = c.db(process.env.DB_NAME || 'vibe');
  console.log(
    `MODE: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (read-only)'} · STATUS: ${
      KEEP_STATUS ? 'leave as-is' : 'UNFULFILLED→FULFILLED on repaired bookings'
    }${COURSE ? ` · course=${COURSE}` : ''}${VERSION ? ` · version=${VERSION}` : ''}\n`,
  );

  const q: any = {status: {$ne: 'CANCELLED'}, isDeleted: {$ne: true}};
  if (COURSE) q.courseId = idIn(COURSE);
  if (VERSION) q.courseVersionId = idIn(VERSION);

  const bookings = await db.collection('slotBookings').find(q).toArray();

  const targets: any[] = [];
  for (const b of bookings as any[]) {
    if (typeof b.from !== 'string' || typeof b.to !== 'string') continue;
    const expected = windowHours(b.from, b.to);
    const stored = round2(Number(b.hoursReserved));
    if (expected === stored) continue; // legit booking — untouched
    const u = await db
      .collection('users')
      .findOne(
        {_id: new ObjectId(String(b.userId))},
        {projection: {email: 1}},
      );
    targets.push({
      _id: b._id,
      email: u?.email,
      date: b.date,
      window: `${b.from}-${b.to}`,
      status: b.status,
      from: b.from,
      to: b.to,
      storedHours: stored,
      correctHours: expected,
      refund: round2(stored - expected),
    });
  }

  console.log(`Non-cancelled bookings scanned: ${bookings.length}`);
  console.log(`Mismatched (over/under-reserved): ${targets.length}\n`);
  let totalRefund = 0;
  for (const t of targets) {
    totalRefund += t.refund;
    console.log(
      `  ${t.email ?? t._id}  ${t.date} ${t.window}  ` +
        `hoursReserved ${t.storedHours}→${t.correctHours} (refund ${t.refund}h)  ` +
        `status=${t.status}${
          !KEEP_STATUS && t.status === 'UNFULFILLED' ? '→FULFILLED' : ''
        }`,
    );
  }
  console.log(`\nTotal hours to refund across bookings: ${round2(totalRefund)}h`);

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to repair these.`);
    await c.close();
    return;
  }

  let fixed = 0;
  for (const t of targets) {
    const set: any = {hoursReserved: t.correctHours, updatedAt: new Date()};
    if (!KEEP_STATUS && t.status === 'UNFULFILLED') {
      set.status = 'FULFILLED';
    }
    const res = await db
      .collection('slotBookings')
      .updateOne({_id: t._id}, {$set: set});
    fixed += res.modifiedCount;
  }
  console.log(`\nAPPLIED — repaired ${fixed} booking(s).`);
  await c.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
