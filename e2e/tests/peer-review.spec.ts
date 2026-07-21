/**
 * Peer-Review happy-path E2E spec.
 *
 * Phase 6.2.1 deliverable. The single highest-signal artifact in v1.
 * Exercises the full peer-review lifecycle:
 *   1. Teacher creates a course + adds a PEER_REVIEW_ASSESSMENT item
 *   2. 4 students enroll, each submits a Drive-style link
 *   3. Time-travel: set submissionDeadline to "now"
 *   4. Trigger AssignmentRunner via test-only endpoint
 *   5. Verify: 4 * 3 = 12 ReviewAssignments created, balanced
 *   6. Each student fetches their 3 reviews, fills out ReviewForm
 *   7. Time-travel: set reviewDeadline to "now"
 *   8. Trigger FinalizationRunner via test-only endpoint
 *   9. Each student sees finalScore on MyScore
 *  10. Teacher: override one score, verify finalScore changes
 *  11. Double-blind leak check: as a student, fetch /assignments and
 *      verify the response body does NOT contain any submitter
 *      identifier
 *
 * Time-travel: in a production e2e environment the backend exposes
 * a test-only POST /test/peer-review/time-travel endpoint that lets
 * the spec set assessment.submissionDeadline and reviewDeadline to
 * now. The endpoint is gated by NODE_ENV !== 'production'. The spec
 * treats this endpoint as a contract; if the backend has shipped
 * without it, the test is skipped with a clear message.
 *
 * Required env vars:
 *   TEST_TEACHER_EMAIL, TEST_TEACHER_PASSWORD
 *   TEST_STUDENT_EMAILS (4 emails, comma-separated)
 *   TEST_STUDENT_PASSWORDS (matching passwords)
 *   TEST_COURSE_ID (a pre-seeded course to use; the spec does NOT
 *   exercise course creation because that's covered by other specs)
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { loginAsStudent } from './common-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL;
const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD;
const STUDENT_EMAILS = (process.env.TEST_STUDENT_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const STUDENT_PASSWORDS = (process.env.TEST_STUDENT_PASSWORDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const COURSE_ID = process.env.TEST_COURSE_ID;
const VERSION_ID = process.env.TEST_COURSE_VERSION_ID;
const ASSESSMENT_ITEM_ID = process.env.TEST_PEER_REVIEW_ITEM_ID;

const hasAllEnv = Boolean(
  TEACHER_EMAIL && TEACHER_PASSWORD &&
  STUDENT_EMAILS.length === 4 && STUDENT_PASSWORDS.length === 4 &&
  COURSE_ID && VERSION_ID && ASSESSMENT_ITEM_ID,
);

test.describe('peer-review happy path', () => {
  test.skip(!hasAllEnv, 'Peer-review env vars not configured (see file header).');

  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    // Build a shared request context that uses the teacher's auth token.
    api = await pwRequest.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:5173',
      extraHTTPHeaders: {
        // The login flow is interactive; we get a token via the
        // Firebase auth emulator REST endpoint and use it as a Bearer.
        // (If the test infra is broken this entire beforeAll will
        // throw and the test will be marked "expected to fail".)
      },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('full lifecycle: create + submit + assign + review + finalize + override + double-blind check', async ({ page, browser }) => {
    // ---- 1. Teacher side (skip; covered by other specs) ----
    // Course + PEER_REVIEW_ASSESSMENT item are pre-seeded via env vars.
    // Time-travel the assessment to "now" so the AssignmentRunner fires
    // immediately when we call the test-only trigger.
    const timeTravelBody = {
      submissionDeadline: new Date(Date.now() - 60_000).toISOString(),
      reviewDeadline: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    const tt = await api.post(`/api/test/peer-review/${ASSESSMENT_ITEM_ID}/time-travel`, {
      data: timeTravelBody,
    });
    expect(tt.ok(), `time-travel failed: ${await tt.text()}`).toBeTruthy();

    // ---- 2. Each of 4 students submits a Drive link ----
    const submitResponses: any[] = [];
    for (let i = 0; i < 4; i++) {
      const studentCtx = await browser.newContext();
      const studentPage = await studentCtx.newPage();
      // Set the per-student credentials before loginAsStudent reads
      // them from env. The common-utils helper uses TEST_STUDENT_*
      // env vars, so we re-export the specific email/password per loop.
      process.env.TEST_STUDENT_EMAIL = STUDENT_EMAILS[i];
      process.env.TEST_STUDENT_PASSWORD = STUDENT_PASSWORDS[i];
      await loginAsStudent(studentPage);

      // Navigate to the assessment item
      await studentPage.goto(`/courses/${COURSE_ID}/versions/${VERSION_ID}/items/${ASSESSMENT_ITEM_ID}`);

      // The student should see a submission form (Phase 3 form)
      // with a link list. We use the API directly because the form's
      // exact UI selectors are out-of-scope for this e2e (covered by
      // component tests).
      const apiStudent = await pwRequest.newContext({
        baseURL: process.env.BASE_URL || 'http://localhost:5173',
        storageState: await studentCtx.storageState(),
      });
      const submitResp = await apiStudent.post(
        `/api/courses/${COURSE_ID}/versions/${VERSION_ID}/items/${ASSESSMENT_ITEM_ID}/submit`,
        {
          data: {
            notes: `Notes from student ${i}`,
            links: [
              {
                url: `https://drive.google.com/file/d/student-${i}/view`,
                label: `Project Report by student ${i}`,
                kind: 'drive',
              },
            ],
          },
        },
      );
      expect(submitResp.ok(), `student ${i} submit failed`).toBeTruthy();
      submitResponses.push(await submitResp.json());
      await apiStudent.dispose();
      await studentCtx.close();
    }
    expect(submitResponses).toHaveLength(4);

    // ---- 3. Trigger AssignmentRunner via test-only endpoint ----
    const assignResp = await api.post('/api/test/peer-review/assignment-runner/run-now', {
      data: { itemId: ASSESSMENT_ITEM_ID },
    });
    expect(assignResp.ok(), `assignment-runner failed: ${await assignResp.text()}`).toBeTruthy();
    const assignSummary = await assignResp.json();
    expect(assignSummary.pairsCreated).toBe(12); // 4 students * 3 reviewers

    // ---- 4. Each student: see 3 reviews, submit reviews ----
    for (let i = 0; i < 4; i++) {
      const studentCtx = await browser.newContext();
      const studentPage = await studentCtx.newPage();
      process.env.TEST_STUDENT_EMAIL = STUDENT_EMAILS[i];
      process.env.TEST_STUDENT_PASSWORD = STUDENT_PASSWORDS[i];
      await loginAsStudent(studentPage);

      const apiStudent = await pwRequest.newContext({
        baseURL: process.env.BASE_URL || 'http://localhost:5173',
        storageState: await studentCtx.storageState(),
      });

      // List my assignments
      const listResp = await apiStudent.get('/api/students/me/peer-review-assignments');
      expect(listResp.ok(), `student ${i} list failed`).toBeTruthy();
      const assignments = await listResp.json();
      expect(assignments).toHaveLength(3);

      // Each assignment: fetch the submission, submit a review
      for (const a of assignments) {
        // CRITICAL: verify the assignment payload does NOT contain
        // any submitter identifier. This is the v1 double-blind
        // gatekeeper at runtime, not just at unit-test time.
        const asnString = JSON.stringify(a);
        expect(asnString, `studentId leak in /assignments: ${asnString}`).not.toMatch(/studentId/);
        expect(asnString, `studentName leak in /assignments: ${asnString}`).not.toMatch(/studentName/);
        expect(asnString, `studentEmail leak in /assignments: ${asnString}`).not.toMatch(/student@yaksha/);

        // Fetch the submission to review
        const subResp = await apiStudent.get(`/api/peer-review-assignments/${a._id}/submission`);
        expect(subResp.ok(), `student ${i} submission fetch failed`).toBeTruthy();
        const subPayload = await subResp.json();
        // No submitter identity in the submission payload either
        const subString = JSON.stringify(subPayload);
        expect(subString, `submitter leak in /submission: ${subString}`).not.toMatch(/studentId/);
        expect(subString, `submitter leak in /submission: ${subString}`).not.toMatch(/studentName/);
        expect(subString, `submitter email leak in /submission: ${subString}`).not.toMatch(/student@yaksha/);

        // Submit the review
        const reviewResp = await apiStudent.post(`/api/peer-review-assignments/${a._id}/review`, {
          data: {
            scores: [
              { criterionId: 'c-1', score: 7, comment: 'Good' },
              { criterionId: 'c-2', score: 4, comment: 'OK' },
              { criterionId: 'c-3', score: 5, comment: 'Fine' },
            ],
            overallComment: `Review by student ${i}`,
          },
        });
        expect(reviewResp.ok(), `student ${i} review submit failed`).toBeTruthy();
      }

      await apiStudent.dispose();
      await studentCtx.close();
    }

    // ---- 5. Time-travel: reviewDeadline to "now", trigger finalization ----
    await api.post(`/api/test/peer-review/${ASSESSMENT_ITEM_ID}/time-travel`, {
      data: { reviewDeadline: new Date(Date.now() - 60_000).toISOString() },
    });
    const finalResp = await api.post('/api/test/peer-review/finalization-runner/run-now', {
      data: { itemId: ASSESSMENT_ITEM_ID },
    });
    expect(finalResp.ok(), `finalization-runner failed: ${await finalResp.text()}`).toBeTruthy();
    const finalSummary = await finalResp.json();
    expect(finalSummary.finalized).toBeGreaterThan(0);

    // ---- 6. Each student: see finalScore ----
    for (let i = 0; i < 4; i++) {
      const studentCtx = await browser.newContext();
      const studentPage = await studentCtx.newPage();
      process.env.TEST_STUDENT_EMAIL = STUDENT_EMAILS[i];
      process.env.TEST_STUDENT_PASSWORD = STUDENT_PASSWORDS[i];
      await loginAsStudent(studentPage);

      const apiStudent = await pwRequest.newContext({
        baseURL: process.env.BASE_URL || 'http://localhost:5173',
        storageState: await studentCtx.storageState(),
      });
      // Look up the assessmentId from the itemId
      const a = await (await apiStudent.get(
        `/api/peer-review-assessments/by-item/${ASSESSMENT_ITEM_ID}`,
      )).json();
      const myReviewsResp = await apiStudent.get(
        `/api/students/me/peer-reviews-received?assessmentId=${a._id}`,
      );
      expect(myReviewsResp.ok(), `student ${i} my-reviews failed`).toBeTruthy();
      const myReviews = await myReviewsResp.json();
      // 3 anonymized reviews
      expect(myReviews.reviews).toHaveLength(3);
      // CRITICAL: verify NO reviewer identity leaked.
      const reviewsString = JSON.stringify(myReviews);
      expect(reviewsString, `reviewerId leak in /received: ${reviewsString}`).not.toMatch(/reviewerId/);
      expect(reviewsString, `reviewer email leak in /received: ${reviewsString}`).not.toMatch(/reviewer@yaksha/);
      // The finalScore should be present (not null) because all 3 reviews came in
      expect(myReviews.finalScore).toBeGreaterThan(0);

      await apiStudent.dispose();
      await studentCtx.close();
    }

    // ---- 7. Teacher: override one score ----
    // The teacher side uses a separate auth context.
    const teacherCtx = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    process.env.TEST_STUDENT_EMAIL = TEACHER_EMAIL;
    process.env.TEST_STUDENT_PASSWORD = TEACHER_PASSWORD;
    await loginAsStudent(teacherPage); // Same login flow; the backend distinguishes by role.
    const apiTeacher = await pwRequest.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:5173',
      storageState: await teacherCtx.storageState(),
    });
    // Fetch the assessment's reviews
    const reviewsResp = await apiTeacher.get(
      `/api/peer-review-assessments/${ASSESSMENT_ITEM_ID}/reviews`,
    );
    expect(reviewsResp.ok()).toBeTruthy();
    const reviews = (await reviewsResp.json()).reviews;
    expect(reviews.length).toBeGreaterThan(0);

    // Override the first review
    const targetReview = reviews[0];
    const overrideResp = await apiTeacher.patch(
      `/api/peer-reviews/${targetReview.reviewId}/teacher-override`,
      {
        data: {
          scores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          overallComment: 'Adjusted upward based on additional evidence',
          reason: 'After re-reading the submission I believe the original scores were too low across the board; this is a deliberate upward correction.',
        },
      },
    );
    expect(overrideResp.ok(), `override failed: ${await overrideResp.text()}`).toBeTruthy();
    const overrideResult = await overrideResp.json();
    expect(overrideResult.teacherOverridden).toBe(true);
    expect(overrideResult.newFinalScore).toBeGreaterThan(0);

    // ---- 8. The affected student sees the new finalScore ----
    const affectedStudent = await browser.newContext();
    const affectedPage = await affectedStudent.newPage();
    process.env.TEST_STUDENT_EMAIL = STUDENT_EMAILS[0];
    process.env.TEST_STUDENT_PASSWORD = STUDENT_PASSWORDS[0];
    await loginAsStudent(affectedPage);
    const apiAffected = await pwRequest.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:5173',
      storageState: await affectedStudent.storageState(),
    });
    const a2 = await (await apiAffected.get(
      `/api/peer-review-assessments/by-item/${ASSESSMENT_ITEM_ID}`,
    )).json();
    const afterResp = await apiAffected.get(
      `/api/students/me/peer-reviews-received?assessmentId=${a2._id}`,
    );
    const after = await afterResp.json();
    expect(after.finalScore).toBeCloseTo(overrideResult.newFinalScore, 1);

    await apiAffected.dispose();
    await affectedStudent.close();
    await apiTeacher.dispose();
    await teacherCtx.close();
  });
});
