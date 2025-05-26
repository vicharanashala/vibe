import request from 'supertest';
import {faker} from '@faker-js/faker';
import Express from 'express';
import {
  CreateCourseBody,
  CreateCourseVersionBody,
  CreateCourseVersionParams,
  CreateModuleBody,
  CreateModuleParams,
  CreateSectionBody,
  CreateSectionParams,
  ModuleDataResponse,
  SectionDataResponse,
} from 'modules/courses/classes/validators';
import {Course, CourseVersion} from 'modules/courses/classes/transformers';

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

export {createCourse, createVersion, createModule, createSection};
