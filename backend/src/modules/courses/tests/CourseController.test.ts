import request from 'supertest';
import Express from 'express';
import {useExpressServer} from 'routing-controllers';
import {
  coursesModuleOptions,
  CreateCourseBody,
  setupCoursesContainer,
} from '..';
import {faker} from '@faker-js/faker';
import {jest} from '@jest/globals';

describe('Course Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    await setupCoursesContainer();
    app = useExpressServer(App, coursesModuleOptions);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('COURSE CREATION', () => {
    describe('Success Scenario', () => {
      it('should create a course', async () => {
        const coursePayload: CreateCourseBody = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        expect(response.body.name).toBe('New Course');
        expect(response.body.description).toBe('Course description');
        expect(response.body._id).toBeDefined();
      }, 60000);
    });

    describe('Errors Scenarios', () => {
      it('should return 400 for invalid course data', async () => {
        const invalidPayload = {name: ''};

        const response = await request(app)
          .post('/courses/')
          .send(invalidPayload)
          .expect(400);
        expect(response.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      }, 60000);
    });
  });

  describe('COURSE RETRIEVAL', () => {
    describe('Success Scenario', () => {
      it('should read a course by ID', async () => {
        const coursePayload = {
          name: 'Existing Course',
          description: 'Course description',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        const response = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(response.body.name).toBe('Existing Course');
        expect(response.body.description).toBe('Course description');
        expect(response.body._id).toBe(courseId);
      }, 60000);
    });

    describe('Error Scenarios', () => {
      it('should return 404 for a non-existing course', async () => {
        const response = await request(app)
          .get(`/courses/${faker.database.mongodbObjectId()}`)
          .expect(404);
        expect(response.body.message).toContain(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      }, 60000);
    });
  });

  describe('COURSE UPDATION', () => {
    describe('Success Scenario', () => {
      it('should update a course by ID', async () => {
        const coursePayload = {
          name: 'Existing Course',
          description: 'Course description',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        const updatedCoursePayload = {
          name: 'Updated Course',
          description: 'Updated course description',
        };

        const response = await request(app)
          .put(`/courses/${courseId}`)
          .send(updatedCoursePayload)
          .expect(200);

        expect(response.body.name).toBe('Updated Course');
        expect(response.body.description).toBe('Updated course description');
        expect(response.body._id).toBe(courseId);

        const readResponse = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(readResponse.body.name).toBe('Updated Course');
        expect(readResponse.body.description).toBe(
          'Updated course description',
        );
      }, 60000);
    });
    describe('Error Scenarios', () => {
      it('should return 404 for a non-existing course', async () => {
        jest.restoreAllMocks();

        const response = await request(app)
          .put('/courses/67dd98f025dd87ebf639851c')
          .send({name: 'Updated Course'})
          .expect(404);
      }, 60000);

      it('should return 400 for invalid course data', async () => {
        const coursePayload = {
          name: 'Existing Course',
          description: 'Course description',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        const invalidPayload = {name: ''};

        const response = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload)
          .expect(400);

        expect(response.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        const invalidPayload2 = {description: ''};

        const response2 = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload2)
          .expect(400);

        expect(response2.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        const invalidPayload3 = {};

        const response3 = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload3)
          .expect(400);

        expect(response3.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      }, 60000);
    });
  });

  describe('COURSE DELETION', () => {
    describe('Success Scenario', () => {
      it('should delete a course by ID', async () => {
        const coursePayload = {
          name: 'Course To Be Deleted',
          description: 'This course will be deleted',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        const res = await request(app).delete(`/courses/${courseId}`);
        console.log(res.body);

        await request(app).get(`/courses/${courseId}`).expect(404);
      }, 60000);
    });

    describe('Error Scenarios', () => {
      it('should return 404 for a non-existing course', async () => {
        const fakeId = faker.database.mongodbObjectId();

        await request(app).delete(`/courses/${fakeId}`).expect(404);
      }, 60000);
    });
  });
});
