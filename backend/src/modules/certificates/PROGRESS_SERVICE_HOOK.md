# Wiring certificates into ProgressService

This is the one place you touch existing code. Everything else in this
module is new, additive files.

**File:** `backend/src/modules/users/services/ProgressService.ts`
**Method:** `updateEnrollmentProgressPercentBulk`

## Why here

This method is the single place that writes `percentCompleted` onto an
enrollment (via a Mongo bulk `updateOne`). Rather than hooking into every
place that *might* complete an item (video watched, quiz passed, project
approved), we react to the one method that already aggregates all of that
into a single percentage.

## Why lazy container resolution, not constructor injection

`ProgressService` lives in the `users` module. Adding a constructor
dependency on `CertificateService` (which lives in a new `certificates`
module) would mean the `users` module's container needs the `certificates`
module loaded first — modules are loaded in directory-read order, so this
creates a fragile load-order dependency.

The codebase already solves this exact problem for `InviteService` (see
line ~2689 of the same file):

```ts
const inviteService = getContainer().get<InviteService>(
  NOTIFICATIONS_TYPES.InviteService,
);
```

We do the same for `CertificateService`.

## Import additions (top of file)

```ts
import { CERTIFICATE_TYPES } from '#root/modules/certificates/types.js';
import type { CertificateService } from '#root/modules/certificates/services/CertificateService.js';
```

## The change

Inside `updateEnrollmentProgressPercentBulk`, the `bulkOps` map already
computes `percentCompleted` per enrollment. Add a fire-and-forget branch
right after that computation, before the `return { updateOne: ... }`:

```ts
        // Fire-and-forget certificate issuance. Deliberately not awaited —
        // issuing a certificate should never slow down or fail the progress
        // update itself. issueIfNotExists() is idempotent, so it's safe even
        // if this bulk method is called again for an already-completed
        // enrollment (e.g. a retried job, or watching an optional item after
        // finishing the course).
        if (percentCompleted >= 100) {
          this.issueCertificateIfCompleted(userId, courseId, versionId).catch(
            err => {
              // Swallow + log only. A failed certificate issuance is a
              // support ticket, not a reason to fail the student's progress
              // update.
              console.error('Certificate issuance failed:', err);
            },
          );
        }
```

And add this small private helper method (near `_calculateProgress`):

```ts
  private async issueCertificateIfCompleted(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    const [user, course] = await Promise.all([
      this.userRepo.findById(userId),
      this.courseRepo.read(courseId),
    ]);
    if (!user || !course) return;

    const certificateService = getContainer().get<CertificateService>(
      CERTIFICATE_TYPES.CertificateService,
    );

    await certificateService.issueIfNotExists({
      userId,
      courseId,
      courseVersionId,
      studentName: `${user.firstName} ${user.lastName}`.trim(),
      courseName: course.name,
    });
  }
```

(Adjust `user.firstName`/`lastName`/`course.name` field names if they differ
slightly from the actual `IUser`/`ICourse` interfaces — I inferred these
from usage elsewhere in the file; double-check against
`shared/interfaces/models.ts` before committing.)

## What NOT to do

Don't await `issueCertificateIfCompleted` inline in the main `bulkOps.map`
— that would turn a bulk progress update (potentially many students) into
one that blocks on PDF-adjacent DB writes per student. Keep it detached.
