import {MongoMemoryServer} from 'mongodb-memory-server';
import request from 'supertest';
import Express from 'express';
import {useExpressServer} from 'routing-controllers';
import {Container} from 'typedi';
import {MongoDatabase} from '../../../shared/database/providers/mongo/MongoDatabase';
import {CourseRepository} from '../../../shared/database/providers/mongo/repositories/CourseRepository';
import {
  coursesModuleOptions,
  CreateCourseBody,
  setupCoursesModuleDependencies,
} from '..';
import {dbConfig} from '../../../config/db';
import {faker} from '@faker-js/faker/.';
jest.setTimeout(60000);

describe('Course Controller Integration Tests', () => {
  const App = Express();
  let app;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start an in-memory MongoDB server
    // mongoServer = await MongoMemoryServer.create();
    // const mongoUri = mongoServer.getUri();

    // // Set up the real MongoDatabase and CourseRepository
    // Container.set('Database', new MongoDatabase(mongoUri, 'vibe'));
    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));

    setupCoursesModuleDependencies();

    // Create the Express app with the routing controllers configuration
    app = useExpressServer(App, coursesModuleOptions);
  });

  afterAll(async () => {
    // Close the in-memory MongoDB server after the tests
    // await mongoServer.stop();
  });

  // beforeEach(() => {
  //   // Ensure mocks are reset before each test to prevent interference
  //   jest.restoreAllMocks();
  // });

  // ------Tests for Create Course------
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
      });
    });

    describe('Errors Scenarios', () => {
      // it('should return 500 if unkown error occurs', async () => {
      //   const coursePayload = {
      //     name: 'New Course',
      //     description: 'Course description',
      //   };

      //   // Mock the create method to throw an error
      //   const courseRepo = Container.get<CourseRepository>('CourseRepo');
      //   jest.spyOn(courseRepo, 'create').mockImplementationOnce(() => {
      //     throw new Error('Mocked error');
      //   });

      //   const response = await request(app)
      //     .post('/courses/')
      //     .send(coursePayload)
      //     .expect(500);

      //   // expect(response.body.message).toContain("Mocked error");
      // });

      it('should return 400 for invalid course data', async () => {
        const invalidPayload = {name: ''}; // Missing required fields

        const response = await request(app)
          .post('/courses/')
          .send(invalidPayload)
          .expect(400);
        console.log(response.body);
        expect(response.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      });
    });
  });

  // ------Tests for Read Course------
  describe('COURSE RETRIEVAL', () => {
    describe('Success Scenario', () => {
      it('should read a course by ID', async () => {
        // First, create a course
        const coursePayload = {
          name: 'Existing Course',
          description: 'Course description',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        // Now, read the course by its ID
        const response = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(response.body.name).toBe('Existing Course');
        expect(response.body.description).toBe('Course description');
        expect(response.body._id).toBe(courseId);
      });
    });

    describe('Error Scenarios', () => {
      it('should return 404 for a non-existing course', async () => {
        const response = await request(app)
          .get(`/courses/${faker.database.mongodbObjectId()}`)
          .expect(404);
        console.log(response.body);
        expect(response.body.message).toContain(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      });
    });
  });

  // ------Tests for Update Course------
  describe('COURSE UPDATION', () => {
    describe('Success Scenario', () => {
      it('should update a course by ID', async () => {
        // First, create a course
        const coursePayload = {
          name: 'Existing Course',
          description: 'Course description',
        };

        const createdCourseResponse = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        const courseId = createdCourseResponse.body._id;

        // Now, update the course by its ID
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

        // Check if the course was actually updated
        const readResponse = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(readResponse.body.name).toBe('Updated Course');
        expect(readResponse.body.description).toBe(
          'Updated course description',
        );
      });
    });
    describe('Error Scenarios', () => {
      it('should return 404 for a non-existing course', async () => {
        jest.restoreAllMocks();

        const response = await request(app)
          .put('/courses/67dd98f025dd87ebf639851c')
          .send({name: 'Updated Course'})
          .expect(404);
      });

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

        // Missing name field
        const invalidPayload = {name: ''}; // Missing required fields

        const response = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload)
          .expect(400);

        expect(response.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        // Missing description field
        const invalidPayload2 = {description: ''}; // Missing required fields

        const response2 = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload2)
          .expect(400);

        expect(response2.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        // No fields
        const invalidPayload3 = {}; // Missing required fields

        const response3 = await request(app)
          .put(`/courses/${courseId}`)
          .send(invalidPayload3)
          .expect(400);

        expect(response3.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      });
    });
  });
});
