// utils/testProgressVerification.ts
import request from 'supertest';
import Express from 'express';

export async function verifyProgressInDatabase({
  userId,
  courseId,
  courseVersionId,
  expectedModuleId,
  expectedSectionId,
  expectedItemId,
  expectedCompleted,
  app,
}: {
  userId: string;
  courseId: string;
  courseVersionId: string;
  expectedModuleId: string;
  expectedSectionId: string;
  expectedItemId: string;
  expectedCompleted: boolean;
  app: typeof Express;
}) {
  // Find and verify the progress in the database
  const findUpdatedProgress = await request(app)
    .get(
      `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}`,
    )
    .expect(200);

  // Validate progress data
  const progressData = findUpdatedProgress.body;

  // Check that the progress data matches the expected values
  expect(progressData).toMatchObject({
    userId,
    courseId,
    courseVersionId,
    currentModule: expectedModuleId,
    currentSection: expectedSectionId,
    currentItem: expectedItemId,
    completed: expectedCompleted,
  });

  return progressData; // Optionally return the progress data if needed for further use
}
