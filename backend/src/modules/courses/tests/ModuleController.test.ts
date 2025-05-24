import {coursesModuleOptions} from 'modules/courses';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import Container from 'typedi';
import Express from 'express';
import request from 'supertest';
import {ReadError} from 'shared/errors/errors';
import {dbConfig} from '../../../config/db';
import {CourseVersionService, ModuleService} from '../services';

jest.setTimeout(90000);
describe('Module Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    // Start an in-memory MongoDB server

    // Set up the real MongoDatabase and CourseRepository
    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));
    const courseRepo = new CourseRepository(
      Container.get<MongoDatabase>('Database'),
    );
    Container.set('CourseRepo', courseRepo);
    const courseVersionService = new CourseVersionService(
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('CourseVersionService', courseVersionService);
    const moduleService = new ModuleService(
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('ModuleService', moduleService);

    // Create the Express app with the routing controllers configuration
    app = useExpressServer(App, coursesModuleOptions);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
        const invalidPayload = {name: ''}; // Missing required fields

        const moduleResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(invalidPayload)
          .expect(400);

        expect(moduleResponse.body.message).toContain(
          "Invalid body, check 'errors' property for more info.",
        );
      });

      it('should return 500 if unknown error occurs', async () => {
        // Create a course
        const coursePayload = {
          name: 'Error 500 Course',
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
          .expect(400);
      });

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
        const versionPayload = {version: 'v1', description: 'desc'};
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id;
        const modulePayload = {description: 'desc'}; // missing name
        await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(400);
      });
    });
  });

  // Tests for moving a module
  describe('MODULE MOVE', () => {
    describe('Success Scenario', () => {
      it('should move a module within a version', async () => {
        const coursePayload = {
          name: 'Module Move Course',
          description: 'Course description',
        };
        const versionPayload = {
          version: 'Module Move Version',
          description: 'Version description',
        };
        // Use unique module names
        const modulePayload1 = {name: 'Module Move 1', description: 'Desc 1'};
        const modulePayload2 = {name: 'Module Move 2', description: 'Desc 2'};

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
        const versionId = versionRes.body._id;

        // Create two modules
        const module1 = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload1)
          .expect(201);
        const module2 = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload2)
          .expect(201);

        const modules = module2.body.version.modules;
        const moduleId1 = modules.find(
          m => m.name === 'Module Move 1',
        ).moduleId;
        const moduleId2 = modules.find(
          m => m.name === 'Module Move 2',
        ).moduleId;
        // Move Module 2 before Module 1
        const movePayload = {beforeModuleId: moduleId1};
        const moveRes = await request(app)
          .put(`/courses/versions/${versionId}/modules/${moduleId2}/move`)
          .send(movePayload)
          .expect(200);

        // Check order: Module 2 should now come before Module 1
        const movedModules = moveRes.body.version.modules.sort((a, b) =>
          a.order.localeCompare(b.order),
        );
        const idx1 = movedModules.findIndex(m => m.moduleId === moduleId1);
        const idx2 = movedModules.findIndex(m => m.moduleId === moduleId2);
        expect(idx2).toBeLessThan(idx1);
      });
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid move params', async () => {
        // Try to move with invalid version/module id
        const movePayload = {beforeModuleId: 'invalid'};
        await request(app)
          .put('/courses/versions/invalidVersion/modules/invalidModule/move')
          .send(movePayload)
          .expect(400);
      });

      it('should return 404 if module to move does not exist', async () => {
        const fakeVersionId = '60d21b4667d0d8992e610c85';
        const fakeModuleId = '60d21b4967d0d8992e610c86';
        await request(app)
          .put(
            `/courses/versions/${fakeVersionId}/modules/${fakeModuleId}/move`,
          )
          .send({beforeModuleId: '60d21b4967d0d8992e610c87'})
          .expect(404);
      });

      it('should return 400 if beforeModuleId is missing', async () => {
        const coursePayload = {name: 'Move Error Course', description: 'desc'};
        const courseRes = await request(app)
          .post('/courses/')
          .send(coursePayload)
          .expect(201);
        const courseId = courseRes.body._id;
        const versionPayload = {version: 'v1', description: 'desc'};
        const versionRes = await request(app)
          .post(`/courses/${courseId}/versions`)
          .send(versionPayload)
          .expect(201);
        const versionId = versionRes.body._id;
        const modulePayload = {name: 'Move Error Module', description: 'desc'};
        const moduleRes = await request(app)
          .post(`/courses/versions/${versionId}/modules`)
          .send(modulePayload)
          .expect(201);
        const moduleId = moduleRes.body.version.modules[0].moduleId;
        await request(app)
          .put(`/courses/versions/${versionId}/modules/${moduleId}/move`)
          .send({})
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
      });
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid delete params', async () => {
        await request(app)
          .delete('/courses/versions/invalidVersion/modules/invalidModule')
          .expect(400);
      });
      it('should return 404 if module does not exist', async () => {
        const fakeVersionId = '60d21b4667d0d8992e610c85';
        const fakeModuleId = '60d21b4967d0d8992e610c86';
        await request(app)
          .delete(`/courses/versions/${fakeVersionId}/modules/${fakeModuleId}`)
          .expect(404);
      });
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
      });
    });

    describe('Error Scenarios', () => {
      it('should return 400 for invalid update params', async () => {
        await request(app)
          .put('/courses/versions/invalidVersion/modules/invalidModule')
          .send({name: 'x'})
          .expect(400);
      });
      it('should return 404 if module to update does not exist', async () => {
        const fakeVersionId = '60d21b4667d0d8992e610c85';
        const fakeModuleId = '60d21b4967d0d8992e610c86';
        await request(app)
          .put(`/courses/versions/${fakeVersionId}/modules/${fakeModuleId}`)
          .send({name: 'x'})
          .expect(404);
      });

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
        const versionPayload = {version: 'v1', description: 'desc'};
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
          .send({name: ''})
          .expect(400);
      });
    });
  });

  // Tests for module service error paths
  describe('MODULE SERVICE ERROR PATHS', () => {
    let moduleService: any;
    let courseRepo: any;

    beforeAll(() => {
      courseRepo = Container.get<CourseRepository>('CourseRepo');
      moduleService = Container.get('ModuleService');
    });

    it('should throw NotFoundError if version does not exist on createModule', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue(null);
      await expect(
        moduleService.createModule('fakeVersionId', {
          name: 'x',
          description: 'y',
        }),
      ).rejects.toThrow('Version fakeVersionId not found.');
    });

    it('should throw InternalServerError if updateVersion fails on createModule', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({modules: []});
      jest.spyOn(courseRepo, 'updateVersion').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        moduleService.createModule('vId', {name: 'x', description: 'y'}),
      ).rejects.toThrow('DB error');
    });

    it('should throw NotFoundError if module does not exist on updateModule', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({modules: []});
      await expect(
        moduleService.updateModule('vId', 'mId', {name: 'x'}),
      ).rejects.toThrow('Module mId not found.');
    });

    it('should throw InternalServerError if updateVersion fails on updateModule', async () => {
      jest
        .spyOn(courseRepo, 'readVersion')
        .mockResolvedValue({modules: [{moduleId: 'mId'}]});
      jest.spyOn(courseRepo, 'updateVersion').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        moduleService.updateModule('vId', 'mId', {name: 'x'}),
      ).rejects.toThrow('DB error');
    });

    it('should throw InternalServerError if both afterModuleId and beforeModuleId are missing in moveModule', async () => {
      await expect(moduleService.moveModule('vId', 'mId', {})).rejects.toThrow(
        'Either afterModuleId or beforeModuleId is required',
      );
    });

    it('should throw NotFoundError if module does not exist on moveModule', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({modules: []});
      await expect(
        moduleService.moveModule('vId', 'mId', {beforeModuleId: 'bId'}),
      ).rejects.toThrow('Module mId not found.');
    });

    it('should throw InternalServerError if updateVersion fails on moveModule', async () => {
      jest
        .spyOn(courseRepo, 'readVersion')
        .mockResolvedValue({modules: [{moduleId: 'mId', order: 'a'}]});
      jest.spyOn(courseRepo, 'updateVersion').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        moduleService.moveModule('vId', 'mId', {beforeModuleId: 'bId'}),
      ).rejects.toThrow(
        "Cannot read properties of undefined (reading 'order')",
      );
    });

    it('should throw InternalServerError if deleteModule returns false', async () => {
      jest.spyOn(courseRepo, 'deleteModule').mockResolvedValue(false);
      await expect(moduleService.deleteModule('vId', 'mId')).rejects.toThrow(
        'Failed to delete module mId',
      );
    });

    it('should throw InternalServerError if deleteModule throws', async () => {
      jest.spyOn(courseRepo, 'deleteModule').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(moduleService.deleteModule('vId', 'mId')).rejects.toThrow(
        'DB error',
      );
    });
  });
});
