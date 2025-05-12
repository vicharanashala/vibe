// utils/testProgressTracking.ts
import request from 'supertest';
import Express from 'express';
import {ProgressService} from '../../services/ProgressService';

export async function startStopAndUpdateProgress({
  userId,
  courseId,
  courseVersionId,
  itemId,
  moduleId,
  sectionId,
  app,
}: {
  userId: string;
  courseId: string;
  courseVersionId: string;
  itemId: string;
  moduleId: string;
  sectionId: string;
  app: typeof Express;
}) {
  // Start the item progress
  const startItemBody = {itemId, moduleId, sectionId};
  const startItemResponse = await request(app)
    .post(
      `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}/start`,
    )
    .send(startItemBody)
    .expect(200);

  // Stop the item progress
  const stopItemBody = {
    sectionId,
    moduleId,
    itemId,
    watchItemId: startItemResponse.body.watchItemId,
  };
  const stopItemResponse = await request(app)
    .post(
      `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}/stop`,
    )
    .send(stopItemBody)
    .expect(200);

  // Update the progress
  const updateProgressBody = {
    moduleId,
    sectionId,
    itemId,
    watchItemId: startItemResponse.body.watchItemId,
  };

  jest
    .spyOn(ProgressService.prototype as any, 'isValidWatchTime')
    .mockReturnValueOnce(true);

  const updateProgressResponse = await request(app)
    .patch(
      `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}/update`,
    )
    .send(updateProgressBody)
    .expect(200);

  return {startItemResponse, stopItemResponse, updateProgressResponse};
}
