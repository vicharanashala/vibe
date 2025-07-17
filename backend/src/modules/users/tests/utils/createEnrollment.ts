import request from 'supertest';
import Express from 'express';
import {ObjectId} from 'mongodb';
import {expect} from 'vitest';

export interface EnrollmentParams {
  userId: string;
  courseId: string;
  courseVersionId: string;
}

export async function createEnrollment(
  app: typeof Express,
  userId: string | ObjectId,
  courseId: string,
  courseVersionId: string,
  firstModuleId: string,
  firstSectionId: string,
  firstItemId: string,
) {
  // Perform the request, and assert status
  const response = await request(app)
    .post(
      `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
    )
    .send({role: 'STUDENT'})
    .expect(200);

  // Build up the expected “shape” of the response
  const expectedShape = {
    enrollment: {
      userId,
      courseId,
      courseVersionId,
    },
    progress: {
      currentModule: firstModuleId,
      currentSection: firstSectionId,
      currentItem: firstItemId,
    },
  };

  // assert that the response body contains at least those fields with those exact values
  expect(response.body).toMatchObject(expectedShape);
  return response.body; // Return the response body for further assertions if needed
}
