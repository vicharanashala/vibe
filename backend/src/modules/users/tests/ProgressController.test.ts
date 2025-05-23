import request from 'supertest';
import Express from 'express';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {Container} from 'typedi';
import {MongoDatabase} from '../../../shared/database/providers/mongo/MongoDatabase';
import {authModuleOptions, setupAuthModuleDependencies} from 'modules/auth';
import {
  coursesModuleOptions,
  setupCoursesModuleDependencies,
} from 'modules/courses';
import {
  ResetCourseProgressBody,
  setupUsersModuleDependencies,
  StartItemBody,
  StopItemBody,
  UpdateProgressBody,
  usersModuleOptions,
} from '..';

import {de, fa, faker, ne} from '@faker-js/faker/.';
import {isMongoId} from 'class-validator';
import {ProgressService} from '../services/ProgressService';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ItemRepository} from 'shared/database/providers/mongo/repositories/ItemRepository';
import {UserRepository} from 'shared/database/providers/MongoDatabaseProvider';
import {dbConfig} from '../../../config/db';
import {IUser, IWatchTime} from 'shared/interfaces/Models';
import {
  CourseData,
  createCourseWithModulesSectionsAndItems,
} from './utils/createCourse';
import {createUser} from './utils/createUser';
import {createEnrollment} from './utils/createEnrollment';
import {startStopAndUpdateProgress} from './utils/startStopAndUpdateProgress';
import {verifyProgressInDatabase} from './utils/verifyProgressInDatabase';

describe('Progress Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let user: IUser;
  let courseData: CourseData;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';

    // Start an in-memory MongoDB servera
    // mongoServer = await MongoMemoryServer.create();
    // const uri = mongoServer.getUri();
    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));

    setupAuthModuleDependencies();
    setupCoursesModuleDependencies();
    setupUsersModuleDependencies();

    const progressService = new ProgressService(
      Container.get<ProgressRepository>('ProgressRepo'),
      Container.get<CourseRepository>('CourseRepo'),
      Container.get<UserRepository>('UserRepo'),
      Container.get<ItemRepository>('ItemRepo'),
    );

    // Remove the old ProgressService from the container
    if (Container.has('ProgressService')) {
      Container.remove('ProgressService');
    }
    Container.set('ProgressService', progressService);

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
      validation: true,
    };

    app = useExpressServer(appInstance, options);

    courseData = await createCourseWithModulesSectionsAndItems(2, 2, 3, app);

    // Create a user
    user = await createUser(app);

    // Create enrollment
    await createEnrollment(
      app,
      user.id,
      courseData.courseId,
      courseData.courseVersionId,
      courseData.modules[0].moduleId,
      courseData.modules[0].sections[0].sectionId,
      courseData.modules[0].sections[0].items[0].itemId,
    );

    jest.setTimeout(30000);
  }, 900000);

  afterAll(async () => {
    // Stop the in-memory MongoDB server
    // await mongoServer.stop();
    await Container.get<MongoDatabase>('Database').disconnect();
    // Close all containers
    Container.reset();
  });

  beforeEach(async () => {}, 10000);

  // ------Tests for Create <ModuleName>------
  describe('Fetch Progress Data', () => {
    it('should fetch the progress', async () => {
      await verifyProgressInDatabase({
        userId: user.id,
        courseId: courseData.courseId,
        courseVersionId: courseData.courseVersionId,
        expectedModuleId: courseData.modules[0].moduleId,
        expectedSectionId: courseData.modules[0].sections[0].sectionId,
        expectedItemId: courseData.modules[0].sections[0].items[0].itemId,
        expectedCompleted: false,
        app,
      });
    });

    it('should return 400 if userId is invalid', async () => {
      const invalidUserId = 'invalidUserId';
      const courseId = courseData.courseId;
      const courseVersionId = courseData.courseVersionId;

      const response = await request(app)
        .get(
          `/users/${invalidUserId}/progress/courses/${courseId}/versions/${courseVersionId}`,
        )
        .expect(400);

      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeTruthy();
      expect(response.body.errors[0].constraints).toHaveProperty('isMongoId');
    }, 10000);

    it('should return 400 if courseId is invalid', async () => {
      const userId = user.id;
      const invalidCourseId = 'invalidCourseId';
      const courseVersionId = courseData.courseVersionId;

      const response = await request(app)
        .get(
          `/users/${userId}/progress/courses/${invalidCourseId}/versions/${courseVersionId}`,
        )
        .expect(400);

      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeTruthy();
      expect(response.body.errors[0].constraints).toHaveProperty('isMongoId');
    });

    it('should return 400 if courseVersionId is invalid', async () => {
      const userId = user.id;
      const courseId = courseData.courseId;

      const invalidCourseVersionId = 'invalidCourseVersionId';

      const response = await request(app)
        .get(
          `/users/${userId}/progress/courses/${courseId}/versions/${invalidCourseVersionId}`,
        )
        .expect(400);
      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeTruthy();
      expect(response.body.errors[0].constraints).toHaveProperty('isMongoId');
    });

    it('should return 404 if progress not found when courseId and courseVersionId are fake', async () => {
      const userId = user.id;

      const courseId = faker.database.mongodbObjectId();
      const courseVersionId = faker.database.mongodbObjectId();

      const response = await request(app)
        .get(
          `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}`,
        )
        .expect(404);
      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe('NotFoundError');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Course not found');
    });

    it('should return 404 if progress not found when userId is fake', async () => {
      const userId = faker.database.mongodbObjectId();
      const courseId = courseData.courseId;
      const courseVersionId = courseData.courseVersionId;

      const response = await request(app)
        .get(
          `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}`,
        )
        .expect(404);

      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe('NotFoundError');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('User not found');
    });

    it('should return 404 if progress not found when all params are fake', async () => {
      const userId = faker.database.mongodbObjectId();
      const courseId = faker.database.mongodbObjectId();
      const courseVersionId = faker.database.mongodbObjectId();

      const response = await request(app)
        .get(
          `/users/${userId}/progress/courses/${courseId}/versions/${courseVersionId}`,
        )
        .expect(404);

      //expect body.errors to be truthy
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe('NotFoundError');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('Start Item', () => {
    it('should start the item tracking for recording progress', async () => {
      const startItemBody: StartItemBody = {
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
      };
      // Start the item progress
      const startItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
        )
        .send(startItemBody)
        .expect(200);

      // Expect the response to contain the watchItemId
      expect(startItemResponse.body).toHaveProperty('watchItemId');
      expect(startItemResponse.body.watchItemId).toBeTruthy();
      expect(isMongoId(startItemResponse.body.watchItemId)).toBe(true);
    });
  });

  describe('Stop Item', () => {
    it('should stop the item tracking for recording progress', async () => {
      const startItemBody: StartItemBody = {
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
      };
      // Start the item progress
      const startItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
        )
        .send(startItemBody)
        .expect(200);

      // Stop the item progress
      const stopItemBody: StopItemBody = {
        sectionId: courseData.modules[0].sections[0].sectionId,
        moduleId: courseData.modules[0].moduleId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      const stopItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/stop`,
        )
        .send(stopItemBody)
        .expect(200);
    });
  });

  describe('Update Progress', () => {
    beforeEach(async () => {
      courseData = await createCourseWithModulesSectionsAndItems(2, 2, 3, app);

      // Create a user
      user = await createUser(app);

      // Create enrollment
      await createEnrollment(
        app,
        user.id,
        courseData.courseId,
        courseData.courseVersionId,
        courseData.modules[0].moduleId,
        courseData.modules[0].sections[0].sectionId,
        courseData.modules[0].sections[0].items[0].itemId,
      );
    }, 50000);

    it('should update the progress, if isValidWatchTime is true', async () => {
      // Start the item progress
      const startItemBody: StartItemBody = {
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
      };
      const startItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
        )
        .send(startItemBody)
        .expect(200);

      // Stop the item progress
      const stopItemBody: StopItemBody = {
        sectionId: courseData.modules[0].sections[0].sectionId,
        moduleId: courseData.modules[0].moduleId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };
      const stopItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/stop`,
        )
        .send(stopItemBody)
        .expect(200);

      // Update the progress
      const updateProgressBody: UpdateProgressBody = {
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      jest
        .spyOn(ProgressService.prototype as any, 'isValidWatchTime')
        .mockReturnValueOnce(true);

      const updateProgressResponse = await request(app)
        .patch(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/update`,
        )
        .send(updateProgressBody)
        .expect(200);
    }, 50000);
    it('should not update the progress, if isValidWatchTime is false', async () => {
      // Start the item progress
      const startItemBody: StartItemBody = {
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
      };
      const startItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
        )
        .send(startItemBody);

      // Stop the item progress

      const stopItemBody: StopItemBody = {
        sectionId: courseData.modules[0].sections[0].sectionId,
        moduleId: courseData.modules[0].moduleId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      const stopItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/stop`,
        )
        .send(stopItemBody)
        .expect(200);

      // Update the progress

      const updateProgressBody: UpdateProgressBody = {
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      jest
        .spyOn(ProgressService.prototype as any, 'isValidWatchTime')
        .mockReturnValueOnce(false);

      const updateProgressResponse = await request(app)
        .patch(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/update`,
        )
        .send(updateProgressBody);

      expect(updateProgressResponse.status).toBe(400);
      expect(updateProgressResponse.body).toHaveProperty('name');
      expect(updateProgressResponse.body.name).toBe('BadRequestError');
      expect(updateProgressResponse.body).toHaveProperty('message');
      expect(updateProgressResponse.body.message).toBe(
        'Watch time is not valid, the user did not watch the item long enough',
      );
    }, 50000);

    it('should update the progress, if watch time is actually greater than or equal to 0.5 times video length', async () => {
      // Start the item progress
      const startItemBody: StartItemBody = {
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
      };
      const startItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
        )
        .send(startItemBody)
        .expect(200);
      // Stop the item progress

      const stopItemBody: StopItemBody = {
        sectionId: courseData.modules[0].sections[0].sectionId,
        moduleId: courseData.modules[0].moduleId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      const stopItemResponse = await request(app)
        .post(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/stop`,
        )
        .send(stopItemBody)
        .expect(200);

      // Update the progress
      const updateProgressBody: UpdateProgressBody = {
        moduleId: courseData.modules[0].moduleId,
        sectionId: courseData.modules[0].sections[0].sectionId,
        itemId: courseData.modules[0].sections[0].items[0].itemId,
        watchItemId: startItemResponse.body.watchItemId,
      };

      // jest
      //   .spyOn(ProgressService.prototype as any, 'isValidWatchTime')
      //   .mockReturnValueOnce(false);

      const originalGet = ProgressRepository.prototype.getWatchTimeById;

      jest
        .spyOn(ProgressRepository.prototype, 'getWatchTimeById')
        .mockImplementation(async function (id: string) {
          // 1. Call the real implementation:
          const watchTime: IWatchTime = await originalGet.call(this, id);

          if (watchTime) {
            // 2. Compute new endTime = startTime + 10min
            const newEnd = new Date(
              watchTime.startTime.getTime() + 1 * 45 * 1000,
            );
            // 3. Either mutate or clone—here we mutate:
            watchTime.endTime = newEnd;
          }

          // 4. Return the modified document:
          return watchTime;
        });

      const updateProgressResponse = await request(app)
        .patch(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/update`,
        )
        .send(updateProgressBody);
      expect(updateProgressResponse.status).toBe(200);

      // fetch the progress of the user
      const progressResponse = await request(app)
        .get(
          `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}`,
        )
        .expect(200);

      // Expect the response to contain the progress data
      expect(progressResponse.body).toHaveProperty('userId');
      expect(progressResponse.body.userId).toBe(user.id);
      expect(progressResponse.body).toHaveProperty('courseId');
      expect(progressResponse.body.courseId).toBe(courseData.courseId);
      expect(progressResponse.body).toHaveProperty('courseVersionId');
      expect(progressResponse.body.courseVersionId).toBe(
        courseData.courseVersionId,
      );
      expect(progressResponse.body).toHaveProperty('currentModule');
      //expect currentItem to not be equal to itemId
      expect(progressResponse.body.currentModule).not.toBe(
        courseData.modules[0].sections[0].items[0].itemId,
      );
    }, 50000);
  });

  describe('Reset Progress', () => {
    beforeAll(async () => {
      // Create a course with modules, sections, and items
      courseData = await createCourseWithModulesSectionsAndItems(3, 3, 4, app);

      // Create a user
      user = await createUser(app);

      // Create enrollment
      await createEnrollment(
        app,
        user.id,
        courseData.courseId,
        courseData.courseVersionId,
        courseData.modules[0].moduleId,
        courseData.modules[0].sections[0].sectionId,
        courseData.modules[0].sections[0].items[0].itemId,
      );
      jest.setTimeout(30000);
    }, 100000);

    describe('Reset Entire Course Progress', () => {
      describe('Success Scenario', () => {
        it('should reset progress correctly for a user in a course', async () => {
          // Start Stop and Update Progress
          const {startItemResponse, stopItemResponse, updateProgressResponse} =
            await startStopAndUpdateProgress({
              userId: user.id,
              courseId: courseData.courseId,
              courseVersionId: courseData.courseVersionId,
              itemId: courseData.modules[0].sections[0].items[0].itemId,
              moduleId: courseData.modules[0].moduleId,
              sectionId: courseData.modules[0].sections[0].sectionId,
              app,
            });

          await verifyProgressInDatabase({
            userId: user.id,
            courseId: courseData.courseId,
            courseVersionId: courseData.courseVersionId,
            expectedModuleId: courseData.modules[0].moduleId,
            expectedSectionId: courseData.modules[0].sections[0].sectionId,
            expectedItemId: courseData.modules[0].sections[0].items[1].itemId,
            expectedCompleted: false,
            app,
          });

          // Reset the progress
          const resetResponse = await request(app).patch(
            `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
          );

          expect(resetResponse.status).toBe(200);
          expect(resetResponse.body).toBe('');

          await verifyProgressInDatabase({
            userId: user.id,
            courseId: courseData.courseId,
            courseVersionId: courseData.courseVersionId,
            expectedModuleId: courseData.modules[0].moduleId,
            expectedSectionId: courseData.modules[0].sections[0].sectionId,
            expectedItemId: courseData.modules[0].sections[0].items[0].itemId,
            expectedCompleted: false,
            app,
          });
        }, 100000);
      });
    });

    describe('Reset Progress to Module', () => {
      describe('Success Scenario', () => {
        it('should reset progress to module for a user in a course', async () => {
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody);

          expect(resetResponse.status).toBe(200);
          expect(resetResponse.body).toBe('');

          await verifyProgressInDatabase({
            userId: user.id,
            courseId: courseData.courseId,
            courseVersionId: courseData.courseVersionId,
            expectedModuleId: courseData.modules[1].moduleId,
            expectedSectionId: courseData.modules[1].sections[0].sectionId,
            expectedItemId: courseData.modules[1].sections[0].items[0].itemId,
            expectedCompleted: false,
            app,
          });
        }, 100000);
      });

      describe('Failure Scenarios', () => {
        it('should throw error message if moduleId is not in course', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Module not found in the specified course version.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);
      });
    });

    describe('Reset Progress to Section', () => {
      describe('Success Scenario', () => {
        it('should reset progress to section correctly for a user in a course', async () => {
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
            sectionId: courseData.modules[1].sections[1].sectionId,
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody);

          expect(resetResponse.status).toBe(200);
          expect(resetResponse.body).toBe('');

          await verifyProgressInDatabase({
            userId: user.id,
            courseId: courseData.courseId,
            courseVersionId: courseData.courseVersionId,
            expectedModuleId: courseData.modules[1].moduleId,
            expectedSectionId: courseData.modules[1].sections[1].sectionId,
            expectedItemId: courseData.modules[1].sections[1].items[0].itemId,
            expectedCompleted: false,
            app,
          });
        }, 100000);
      });

      describe('Failure Scenarios', () => {
        it('should throw error message if both moduleId and sectionId are invalid', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: faker.database.mongodbObjectId(),
            sectionId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Module not found in the specified course version.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);

        it('should throw error message if sectionId is not in module', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
            sectionId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Section not found in the specified module.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);
      });
    });

    describe('Reset Progress to Item', () => {
      describe('Success Scenario', () => {
        it('should reset progress to item correctly for a user in a course', async () => {
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
            sectionId: courseData.modules[1].sections[1].sectionId,
            itemId: courseData.modules[1].sections[1].items[2].itemId,
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody);

          expect(resetResponse.status).toBe(200);
          expect(resetResponse.body).toBe('');

          await verifyProgressInDatabase({
            userId: user.id,
            courseId: courseData.courseId,
            courseVersionId: courseData.courseVersionId,
            expectedModuleId: courseData.modules[1].moduleId,
            expectedSectionId: courseData.modules[1].sections[1].sectionId,
            expectedItemId: courseData.modules[1].sections[1].items[2].itemId,
            expectedCompleted: false,
            app,
          });
        }, 100000);
      });

      describe('Failure Scenarios', () => {
        it('should throw error message if moduleId, sectionId and itemId are invalid', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: faker.database.mongodbObjectId(),
            sectionId: faker.database.mongodbObjectId(),
            itemId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Module not found in the specified course version.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);

        it('should throw error message if sectionId is invalid/not in course', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
            sectionId: faker.database.mongodbObjectId(),
            itemId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Section not found in the specified module.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);

        it('should throw error message if itemId is invalid/not in section', async () => {
          // Reset to module
          const resetBody: ResetCourseProgressBody = {
            moduleId: courseData.modules[1].moduleId,
            sectionId: courseData.modules[1].sections[1].sectionId,
            itemId: faker.database.mongodbObjectId(),
          };

          // Reset the progress
          const resetResponse = await request(app)
            .patch(
              `/users/${user.id}/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/reset`,
            )
            .send(resetBody)
            .expect(404);

          const expectedResponse = {
            name: 'NotFoundError',
            message: 'Item not found in the specified section.',
          };

          expect(resetResponse.body).toMatchObject(expectedResponse);
        }, 100000);
      });
    });
  });

  describe('Student Progress Simulation', () => {
    it('should simulate student completing the course item by item, section by section, and module by module', async () => {
      // Create a course with modules, sections, and items
      courseData = await createCourseWithModulesSectionsAndItems(3, 2, 3, app);

      // Create a user
      user = await createUser(app);

      // Create enrollment
      await createEnrollment(
        app,
        user.id,
        courseData.courseId,
        courseData.courseVersionId,
        courseData.modules[0].moduleId,
        courseData.modules[0].sections[0].sectionId,
        courseData.modules[0].sections[0].items[0].itemId,
      );

      // Start, Stop and Update Progress for each item in the course, section by section, module by module
      for (
        let moduleIndex = 0;
        moduleIndex < courseData.modules.length;
        moduleIndex++
      ) {
        const module = courseData.modules[moduleIndex];

        for (
          let sectionIndex = 0;
          sectionIndex < module.sections.length;
          sectionIndex++
        ) {
          const section = module.sections[sectionIndex];

          for (
            let itemIndex = 0;
            itemIndex < section.items.length;
            itemIndex++
          ) {
            const item = section.items[itemIndex];
            await startStopAndUpdateProgress({
              userId: user.id,
              courseId: courseData.courseId,
              courseVersionId: courseData.courseVersionId,
              itemId: item.itemId,
              moduleId: module.moduleId,
              sectionId: section.sectionId,
              app,
            });
          }
        }
      }

      // After completing all items in the course, verify the course completion
      await verifyProgressInDatabase({
        userId: user.id,
        courseId: courseData.courseId,
        courseVersionId: courseData.courseVersionId,
        expectedModuleId:
          courseData.modules[courseData.modules.length - 1].moduleId, // Last module of the course
        expectedSectionId:
          courseData.modules[courseData.modules.length - 1].sections[
            courseData.modules[courseData.modules.length - 1].sections.length -
              1
          ].sectionId, // Last section
        expectedItemId:
          courseData.modules[courseData.modules.length - 1].sections[
            courseData.modules[courseData.modules.length - 1].sections.length -
              1
          ].items[
            courseData.modules[courseData.modules.length - 1].sections[
              courseData.modules[courseData.modules.length - 1].sections
                .length - 1
            ].items.length - 1
          ].itemId, // Last item
        expectedCompleted: true, // Course is completed after all modules are done
        app,
      });
    }, 100000);
  });
});
