import request from 'supertest';
import Express from 'express';
import {useContainer, useExpressServer} from 'routing-controllers';

import {usersModuleOptions} from '../index.js';
import {ItemType} from '#shared/interfaces/models.js';
import {
  CreateCourseVersionBody,
  CreateCourseVersionParams,
} from '#courses/classes/validators/CourseVersionValidators.js';
import {Course} from '#courses/classes/transformers/index.js';
import {CourseBody} from '#courses/classes/validators/CourseValidators.js';
import {SignUpBody} from '#auth/classes/validators/AuthValidators.js';
import {
  CreateModuleBody,
  CreateModuleParams,
  VersionModuleParams,
} from '#courses/classes/validators/ModuleValidators.js';
import {
  CreateSectionBody,
  VersionModuleSectionParams,
} from '#courses/classes/validators/SectionValidators.js';
import {CreateItemBody} from '#courses/classes/validators/ItemValidators.js';
import {EnrollmentParams} from './utils/createEnrollment.js';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {authContainerModule} from '#root/modules/auth/container.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '../container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {coursesModuleControllers} from '#root/modules/courses/index.js';
import {authModuleControllers} from '#root/modules/auth/index.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';

describe('Enrollment Controller Integration Tests', () => {
  const appInstance = Express();
  let app;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';

    const container = new Container();
    await container.load(
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      notificationsContainerModule
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    app = useExpressServer(appInstance, {
      controllers: [
        ...(usersModuleOptions.controllers as Function[]),
        ...(authModuleControllers as Function[]),
        ...(coursesModuleControllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    });
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
        .send(signUpBody);

      // Extract the user ID from the response
      const userId = signUpResponse.body.userId;

      // 2. Create a course by hitting at endpoint /courses

      const courseBody: CourseBody = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      };

      const courseResponse = await request(app)
        .post('/courses')
        .send(courseBody);

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

      const sectionParams: VersionModuleParams = {
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
          points: 10.5,
        },
      };

      const itemParams: VersionModuleSectionParams = {
        versionId: courseVersionId,
        moduleId: moduleId,
        sectionId: sectionId,
      };

      const createItemResponse = await request(app)
        .post(
          `/courses/versions/${itemParams.versionId}/modules/${itemParams.moduleId}/sections/${itemParams.sectionId}/items`,
        )
        .send(itemPayload)
      expect(createItemResponse.status).toBe(201);
      // Expect the response to contain the item ID
      expect(createItemResponse.body).toHaveProperty('itemsGroup');
      expect(createItemResponse.body.itemsGroup).toHaveProperty('items');
      expect(createItemResponse.body.itemsGroup.items).toHaveLength(1);
      expect(createItemResponse.body.itemsGroup.items[0]).toHaveProperty('_id');

      const itemId = createItemResponse.body.itemsGroup.items[0]._id;

      // 3. Enroll the user as a STUDENT in the course version by hitting at endpoint

      const createEnrollmentParams: EnrollmentParams = {
        userId: userId,
        courseId: courseId,
        courseVersionId: courseVersionId,
      };

      const enrollmentResponse = await request(app)
        .post(
          `/users/${createEnrollmentParams.userId}/enrollments/courses/${createEnrollmentParams.courseId}/versions/${createEnrollmentParams.courseVersionId}`,
        )
        .send({
          role: 'STUDENT',
        });
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
      const userId = signUpResponse.body.userId;

      // 2. Create a course
      const courseBody: CourseBody = {
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

      const createItemResponse = await request(app)
        .post(
          `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload)
        .expect(201);
      const itemId = createItemResponse.body.itemsGroup.items[0].itemId;

      // 7. Enroll the user
      const enrollmentResponse = await request(app)
        .post(
          `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
        )
        .send({
          role: 'STUDENT',
        });
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
      const reEnrollResponse = await request(app)
        .post(
          `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
        )
        .send({
          role: 'STUDENT',
        });
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

  // ------Tests for Get User Enrollments with Pagination------
  describe('GET User Enrollments (Pagination)', () => {
    it('should fetch paginated enrollments for a user', async () => {
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
      const userId = signUpResponse.body.userId;

      // 2. Create two courses and enroll user in both
      const enrollments: any[] = [];
      for (let i = 0; i < 2; i++) {
        // Create course
        const courseBody: CourseBody = {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
        };
        const courseResponse = await request(app)
          .post('/courses')
          .send(courseBody)
          .expect(201);
        const courseId: string = courseResponse.body._id;

        // Create course version
        const courseVersionBody: CreateCourseVersionBody = {
          version: '1.0',
          description: 'Initial version',
        };
        const createCourseVersionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionBody)
          .expect(201);
        const courseVersionId = createCourseVersionResponse.body._id;

        // Create module
        const moduleBody: CreateModuleBody = {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
        };
        const createModuleResponse = await request(app)
          .post(`/courses/versions/${courseVersionId}/modules`)
          .send(moduleBody)
          .expect(201);
        const moduleId = createModuleResponse.body.version.modules[0].moduleId;

        // Create section
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

        // Create item
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
        const createItemResponse = await request(app)
          .post(
            `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload)
          .expect(201);
        const itemId = createItemResponse.body.itemsGroup.items[0]._id;

        // Enroll the user
        const enrollmentResponse = await request(app)
          .post(
            `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
          )
          .send({
            role: 'STUDENT',
          });
        expect(enrollmentResponse.status).toBe(200);
        expect(enrollmentResponse.body).toHaveProperty('enrollment');
        expect(enrollmentResponse.body).toHaveProperty('progress');
        enrollments.push(enrollmentResponse.body.enrollment);
      }

      // 3. Fetch enrollments with pagination (limit 1, page 1)
      const getEnrollmentsResponse = await request(app).get(
        `/users/${userId}/enrollments?page=1&limit=1`,
      );
      expect(getEnrollmentsResponse.body).toHaveProperty('totalDocuments', 2);
      expect(getEnrollmentsResponse.body).toHaveProperty('totalPages', 2);
      expect(getEnrollmentsResponse.body).toHaveProperty('currentPage', 1);
      expect(getEnrollmentsResponse.body).toHaveProperty('enrollments');
      expect(Array.isArray(getEnrollmentsResponse.body.enrollments)).toBe(true);
      expect(getEnrollmentsResponse.body.enrollments.length).toBe(1);

      // 4. Fetch enrollments with pagination (limit 1, page 2)
      const getEnrollmentsResponsePage2 = await request(app)
        .get(`/users/${userId}/enrollments?page=2&limit=1`)
        .expect(200);

      expect(getEnrollmentsResponsePage2.body).toHaveProperty(
        'totalDocuments',
        2,
      );
      expect(getEnrollmentsResponsePage2.body).toHaveProperty('totalPages', 2);
      expect(getEnrollmentsResponsePage2.body).toHaveProperty('currentPage', 2);
      expect(getEnrollmentsResponsePage2.body).toHaveProperty('enrollments');
      expect(Array.isArray(getEnrollmentsResponsePage2.body.enrollments)).toBe(
        true,
      );
      expect(getEnrollmentsResponsePage2.body.enrollments.length).toBe(1);
    }, 90000);
  });
});
