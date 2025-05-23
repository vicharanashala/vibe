import {coursesModuleOptions} from 'modules/courses';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import Container from 'typedi';
import Express from 'express';
import request from 'supertest';
import {ReadError} from 'shared/errors/errors';

describe('Course Version Controller Integration Tests', () => {
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
  // Create course version
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

        expect(versionResponse.body.course._id).toBe(courseId);
        expect(versionResponse.body.version.version).toBe('New Course Version');
        expect(versionResponse.body.version.description).toBe(
          'Course version description',
        );

        //expect the version id to be in the list of course, this is shared in response
        expect(versionResponse.body.course.versions).toContain(
          versionResponse.body.version._id,
        );
      });
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

        // expect(versionResponse.body.message).toContain("Course not found");
      });

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

        // log the endpoint to request to
        const endPoint = `/courses/${courseId}/versions`;
        const versionResponse = await request(app)
          .post(endPoint)
          .send({version: ''})
          .expect(400);

        expect(versionResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );

        // expect(versionResponse.body.message).toContain("Invalid course version data");
      });

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
      });
    });
  });

  // Read course version
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
        const versionId = versionResponse.body.version._id;

        // log the endpoint to request to
        const endPoint2 = `/courses/versions/${versionId}`;
        const readResponse = await request(app).get(endPoint2).expect(200);

        expect(readResponse.body.version).toBe('New Course Version');
        expect(readResponse.body.description).toBe(
          'Course version description',
        );
      });
    });

    describe('Error Scenarios', () => {
      it('should return 404 if course version not found', async () => {
        // random mongoid

        const id = '5f9b1b3c9d1f1f1f1f1f1f1f';

        const endPoint2 = `/courses/versions/${id}`;
        const readResponse = await request(app).get(endPoint2).expect(404);

        // expect(readResponse.body.message).toContain("Course version not found");
      });

      // it should return 500, if the database throws ReadError

      it('should return 500 if database throws ReadError', async () => {
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

        const versionId = versionResponse.body.version._id;

        // log the endpoint to request to

        // Mock the database to throw ReadError

        const courseRepo = Container.get<CourseRepository>('CourseRepo');

        jest.spyOn(courseRepo, 'readVersion').mockImplementationOnce(() => {
          throw new ReadError('Mocked error from another test');
        });
        const endPoint2 = `/courses/versions/${versionId}`;
        const readResponse = await request(app).get(endPoint2).expect(500);
      });
    });
  });

  // Delete course version
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

    const sectionPayload = {
      name: 'New Section',
      description: 'Section description',
    };

    const itemPayload = {
      name: 'Item1',
      description: 'This an item',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '10.5',
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

        const versionId = versionResponse.body.version._id;

        const moduleResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);

        const moduleId = moduleResponse.body.version.modules[0].moduleId;

        const sectionResponse = await request(app)
          .post(`/versions/${versionId}/modules/${moduleId}/sections`)
          .send(sectionPayload)
          .expect(201);

        const sectionId =
          sectionResponse.body.version.modules[0].sections[0].sectionId;

        const itemsGroupId =
          sectionResponse.body.version.modules[0].sections[0].itemsGroupId;

        const itemsGroupResponse = await request(app)
          .post(
            `/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload)
          .expect(200);

        const deleteVersion = await request(app)
          .delete(`/courses/${courseId}/versions/${versionId}`)
          .expect(200);
        expect(deleteVersion.body.deletedItem);
      });
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
      });
    });
  });
});
