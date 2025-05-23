import {MongoMemoryServer} from 'mongodb-memory-server';
import request from 'supertest';
import Express from 'express';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {Container} from 'typedi';
import {MongoDatabase} from '../../../shared/database/providers/mongo/MongoDatabase';
import {
  authModuleOptions,
  setupAuthModuleDependencies,
  SignUpBody,
} from 'modules/auth';
import {
  Course,
  coursesModuleOptions,
  CreateCourseBody,
  CreateCourseVersionBody,
  CreateCourseVersionParams,
  CreateItemParams,
  CreateModuleBody,
  CreateModuleParams,
  CreateSectionBody,
  CreateSectionParams,
  setupCoursesModuleDependencies,
} from 'modules/courses';
import {
  EnrollmentParams,
  setupUsersModuleDependencies,
  usersModuleOptions,
} from '..';
import {faker} from '@faker-js/faker/.';
import c from 'config';
import {dbConfig} from '../../../config/db';
jest.setTimeout(90000);
describe('Enrollment Controller Integration Tests', () => {
  const appInstance = Express();
  let app;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';

    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));

    setupAuthModuleDependencies();
    setupCoursesModuleDependencies();
    setupUsersModuleDependencies();

    // Create the Express app with routing-controllers configuration
    const options: RoutingControllersOptions = {
      controllers: [
        ...(authModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
        ...(usersModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async (action, roles) => {
        return true;
      },
      defaultErrorHandler: true,
    };

    app = useExpressServer(appInstance, options);
  });

  beforeEach(async () => {
    // TODO: Optionally reset database state before each test
  });

  // ------Tests for Create <ModuleName>------
  describe('Create Enrollment', () => {
    it('should create an enrollment', async () => {
      // 1. Create nwe user by hitting at endpoint /auth/signup
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: faker.internet.password(),
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };

      const signUpResponse = await request(app)
        .post('/auth/signup')
        .send(signUpBody)
        .expect(201);
      // Expect the response to contain the user ID
      expect(signUpResponse.body).toHaveProperty('id');
      // Extract the user ID from the response
      const userId = signUpResponse.body.id;

      // 2. Create a course by hitting at endpoint /courses

      const courseBody: CreateCourseBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const courseResponse = await request(app)
        .post('/courses')
        .send(courseBody)
        .expect(201);

      // Expect the response to contain the course ID
      expect(courseResponse.body).toHaveProperty('_id');

      const courseId: string = (courseResponse.body as Course)._id as string;

      // Create course version
      const courseVersionBody: CreateCourseVersionBody = {
        version: '1.0',
        description: 'Initial version',
      };

      const courseVersionParams: CreateCourseVersionParams = {
        id: courseId,
      };

      const createCourseVersionResponse = await request(app)
        .post(`/courses/${courseVersionParams.id}/versions`)
        .send(courseVersionBody)
        .expect(201);
      // Expect the response to contain the course version ID
      const courseVersionId = createCourseVersionResponse.body._id;
      expect(courseVersionId).toBeDefined();

      // 3. Create a module by hitting at endpoint /courses/:courseId/versions/:versionId/modules
      const moduleBody: CreateModuleBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const moduleParams: CreateModuleParams = {
        versionId: courseVersionId,
      };

      const createModuleResponse = await request(app)
        .post(`/courses/versions/${moduleParams.versionId}/modules`)
        .send(moduleBody);

      expect(createModuleResponse.status).toBe(201);
      expect(createModuleResponse.body).toHaveProperty('version');
      expect(createModuleResponse.body.version).toHaveProperty('modules');
      expect(createModuleResponse.body.version.modules).toHaveLength(1);
      expect(createModuleResponse.body.version.modules[0]).toHaveProperty(
        'moduleId',
      );
      // Extract the module ID from the response
      const moduleId = createModuleResponse.body.version.modules[0].moduleId;

      // 4. Create a section in the module

      const sectionBody: CreateSectionBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const sectionParams: CreateSectionParams = {
        versionId: courseVersionId,
        moduleId: moduleId,
      };

      const createSectionResponse = await request(app)
        .post(
          `/courses/versions/${sectionParams.versionId}/modules/${sectionParams.moduleId}/sections`,
        )
        .send(sectionBody)
        .expect(201);

      // Expect the response to contain the section ID
      expect(createSectionResponse.body).toHaveProperty('version');
      expect(createSectionResponse.body.version).toHaveProperty('modules');
      expect(createSectionResponse.body.version.modules).toHaveLength(1);
      expect(createSectionResponse.body.version.modules[0]).toHaveProperty(
        'sections',
      );
      expect(
        createSectionResponse.body.version.modules[0].sections,
      ).toHaveLength(1);
      expect(
        createSectionResponse.body.version.modules[0].sections[0],
      ).toHaveProperty('sectionId');
      // Extract the section ID from the response
      const sectionId =
        createSectionResponse.body.version.modules[0].sections[0].sectionId;

      // 5. Create an item in the section
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

      const itemParams: CreateItemParams = {
        versionId: courseVersionId,
        moduleId: moduleId,
        sectionId: sectionId,
      };

      const createItemResponse = await request(app)
        .post(
          `/courses/versions/${itemParams.versionId}/modules/${itemParams.moduleId}/sections/${itemParams.sectionId}/items`,
        )
        .send(itemPayload)
        .expect(201);
      // Expect the response to contain the item ID
      expect(createItemResponse.body).toHaveProperty('itemsGroup');
      expect(createItemResponse.body.itemsGroup).toHaveProperty('items');
      expect(createItemResponse.body.itemsGroup.items).toHaveLength(1);
      expect(createItemResponse.body.itemsGroup.items[0]).toHaveProperty(
        'itemId',
      );

      const itemId = createItemResponse.body.itemsGroup.items[0].itemId;

      // 3. Enroll the user in the course version by hitting at endpoint

      const createEnrollmentParams: EnrollmentParams = {
        userId: userId,
        courseId: courseId,
        courseVersionId: courseVersionId,
      };

      const enrollmentResponse = await request(app).post(
        `/users/${createEnrollmentParams.userId}/enrollments/courses/${createEnrollmentParams.courseId}/versions/${createEnrollmentParams.courseVersionId}`,
      );
      //expect status code to be 200
      expect(enrollmentResponse.status).toBe(200);
      //expect response to have property enrollment
      expect(enrollmentResponse.body).toHaveProperty('enrollment');
      //expect response to have property progress
      expect(enrollmentResponse.body).toHaveProperty('progress');

      //expect response to have property enrollment with userId
      expect(enrollmentResponse.body.enrollment).toHaveProperty('userId');
      expect(enrollmentResponse.body.enrollment.userId).toBe(userId);

      //expect response to have property enrollment with courseId
      expect(enrollmentResponse.body.enrollment).toHaveProperty('courseId');
      expect(enrollmentResponse.body.enrollment.courseId).toBe(courseId);

      //expect response to have property enrollment with courseVersionId
      expect(enrollmentResponse.body.enrollment).toHaveProperty(
        'courseVersionId',
      );
      expect(enrollmentResponse.body.enrollment.courseVersionId).toBe(
        courseVersionId,
      );

      //expect response to have property progress with moduleId
      expect(enrollmentResponse.body.progress).toHaveProperty('currentModule');
      expect(enrollmentResponse.body.progress.currentModule).toBe(moduleId);

      //expect response to have property progress with sectionId
      expect(enrollmentResponse.body.progress).toHaveProperty('currentSection');
      expect(enrollmentResponse.body.progress.currentSection).toBe(sectionId);

      //expect response to have property progress with itemId
      expect(enrollmentResponse.body.progress).toHaveProperty('currentItem');
      expect(enrollmentResponse.body.progress.currentItem).toBe(itemId);

      //expect progress userId, courseId and courseVersionId to be same as the one created
      expect(enrollmentResponse.body.progress.userId).toBe(userId);
      expect(enrollmentResponse.body.progress.courseId).toBe(courseId);
      expect(enrollmentResponse.body.progress.courseVersionId).toBe(
        courseVersionId,
      );
    }, 90000);
  });

  // ------Tests for Unenroll Enrollment------
  describe('Unenroll Enrollment', () => {
    it('should remove enrollment and progress for a user', async () => {
      // 1. Create a new user
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: faker.internet.password(),
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };

      const signUpResponse = await request(app)
        .post('/auth/signup')
        .send(signUpBody)
        .expect(201);
      const userId = signUpResponse.body.id;

      // 2. Create a course
      const courseBody: CreateCourseBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const courseResponse = await request(app)
        .post('/courses')
        .send(courseBody)
        .expect(201);
      const courseId: string = courseResponse.body._id;

      // 3. Create course version
      const courseVersionBody: CreateCourseVersionBody = {
        version: '1.0',
        description: 'Initial version',
      };

      const createCourseVersionResponse = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send(courseVersionBody)
        .expect(201);
      const courseVersionId = createCourseVersionResponse.body._id;

      // 4. Create a module
      const moduleBody: CreateModuleBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const createModuleResponse = await request(app)
        .post(`/courses/versions/${courseVersionId}/modules`)
        .send(moduleBody)
        .expect(201);
      const moduleId = createModuleResponse.body.version.modules[0].moduleId;

      // 5. Create a section
      const sectionBody: CreateSectionBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const createSectionResponse = await request(app)
        .post(
          `/courses/versions/${courseVersionId}/modules/${moduleId}/sections`,
        )
        .send(sectionBody)
        .expect(201);
      const sectionId =
        createSectionResponse.body.version.modules[0].sections[0].sectionId;

      // 6. Create an item
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

      const createItemResponse = await request(app)
        .post(
          `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload)
        .expect(201);
      const itemId = createItemResponse.body.itemsGroup.items[0].itemId;

      // 7. Enroll the user
      const enrollmentResponse = await request(app).post(
        `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
      );
      expect(enrollmentResponse.status).toBe(200);
      expect(enrollmentResponse.body).toHaveProperty('enrollment');
      expect(enrollmentResponse.body).toHaveProperty('progress');

      // 8. Unenroll the user
      const unenrollResponse = await request(app).post(
        `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}/unenroll`,
      );
      expect(unenrollResponse.status).toBe(200);
      expect(unenrollResponse.body.enrollment).toBeNull();
      expect(unenrollResponse.body.progress).toBeNull();

      // 9. Try to enroll again (should succeed, since unenrolled)
      const reEnrollResponse = await request(app).post(
        `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
      );
      expect(reEnrollResponse.status).toBe(200);
      expect(reEnrollResponse.body).toHaveProperty('enrollment');
      expect(reEnrollResponse.body).toHaveProperty('progress');
      expect(reEnrollResponse.body.enrollment.userId).toBe(userId);
      expect(reEnrollResponse.body.enrollment.courseId).toBe(courseId);
      expect(reEnrollResponse.body.enrollment.courseVersionId).toBe(
        courseVersionId,
      );
    }, 90000);
  });

  // ------Tests for Read <ModuleName>------
  describe('READ <ModuleName>', () => {
    // it('should ...', async () => {
    //   // Write your test here
    // });
  });

  // ------Tests for Update <ModuleName>------
  describe('UPDATE <ModuleName>', () => {
    // it('should ...', async () => {
    //   // Write your test here
    // });
  });

  // ------Tests for Delete <ModuleName>------
  describe('DELETE <ModuleName>', () => {
    // it('should ...', async () => {
    //   // Write your test here
    // });
  });
});
