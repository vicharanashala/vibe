import { coursesContainerModules, coursesModuleOptions, setupCoursesContainer } from '../index.js';
import { useExpressServer, useContainer, RoutingControllersOptions } from 'routing-controllers';
import Express from 'express';
import request from 'supertest';
import { ItemType } from '#shared/interfaces/models.js';
import { faker } from '@faker-js/faker';
import { CreateItemBody } from '../classes/validators/ItemValidators.js';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { currentUserChecker } from '#root/shared/functions/currentUserChecker.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container } from 'inversify';

describe('Course Version Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(...coursesContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    const options: RoutingControllersOptions = {
      controllers: coursesModuleOptions.controllers,
      middlewares: coursesModuleOptions.middlewares,
      defaultErrorHandler: coursesModuleOptions.defaultErrorHandler,
      authorizationChecker: async () => true, // Use a simple always-true checker for tests
      currentUserChecker: currentUserChecker, // Use the spied function
      validation: coursesModuleOptions.validation,
    }

    app = useExpressServer(App, options);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('COURSE VERSION CREATION', () => {
    describe('Success Scenario', () => {
      it('should create a course version', async () => {
        // Create course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        // Get id
        const courseId = response.body._id;

        // Create course version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        // log the endpoint to request to
        const endPoint = `/courses/${courseId}/versions`;
        const versionResponse = await request(app)
          .post(endPoint)
          .send(courseVersionPayload)
          .expect(201);

        // Check if the response is correct

        // expect(versionResponse.body.course._id).toBe(courseId);
        expect(versionResponse.body.version).toBe('New Course Version');
        expect(versionResponse.body.description).toBe(
          'Course version description',
        );

        // expect the version id to be in the list of course, this is shared in response
        // expect(versionResponse.body.course.versions).toContain(
        //   versionResponse.body.version._id,
        // );
      }, 90000);
    });
    describe('Error Scenarios', () => {
      it('should return 404 if course not found', async () => {
        // Create course version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        // log the endpoint to request to
        //endpoint id should be a valid mongoId.
        const endPoint = '/courses/5f9b1b3c9d1f1f1f1f1f1f1f/versions';
        const versionResponse = await request(app)
          .post(endPoint)
          .send(courseVersionPayload)
          .expect(404);

        expect(versionResponse.body.message).toContain('Course not found');
      }, 90000);

      it('should return 400 if invalid course version data', async () => {
        // Create course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        // Get id
        const courseId = response.body._id;

        // Create course version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        const endPoint = `/courses/${courseId}/versions`;
        const versionResponse = await request(app)
          .post(endPoint)
          .send({ version: '' })
          .expect(400);

        expect(versionResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        // expect(versionResponse.body.message).toContain("Invalid course version data");
      }, 90000);

      it('should return 400 if no course version data', async () => {
        // Create course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        // Get id
        const courseId = response.body._id;

        // log the endpoint to request to
        const endPoint = `/courses/${courseId}/versions`;
        const versionResponse = await request(app)
          .post(endPoint)
          .send({})
          .expect(400);

        expect(versionResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        // expect(versionResponse.body.message).toContain("Invalid course version data");
      }, 90000);
    });
  });

  describe('COURSE VERSION READ', () => {
    describe('Success Scenario', () => {
      it('should read a course version', async () => {
        // Create course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        // Get id
        const courseId = response.body._id;

        // Create course version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        // log the endpoint to request to
        const endPoint = `/courses/${courseId}/versions`;
        const versionResponse = await request(app)
          .post(endPoint)
          .send(courseVersionPayload)
          .expect(201);

        // Get version id
        const versionId = versionResponse.body._id;

        // log the endpoint to request to
        const endPoint2 = `/courses/versions/${versionId}`;
        const readResponse = await request(app).get(endPoint2).expect(200);

        expect(readResponse.body.version).toBe('New Course Version');
        expect(readResponse.body.description).toBe(
          'Course version description',
        );
      }, 90000);
    });
    describe('Error Scenarios', () => {
      it('should return 404 if course version not found', async () => {
        // random mongoid

        const id = '5f9b1b3c9d1f1f1f1f1f1f1f';

        const endPoint2 = `/courses/versions/${id}`;
        const readResponse = await request(app).get(endPoint2).expect(404);

        // expect(readResponse.body.message).toContain("Course version not found");
      }, 90000);
    });
  });

  describe('COURSE VERSION DELETE', () => {
    const coursePayload = {
      name: 'New Course',
      description: 'Course description',
    };

    const courseVersionPayload = {
      version: 'New Course Version',
      description: 'Course version description',
    };

    const modulePayload = {
      name: 'New Module',
      description: 'Module description',
    };

    const modulePayload2 = {
      name: 'New Module 2',
      description: 'Module description',
    };

    const sectionPayload = {
      name: 'New Section',
      description: 'Section description',
    };

    const itemPayload: CreateItemBody = {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      type: ItemType.QUIZ,
      quizDetails: {
        questionVisibility: 3,
        allowPartialGrading: true,
        deadline: faker.date.future(),
        allowSkip: true,
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

    describe('Success Scenario', () => {
      it('should delete a course version', async () => {
        const courseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = courseResponse.body._id;

        const versionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionPayload)
          .expect(201);

        const versionId = versionResponse.body._id;

        const moduleResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);

        const module2Response = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload2)
          .expect(201);

        const moduleId = moduleResponse.body.version.modules[0].moduleId;
        const module2Id = module2Response.body.version.modules[1].moduleId;

        const sectionResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
          .send(sectionPayload)
          .expect(201);

        const sectionId =
          sectionResponse.body.version.modules[0].sections[0].sectionId;

        const itemResponse = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload);
        expect(itemResponse.status).toBe(201);

        const deleteVersion = await request(app)
          .delete(`/courses/${courseId}/versions/${versionId}`)
          .expect(200);
        expect(deleteVersion.body.deletedItem);

        // Check if the version is deleted
        const readResponse = await request(app)
          .get(`/courses/versions/${versionId}`)
          .expect(404);
        expect(readResponse.body.message).toMatch('Course Version not found');
      }, 90000);
    });
    describe('Failure Scenario', () => {
      it('should not delete a course version', async () => {
        // invalid MongoId
        await request(app).delete('/courses/123/versions/123').expect(400);

        // course version or course id not found.
        await request(app)
          .delete(
            '/courses/5f9b1b3c9d1f1f1f1f1f1f1f/versions/5f9b1b3c9d1f1f1f1f1f1f1f',
          )
          .expect(404);
      }, 90000);
    });
  });

  describe('COURSE VERSION SERVICE ERROR PATHS (API)', () => {
    it('should return 404 if course does not exist on createCourseVersion', async () => {
      const courseVersionPayload = { version: 'v', description: 'd' };
      await request(app)
        .post('/courses/62341aeb5be816967d8fc2db/versions')
        .send(courseVersionPayload)
        .expect(404)
        .expect(res => {
          expect(res.body.message).toContain('Course not found');
        });
    }, 90000);

    it('should return 400 if invalid course version data', async () => {
      // Valid course, but invalid version payload
      const coursePayload = { name: 'Course', description: 'desc' };
      const courseRes = await request(app)
        .post('/courses/')
        .send(coursePayload)
        .expect(201);
      const courseId = courseRes.body._id;

      await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({ version: '', description: 'd' })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Invalid body');
        });
    }, 90000);

    it('should return 404 if course version not found on readCourseVersion', async () => {
      await request(app)
        .get('/courses/versions/62341aeb5be816967d8fc2db')
        .expect(404);
    }, 90000);

    it('should return 404 if course version not found on deleteCourseVersion', async () => {
      await request(app)
        .delete(
          '/courses/62341aeb5be816967d8fc2db/versions/62341aeb5be816967d8fc2db',
        )
        .expect(404);
    }, 90000);
  });
});
