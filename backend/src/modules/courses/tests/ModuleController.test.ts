import {coursesModuleOptions} from 'modules/courses';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import Container from 'typedi';
import Express from 'express';
import request from 'supertest';
import {ReadError} from 'shared/errors/errors';

describe('Module Controller Integration Tests', () => {
  const App = Express();
  let app;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start an in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set up the real MongoDatabase and CourseRepository
    Container.set('Database', new MongoDatabase(mongoUri, 'vibe'));
    const courseRepo = new CourseRepository(
      Container.get<MongoDatabase>('Database'),
    );
    Container.set('CourseRepo', courseRepo);

    // Create the Express app with the routing controllers configuration
    app = useExpressServer(App, coursesModuleOptions);
  });

  afterAll(async () => {
    // Close the in-memory MongoDB server after the tests
    await mongoServer.stop();
  });

  // Tests for creating a module

  describe('MODULE CREATION', () => {
    describe('Success Scenario', () => {
      it('should create a module', async () => {
        // Create a course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(200);

        // Get course id
        const courseId = response.body._id;

        // Create a version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        const versionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionPayload)
          .expect(200);

        // Get version id
        const versionId = versionResponse.body.version._id;

        // Create a module
        const modulePayload = {
          name: 'New Module',
          description: 'Module description',
        };

        // Log the endpoint to request to
        const endPoint = `/courses/versions/${versionId}/modules`;

        const moduleResponse = await request(app)
          .post(endPoint)
          .send(modulePayload)
          .expect(200);

        // Extract the moduleId of the created module
        const createdModule = moduleResponse.body.version.modules.find(
          module =>
            module.name === 'New Module' &&
            module.description === 'Module description',
        );

        // Ensure that the module exists in the list
        expect(createdModule).toBeDefined();
        expect(createdModule).toMatchObject({
          name: 'New Module',
          description: 'Module description',
        });

        // Optionally, check if the moduleId and other properties match
        expect(createdModule.moduleId).toBeDefined();
        expect(createdModule.order).toBeDefined(); // Check if order exists
      });
    });

    describe('Error Scenarios', () => {
      it('should return 400 if version id is not valid', async () => {
        // Create a module
        const modulePayload = {
          name: 'New Module',
          description: 'Module description',
        };

        // Log the endpoint to request to
        const endPoint = '/courses/versions/123/modules';

        const moduleResponse = await request(app)
          .post(endPoint)
          .send(modulePayload)
          .expect(400);

        // expect(moduleResponse.body.message).toContain("Version not found");
      });

      it('should return 400 for invalid module data', async () => {
        // Create a course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(200);

        // Get course id
        const courseId = response.body._id;

        // Create a version

        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        const versionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionPayload)
          .expect(200);

        // Get version id

        const versionId = versionResponse.body.version._id;

        // Missing name field
        const invalidPayload = {name: ''}; // Missing required fields

        const moduleResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(invalidPayload)
          .expect(400);

        expect(moduleResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      });

      it('should return 500 if unkown error occurs', async () => {
        // Create a course
        const coursePayload = {
          name: 'New Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(200);

        // Get course id
        const courseId = response.body._id;

        // Create a version
        const courseVersionPayload = {
          version: 'New Course Version',
          description: 'Course version description',
        };

        const versionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionPayload)
          .expect(200);

        // Get version id
        const versionId = versionResponse.body.version._id;

        // Create a module
        const modulePayload = {
          name: 'New Module',
          description: 'Module description',
        };

        // Log the endpoint to request to
        const endPoint = `/courses/versions/${versionId}/modules`;

        // Throw an error
        const moduleRepo = Container.get<CourseRepository>('CourseRepo');
        jest.spyOn(moduleRepo, 'updateVersion').mockImplementation(() => {
          throw new Error('Unknown error');
        });

        const moduleResponse = await request(app)
          .post(endPoint)
          .send(modulePayload)
          .expect(500);
      });
    });
  });

  // Tests for updating a module

  describe('MODULE UPDATE', () => {
    describe('Success Scenario', () => {});
  });
});
