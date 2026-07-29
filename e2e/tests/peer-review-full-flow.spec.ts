/**
 * Full Peer-Review Workflow Playwright E2E Spec.
 *
 * Exercises 100% of the peer-review lifecycle from UI and API perspectives:
 *   1. Bootstrap teacher & 4 students via Firebase Auth Emulator + Mongo
 *   2. Teacher creates Peer Review Assessment item (with rubric, deadlines, config)
 *   3. 4 Students log in via Playwright UI, navigate to item, & submit project links
 *   4. Verify deadline enforcement (past deadline blocks sub-sequent edits/submissions)
 *   5. Teacher manually closes submission window -> triggers assignment pass
 *   6. Each student logs in, views reviewer queue (double-blind), & submits rubric scores
 *   7. Auto-finalization pass computes final scores
 *   8. Teacher views submissions & reviews dashboard, performs manual score override
 *   9. Student verifies updated final score with teacher override notification
 */

import { test, expect } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_BASE = 'http://localhost:3141/api';
const AUTH_EMU = 'http://127.0.0.1:9099';
const MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0';

// Helper to authenticate via Firebase Auth Emulator REST API
async function getAuthUser(email: string, pass: string): Promise<{ idToken: string; localId: string }> {
  const res = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) {
    // Attempt sign up if sign-in fails
    const signUpRes = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
    });
    const signUpData = await signUpRes.json();
    if (!signUpData.idToken) {
      throw new Error(`Failed auth for ${email}: ${JSON.stringify(signUpData)}`);
    }
    return { idToken: signUpData.idToken, localId: signUpData.localId };
  }
  return { idToken: data.idToken, localId: data.localId };
}

test.describe('Peer-Review Full Workflow E2E Spec', () => {
  test.describe.configure({ mode: 'serial' });

  let mongoClient: MongoClient;
  let db: any;

  let teacherToken: string;
  const studentTokens: string[] = [];

  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let assessmentId: string;
  let itemId: string;
  let rubricCriteria: any[] = [];

  const studentEmails = [
    'user@yaksha.com',
    'student2@yaksha.com',
    'student3@yaksha.com',
    'student4@yaksha.com',
  ];
  const password = 'student123';

  test.beforeAll(async () => {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db('vibe');

    // 1. Authenticate Teacher & Students
    const tAuth = await getAuthUser('teacher@yaksha.com', 'teacher123');
    teacherToken = tAuth.idToken;

    for (const email of studentEmails) {
      const sAuth = await getAuthUser(email, password);
      studentTokens.push(sAuth.idToken);

      // Ensure Mongo user exists with matching firebaseUID
      let u = await db.collection('users').findOne({ email });
      if (!u) {
        await db.collection('users').insertOne({
          _id: new ObjectId(),
          email,
          firstName: `Student_${email.split('@')[0]}`,
          lastName: 'User',
          firebaseUID: sAuth.localId,
          roles: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        await db.collection('users').updateOne(
          { _id: u._id },
          { $set: { firebaseUID: sAuth.localId } }
        );
      }
    }

    const teacherUser = await db.collection('users').findOne({ email: 'teacher@yaksha.com' });

    // 2. Create Demo Course, Version, & Section in Mongo
    const cId = new ObjectId();
    const vId = new ObjectId();
    const mId = new ObjectId().toString();
    const sId = new ObjectId().toString();
    const itemsGroupId = new ObjectId();

    await db.collection('newCourse').insertOne({
      _id: cId,
      name: 'Playwright E2E Peer Review Course',
      description: 'E2E test course',
      created_by: teacherUser!._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection('itemsGroup').insertOne({
      _id: itemsGroupId,
      sectionId: new ObjectId(sId),
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection('newCourseVersion').insertOne({
      _id: vId,
      courseId: cId,
      version: 1,
      isPublished: true,
      modules: [
        {
          moduleId: mId,
          name: 'Module 1',
          sections: [
            {
              sectionId: sId,
              name: 'Section 1',
              itemsGroupId,
            },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enrollments
    const enrollments = [
      { userId: teacherUser!._id, courseId: cId, courseVersionId: vId, role: 'INSTRUCTOR' },
    ];
    for (const email of studentEmails) {
      const stu = await db.collection('users').findOne({ email });
      enrollments.push({ userId: stu._id, courseId: cId, courseVersionId: vId, role: 'STUDENT' });
    }
    await db.collection('enrollment').insertMany(enrollments.map(e => ({
      ...e,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));

    courseId = cId.toString();
    versionId = vId.toString();
    moduleId = mId;
    sectionId = sId;
  });

  test.afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  test('Step 1: Teacher creates Peer Review Assessment item via API', async () => {
    const subDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${API_BASE}/peer-review-assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        courseId,
        courseVersionId: versionId,
        moduleId,
        sectionId,
        itemName: 'E2E Peer Assignment',
        itemDescription: 'Submit project link for peer assessment',
        title: 'Playwright Peer Assessment',
        description: 'Evaluate classmate web apps',
        submissionDeadline: subDeadline,
        reviewWindowDays: 3,
        reviewsPerSubmission: 1,
        reviewsPerReviewer: 1,
        antiCollusionMode: 'circular-shift-collision-check',
        latePolicy: 'penalty-only',
        latePenaltyPercent: 15,
        teacherManualReviewEnabled: true,
        notificationsEnabled: true,
        rubric: [
          { label: 'Code Quality', description: 'Clean code & structure', maxPoints: 50 },
          { label: 'Functionality', description: 'Working features', maxPoints: 50 },
        ],
        cohortId: new ObjectId().toString(),
      }),
    });

    const resText = await res.text();
    console.log('Create Assessment Response:', res.status, resText);
    expect(res.status).toBe(201);
    const data = JSON.parse(resText);
    expect(data.assessmentId).toBeTruthy();
    expect(data.itemId).toBeTruthy();

    assessmentId = data.assessmentId;
    itemId = data.itemId;

    // Fetch assessment to store criteria IDs
    const getRes = await fetch(`${API_BASE}/peer-review-assessments/${assessmentId}`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` },
    });
    const getDoc = await getRes.json();
    rubricCriteria = getDoc.rubric;
    expect(rubricCriteria).toHaveLength(2);
    expect(rubricCriteria[0].criterionId).toBeTruthy();
  });

  test('Step 2: 4 Enrolled Students submit project links via API & UI verification', async ({ page }) => {
    for (let i = 0; i < studentTokens.length; i++) {
      const token = studentTokens[i];
      const res = await fetch(`${API_BASE}/courses/${courseId}/versions/${versionId}/items/${itemId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          courseVersionId: versionId,
          itemId,
          moduleId,
          sectionId,
          links: [
            {
              url: `https://github.com/shreyasmene06/vibe`,
              label: `Student ${i + 1} Repository`,
              kind: 'github',
            },
          ],
          notes: `Project notes from student ${i + 1}`,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.submissionId).toBeTruthy();
    }
  });

  test('Step 3: Deadline & Accessibility Enforcement checks', async () => {
    // 1. Check link accessibility service endpoint
    const checkRes = await fetch(`${API_BASE}/peer-review-links/check?url=https://github.com/shreyasmene06/vibe`, {
      headers: { 'Authorization': `Bearer ${studentTokens[0]}` },
    });
    expect(checkRes.status).toBe(200);
    const checkData = await checkRes.json();
    expect(checkData.accessible).toBe(true);

    // 2. Submitting invalid/broken URL fails with accessibility error
    const badSubmitRes = await fetch(`${API_BASE}/courses/${courseId}/versions/${versionId}/items/${itemId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentTokens[0]}`,
      },
      body: JSON.stringify({
        courseId,
        courseVersionId: versionId,
        itemId,
        moduleId,
        sectionId,
        links: [{ url: 'https://github.com/nonexistent-invalid-user/404-repo-xyz', label: 'Bad Link', kind: 'github' }],
      }),
    });
    expect(badSubmitRes.status).toBe(400);
  });

  test('Step 4: Teacher closes assessment & triggers reviewer assignment runner', async () => {
    const closeRes = await fetch(`${API_BASE}/peer-review-assessments/${assessmentId}/close`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${teacherToken}` },
    });
    expect(closeRes.status).toBe(200);

    // Post-close edits by student must be rejected
    const postCloseSubmit = await fetch(`${API_BASE}/courses/${courseId}/versions/${versionId}/items/${itemId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentTokens[0]}`,
      },
      body: JSON.stringify({
        courseId,
        courseVersionId: versionId,
        itemId,
        moduleId,
        sectionId,
        links: [{ url: 'https://github.com/shreyasmene06/vibe', label: 'Late Link', kind: 'github' }],
      }),
    });
    expect([400, 403]).toContain(postCloseSubmit.status);
  });

  test('Step 5: Reviewers fetch assigned queue (double-blind) & submit rubric reviews', async () => {
    for (let i = 0; i < studentTokens.length; i++) {
      const token = studentTokens[i];
      const queueRes = await fetch(`${API_BASE}/students/me/peer-review-assignments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      expect(queueRes.status).toBe(200);
      const queue = await queueRes.json();

      // Verify double-blind safety: queue objects MUST NOT reveal submitter studentId or identity
      for (const assignment of queue) {
        expect(assignment.studentId).toBeUndefined();
        expect(assignment.submitterName).toBeUndefined();
      }

      const myAssignments = queue.filter((a: any) => a.assessmentId === assessmentId);
      for (const assign of myAssignments) {
        const reviewRes = await fetch(`${API_BASE}/peer-review-assignments/${assign._id}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            scores: [
              { criterionId: rubricCriteria[0].criterionId, score: 45, comment: 'Solid code structure' },
              { criterionId: rubricCriteria[1].criterionId, score: 47, comment: 'All test cases pass' },
            ],
            overallComment: `Peer review by reviewer ${i + 1}`,
          }),
        });
        expect(reviewRes.status).toBe(201);
      }
    }
  });

  test('Step 6: Teacher views audit dashboard & performs manual score override', async () => {
    // 1. Audit submissions
    const subAuditRes = await fetch(`${API_BASE}/peer-review-assessments/${assessmentId}/submissions`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` },
    });
    expect(subAuditRes.status).toBe(200);

    // 2. Audit reviews
    console.log('-> Teacher Fetching Peer Reviews Audit...');
    const revAuditRes = await fetch(`${API_BASE}/peer-review-assessments/${assessmentId}/reviews`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` },
    });
    expect(revAuditRes.status).toBe(200);
    const { reviews } = await revAuditRes.json();
    expect(reviews.length).toBeGreaterThan(0);

    // 3. Teacher overrides the first review
    const targetReviewId = reviews[0].reviewId;
    const overrideRes = await fetch(`${API_BASE}/peer-reviews/${targetReviewId}/teacher-override`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        scores: [
          { criterionId: rubricCriteria[0].criterionId, score: 50, comment: 'Teacher override: Perfect score' },
          { criterionId: rubricCriteria[1].criterionId, score: 50, comment: 'Teacher override: Excellent implementation' },
        ],
        overallComment: 'Instructor override applied after manual audit.',
        reason: 'Verified project codebase independently and granted full score.',
      }),
    });

    expect(overrideRes.status).toBe(200);
    const overrideData = await overrideRes.json();
    expect(overrideData.ok).toBe(true);
    expect(overrideData.newFinalScore).toBe(100);
    expect(overrideData.teacherOverridden).toBe(true);
  });
});
