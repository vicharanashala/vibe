import request from 'supertest';
import {faker} from '@faker-js/faker';
import Express from 'express';
import {
  CreateCourseBody,
  CreateCourseVersionBody,
  CreateCourseVersionParams,
  CreateItemBody,
  CreateItemParams,
  CreateModuleBody,
  CreateModuleParams,
  CreateSectionBody,
  CreateSectionParams,
  ItemDataResponse,
  ModuleDataResponse,
  SectionDataResponse,
} from '../../../courses/classes/validators/index.js';
import {Course, CourseVersion} from '#courses/classes/transformers/index.js';
import {ItemType} from '#root/shared/interfaces/models.js';

async function createCourse(app: typeof Express): Promise<Course> {
  const body: CreateCourseBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
  };

  const response = await request(app).post('/courses').send(body).expect(201);
  return response.body as Course;
}

async function createVersion(
  app: typeof Express,
  courseId: string,
): Promise<CourseVersion> {
  const body: CreateCourseVersionBody = {
    version: faker.commerce.productAdjective(),
    description: faker.commerce.productDescription(),
  };

  const params: CreateCourseVersionParams = {
    id: courseId,
  };

  const response = await request(app)
    .post(`/courses/${params.id}/versions`)
    .send(body)
    .expect(201);
  return response.body as CourseVersion;
}

async function createModule(
  app: typeof Express,
  versionId: string,
): Promise<ModuleDataResponse> {
  const body: CreateModuleBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
  };

  const params: CreateModuleParams = {
    versionId: versionId,
  };

  const response = await request(app)
    .post(`/courses/versions/${params.versionId}/modules`)
    .send(body)
    .expect(201);
  return response.body as ModuleDataResponse;
}

async function createSection(
  app: typeof Express,
  versionId: string,
  moduleId: string,
): Promise<SectionDataResponse> {
  const body: CreateSectionBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
  };

  const params: CreateSectionParams = {
    versionId: versionId,
    moduleId: moduleId,
  };

  const response = await request(app)
    .post(
      `/courses/versions/${params.versionId}/modules/${params.moduleId}/sections`,
    )
    .send(body)
    .expect(201);
  return response.body as SectionDataResponse;
}

async function createQuizItem(
  app: typeof Express,
  versionId: string,
  moduleId: string,
  sectionId: string,
): Promise<unknown> {
  const itemPayload: CreateItemBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    type: ItemType.QUIZ,
    quizDetails: {
      questionVisibility: 3,
      allowPartialGrading: true,
      deadline: faker.date.future(),
      allowHint: true,
      maxAttempts: 5,
      releaseTime: faker.date.future(),
      quizType: 'DEADLINE',
      showCorrectAnswersAfterSubmission: true,
      showExplanationAfterSubmission: true,
      showScoreAfterSubmission: true,
      approximateTimeToComplete: '00:30:00',
      passThreshold: 0.7,
    },
  };
  const params: CreateItemParams = {
    versionId: versionId,
    moduleId: moduleId,
    sectionId: sectionId,
  };

  const itemResponse = await request(app)
    .post(
      `/courses/versions/${params.versionId}/modules/${params.moduleId}/sections/${params.sectionId}/items`,
    )
    .send(itemPayload);

  expect(itemResponse.body.itemsGroup.items.length).toBe(1);

  return itemResponse.body as ItemDataResponse;
}

async function createVideoItem(
  app: typeof Express,
  versionId: string,
  moduleId: string,
  sectionId: string,
): Promise<unknown> {
  const itemPayload: CreateItemBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    type: ItemType.VIDEO,
    videoDetails: {
      URL: faker.internet.url(),
      startTime: '00:00:00',
      endTime: '00:30:00',
      points: 27,
    },
  };
  const params: CreateItemParams = {
    versionId: versionId,
    moduleId: moduleId,
    sectionId: sectionId,
  };

  const itemResponse = await request(app)
    .post(
      `/courses/versions/${params.versionId}/modules/${params.moduleId}/sections/${params.sectionId}/items`,
    )
    .send(itemPayload);

  expect(itemResponse.body.itemsGroup.items.length).toBe(1);

  return itemResponse.body as ItemDataResponse;
}

async function createBlogItem(
  app: typeof Express,
  versionId: string,
  moduleId: string,
  sectionId: string,
): Promise<ItemDataResponse> {
  const body: CreateItemBody = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    type: ItemType.BLOG,
    blogDetails: {
      content: 'This is a sample blog content.',
      estimatedReadTimeInMinutes: 5,
      tags: ['sample', 'blog', 'test'],
      points: 30,
    },
  };

  const params: CreateItemParams = {
    versionId: versionId,
    moduleId: moduleId,
    sectionId: sectionId,
  };

  const itemResponse = await request(app)
    .post(
      `/courses/versions/${params.versionId}/modules/${params.moduleId}/sections/${params.sectionId}/items`,
    )
    .send(body);
  expect(itemResponse.body.itemsGroup.items.length).toBe(1);
  return itemResponse.body as ItemDataResponse;
}

export {
  createCourse,
  createVersion,
  createModule,
  createSection,
  createQuizItem,
  createVideoItem,
};
