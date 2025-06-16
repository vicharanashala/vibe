import { coursesModuleOptions, setupCoursesContainer } from '../index.js';
import {
  useExpressServer
} from 'routing-controllers';
import Express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { CourseData, createCourseWithModulesSectionsAndItems } from '#root/modules/users/tests/utils/createCourse.js';
import { faker } from '@faker-js/faker';
import { before } from 'node:test';


describe('Module Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await setupCoursesContainer();
    app = useExpressServer(App, coursesModuleOptions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  // Tests for creating a module
  describe('MODULE CREATION', () => {
    describe('Success Scenario', () => {
      it('should create a module', async () => {
        const coursePayload = {
          name: 'Module Creation Course',
          description: 'Course description',
        };
        const courseVersionPayload = {
          version: 'Module Creation Version',
          description: 'Course version description',
        };
        const modulePayload = {
          name: 'Module Creation Module',
          description: 'Module description',
        };

        // Create a course
        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

        // Get course id
        const courseId = response.body._id;

        // Create a version
        const versionResponse = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(courseVersionPayload)
          .expect(201);

        // Get version id
        const versionId = versionResponse.body._id;

        // Create a module
        // Log the endpoint to request to
        const endPoint = `/courses/versions/${versionId}/modules`;

        const moduleResponse = await request(app)
          .post(endPoint)
          .send(modulePayload)
          .expect(201);

        // Extract the moduleId of the created module
        const createdModule = moduleResponse.body.version.modules.find(
          module =>
            module.name === 'Module Creation Module' &&
            module.description === 'Module description',
        );

        // Ensure that the module exists in the list
        expect(createdModule).toBeDefined();
        expect(createdModule).toMatchObject({
          name: 'Module Creation Module',
          description: 'Module description',
        });

        // Optionally, check if the moduleId and other properties match
        expect(createdModule.moduleId).toBeDefined();
        expect(createdModule.order).toBeDefined(); // Check if order exists
      }, 90000);
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
      }, 90000);

      it('should return 400 for invalid module data', async () => {
        // Create a course
        const coursePayload = {
          name: 'Error 400 Course',
          description: 'Course description',
        };

        const response = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);

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
          .expect(201);

        // Get version id

        const versionId = versionResponse.body.version._id;

        // Missing name field
        const invalidPayload = { name: '' }; // Missing required fields

        const moduleResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(invalidPayload)
          .expect(400);

        expect(moduleResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      }, 90000);

      it('should return 400 if module name is missing', async () => {
        const coursePayload = {
          name: 'Missing Name Course',
          description: 'desc',
        };
        const courseRes = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);
        const courseId = courseRes.body._id;
        const versionPayload = { version: 'v1', description: 'desc' };
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id;
        const modulePayload = { description: 'desc' }; // missing name
        await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(400);
      }, 90000);
    });
  });

  // Tests for moving a module
  describe('MODULE MOVE', () => {
    let data: CourseData;
    beforeAll(async () => {
      data = await createCourseWithModulesSectionsAndItems(2, 1, 1, app);
    });
    describe('Success Scenario', () => {
      it('should move a module before another module within a course version', async () => {
        // Arrange: Get two modules to work with
        const modules = data.modules;
        const moduleIdToMove = modules[1].moduleId; // Module we will move
        const targetModuleId = modules[0].moduleId;  // Module before which we'll move

        // Act: Request to move `moduleIdToMove` before `targetModuleId`
        const movePayload = { beforeModuleId: targetModuleId };
        const response = await request(app)
          .put(`/courses/versions/${data.courseVersionId}/modules/${moduleIdToMove}/move`)
          .send(movePayload)
          .expect(200);

        // Assert: Fetch the new order of modules
        const reorderedModules = response.body.version.modules
          .sort((a, b) => a.order.localeCompare(b.order));

        // Find new indices of both modules
        const targetIdx = reorderedModules.findIndex(m => m.moduleId === targetModuleId);
        const movedIdx = reorderedModules.findIndex(m => m.moduleId === moduleIdToMove);

        // The moved module should now be before the target module
        expect(movedIdx).toBeLessThan(targetIdx);
      });
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid move parameters', async () => {
        // Arrange: Use clearly invalid IDs
        const movePayload = { beforeModuleId: 'invalid' };

        // Act & Assert: Should return 400 Bad Request
        await request(app)
          .put('/courses/versions/invalidVersion/modules/invalidModule/move')
          .send(movePayload)
          .expect(400);
      });

      it('should return 404 if the module to move does not exist', async () => {
        // Arrange: Use valid version ID but a random non-existent module ID
        const nonExistentModuleId = faker.database.mongodbObjectId();

        // Act & Assert: Should return 404 Not Found
        await request(app)
          .put(`/courses/versions/${data.courseVersionId}/modules/${nonExistentModuleId}/move`)
          .send({ beforeModuleId: faker.database.mongodbObjectId() })
          .expect(404);
      });

      it('should return 400 if neither beforeModuleId nor afterModuleId is provided', async () => {
        // Arrange: No move parameter provided
        const validModuleId = data.modules[0].moduleId;

        // Act & Assert: Should return 400 Bad Request
        const response = await request(app)
          .put(`/courses/versions/${data.courseVersionId}/modules/${validModuleId}/move`)
          .send({})
          .expect(400);
      });

      it('should return 400 if both afterModuleId and beforeModuleId are present', async () => {
        // Arrange: Provide both params (invalid usage)
        const validModuleId = data.modules[0].moduleId;

        // Act & Assert: Should return 400 Bad Request
        await request(app)
          .put(`/courses/versions/${data.courseVersionId}/modules/${validModuleId}/move`)
          .send({
            beforeModuleId: faker.database.mongodbObjectId(),
            afterModuleId: faker.database.mongodbObjectId(),
          })
          .expect(400);
      });

    });
  });

  // Tests for deleting a module
  describe('MODULE DELETE', () => {
    describe('Success Scenario', () => {
      it('should delete a module', async () => {
        const coursePayload = {
          name: 'Module Delete Course',
          description: 'Course description',
        };
        const versionPayload = {
          version: 'Module Delete Version',
          description: 'Version description',
        };
        const modulePayload = {
          name: 'Module Delete Module',
          description: 'Desc',
        };

        // Create a course
        const courseRes = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);
        const courseId = courseRes.body._id;

        // Create a version
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id || versionRes.body.version._id;

        // Create a module
        const moduleRes = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);
        const moduleId = moduleRes.body.version.modules[0].moduleId;

        // Delete the module
        const deleteRes = await request(app)
          .delete(`/courses/versions/${versionId}/modules/${moduleId}`)
          .expect(200);

        expect(deleteRes.body.message).toContain(`Module ${moduleId} deleted`);
      }, 90000);
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid delete params', async () => {
        await request(app)
          .delete('/courses/versions/invalidVersion/modules/invalidModule')
          .expect(400);
      }, 90000);
      it('should return 404 if module does not exist', async () => {
        const fakeVersionId = '60d21b4667d0d8992e610c85';
        const fakeModuleId = '60d21b4967d0d8992e610c86';
        await request(app)
          .delete(`/courses/versions/${fakeVersionId}/modules/${fakeModuleId}`)
          .expect(404);
      }, 90000);
    });
  });

  // Tests for updating a module
  describe('MODULE UPDATE', () => {
    describe('Success Scenario', () => {
      it("should update a module's name and description", async () => {
        const coursePayload = {
          name: 'Module Update Course',
          description: 'Course description',
        };
        const versionPayload = {
          version: 'Module Update Version',
          description: 'Module Update Desc',
        };
        const modulePayload = {
          name: 'Module Update Old',
          description: 'Old Desc',
        };

        // Create a course
        const courseRes = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);
        const courseId = courseRes.body._id;

        // Create a version
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id || versionRes.body.version._id;

        // Create a module
        const moduleRes = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);
        const moduleId = moduleRes.body.version.modules[0].moduleId;

        // Update the module
        const updatePayload = {
          name: 'Updated Module',
          description: 'Updated Desc',
        };
        const updateRes = await request(app)
          .put(`/courses/versions/${versionId}/modules/${moduleId}`)
          .send(updatePayload)
          .expect(200);

        const updatedModule = updateRes.body.version.modules.find(
          m => m.moduleId === moduleId,
        );
        expect(updatedModule).toBeDefined();
        expect(updatedModule.name).toBe('Updated Module');
        expect(updatedModule.description).toBe('Updated Desc');
      }, 90000);
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid update params', async () => {
        await request(app)
          .put('/courses/versions/invalidVersion/modules/invalidModule')
          .send({ name: 'x' })
          .expect(400);
      }, 90000);
      it('should return 404 if module to update does not exist', async () => {
        const fakeVersionId = '60d21b4667d0d8992e610c85';
        const fakeModuleId = '60d21b4967d0d8992e610c86';
        await request(app)
          .put(`/courses/versions/${fakeVersionId}/modules/${fakeModuleId}`)
          .send({ name: 'x', description: 'y' })
          .expect(404);
      }, 90000);

      it('should return 400 if update payload is invalid', async () => {
        const coursePayload = {
          name: 'Update Error Course',
          description: 'desc',
        };
        const courseRes = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);
        const courseId = courseRes.body._id;
        const versionPayload = { version: 'v1', description: 'desc' };
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id;
        const modulePayload = {
          name: 'Update Error Module',
          description: 'desc',
        };
        const moduleRes = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);
        const moduleId = moduleRes.body.version.modules[0].moduleId;
        await request(app)
          .put(`/courses/versions/${versionId}/modules/${moduleId}`)
          .send({ name: '' })
          .expect(400);
      }, 90000);
    });
  });

  describe('MODULE SERVICE ERROR PATHS', () => {
    let courseId: string;
    let versionId: string;
    let moduleId: string;

    beforeEach(async () => {
      // Create a course and version for each test
      const coursePayload = { name: 'Error Path Course', description: 'desc' };
      const courseRes = await request(app)
        .post('/courses/')
        .send(coursePayload)
        .expect(201);
      courseId = courseRes.body._id;

      const versionPayload = { version: 'v1', description: 'desc' };
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send(versionPayload)
        .expect(201);
      versionId = versionRes.body._id || versionRes.body.version._id;

      const modulePayload = { name: 'mod', description: 'desc' };
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send(modulePayload)
        .expect(201);
      moduleId = moduleRes.body.version.modules[0].moduleId;
    });

    it('should return 400 if both afterModuleId and beforeModuleId are missing in moveModule', async () => {
      await request(app)
        .put(`/courses/versions/${versionId}/modules/${moduleId}/move`)
        .send({})
        .expect(400);
    }, 90000);

    it('should return 404 if module does not exist on moveModule', async () => {
      await request(app)
        .put(
          `/courses/versions/${versionId}/modules/62341aeb5be816967d8fc2db/move`,
        )
        .send({ beforeModuleId: '62341aeb5be816967d8fc2db' })
        .expect(404);
    }, 90000);

    it('should return 404 if module does not exist on moveModule', async () => {
      await request(app)
        .put(
          '/courses/versions/62341aeb5be816967d8fc2db/modules/62341aeb5be816967d8fc2db/move',
        )
        .send({ beforeModuleId: '62341aeb5be816967d8fc2db' })
        .expect(404);
    }, 90000);

    it('should return 404 for non existant course version', async () => {
      await request(app)
        .delete(
          '/courses/versions/62341aeb5be816967d8fc2db/modules/62341aeb5be816967d8fc2db',
        )
        .expect(404);
    }, 90000);

    it('should return 404 if module does not exist on deleteModule', async () => {
      await request(app)
        .delete(
          `/courses/versions/${versionId}/modules/62341aeb5be816967d8fc2db`,
        )
        .expect(404);
    }, 90000);
  });
});
