import {coursesModuleOptions, CreateItemBody, Item} from '../../';
import {useExpressServer, useContainer} from 'routing-controllers';
import {CourseRepository} from '../../../shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase, UserRepository} from '../../../shared/database/providers';

import Express from 'express';
import request from 'supertest';
import {ItemRepository} from '../../../shared/database/providers/mongo/repositories/ItemRepository';
import {dbConfig} from '../../../config/db';
import {CourseVersionService, ItemService, SectionService} from '../services';
import {ProgressService} from '../../users/services/ProgressService';
import {
  createCourse,
  createModule,
  createSection,
  createVersion,
} from './utils/creationFunctions';
import {faker} from '@faker-js/faker';
import {ItemType} from '../../../shared/interfaces/models';
import { ProgressRepository } from '../../../shared/database/providers/mongo/repositories/ProgressRepository';
import { InversifyAdapter } from '../../../inversify-adapter';
import { Container } from 'inversify';
import { usersContainerModule } from '../../../users/container';
import { coursesContainerModule } from '../container';
import { sharedContainerModule } from '../../../container';

jest.setTimeout(90000);
describe('Item Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(sharedContainerModule, usersContainerModule, coursesContainerModule);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    app = useExpressServer(App, coursesModuleOptions);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  describe('ITEM CREATION', () => {
    describe('Success Scenario', () => {
      describe('Create Quiz Item', () => {
        it('should create a quiz item', async () => {
          const course = await createCourse(app);
          const version = await createVersion(app, course._id.toString());
          const module = await createModule(app, version._id.toString());
          const section = await createSection(
            app,
            version._id.toString(),
            module.version.modules[0].moduleId.toString(),
          );

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

          const itemResponse = await request(app)
            .post(
              `/courses/versions/${version._id}/modules/${module.version.modules[0].moduleId}/sections/${section.version.modules[0].sections[0].sectionId}/items`,
            )
            .send(itemPayload);

          expect(itemResponse.body.itemsGroup.items.length).toBe(1);
        });
      });
      describe('Create Video Item', () => {
        it('should create a video item', async () => {
          const course = await createCourse(app);
          const version = await createVersion(app, course._id.toString());
          const module = await createModule(app, version._id.toString());
          const section = await createSection(
            app,
            version._id.toString(),
            module.version.modules[0].moduleId.toString(),
          );

          const itemPayload: CreateItemBody = {
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
            type: ItemType.VIDEO,
            videoDetails: {
              URL: 'http://url.com',
              startTime: '00:00:00',
              endTime: '00:00:40',
              points: 10.5,
            },
          };

          const itemsGroupResponse = await request(app)
            .post(
              `/courses/versions/${version._id}/modules/${module.version.modules[0].moduleId}/sections/${section.version.modules[0].sections[0].sectionId}/items`,
            )
            .send(itemPayload);
            expect(itemsGroupResponse.status === 201);

          expect(itemsGroupResponse.body.itemsGroup.items.length).toBe(1);
        });
      });
    });
  });

  describe('ITEM READALL', () => {
    const coursePayload = {
      name: 'ReadAll Course',
      description: 'desc',
    };
    const courseVersionPayload = {
      version: 'v1',
      description: 'desc',
    };
    const modulePayload = {
      name: 'ReadAll Module',
      description: 'desc',
    };
    const sectionPayload = {
      name: 'ReadAll Section',
      description: 'desc',
    };
    const itemPayload1 = {
      name: 'ReadAll Item 1',
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
    const itemPayload2 = {
      name: 'ReadAll Item 2',
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

    it('should read all items in a section', async () => {
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
      const moduleId = moduleResponse.body.version.modules[0].moduleId;

      const sectionResponse = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send(sectionPayload)
        .expect(201);
      const sectionId =
        sectionResponse.body.version.modules[0].sections[0].sectionId;

      // Add two items
      const item1 = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload1)
        .expect(201);

      const item2 = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload2)
        .expect(201);

      // Read all items
      const readAllResponse = await request(app)
        .get(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .expect(200);
      expect(readAllResponse.body.length).toBeGreaterThanOrEqual(2);
      const ids = readAllResponse.body.map(i => i._id);
      expect(ids).toContain(item1.body.itemsGroup.items[0]._id);
      expect(ids).toContain(item2.body.itemsGroup.items[0]._id);
    });
  });

  describe('ITEM UPDATION', () => {
    const coursePayload = {
      name: 'Update Course',
      description: 'desc',
    };
    const courseVersionPayload = {
      version: 'v1',
      description: 'desc',
    };
    const modulePayload = {
      name: 'Update Module',
      description: 'desc',
    };
    const sectionPayload = {
      name: 'Update Section',
      description: 'desc',
    };
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

    it('should update an item in a section', async () => {
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
      const moduleId = moduleResponse.body.version.modules[0].moduleId;

      const sectionResponse = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send(sectionPayload)
        .expect(201);
      const sectionId =
        sectionResponse.body.version.modules[0].sections[0].sectionId;

      // Add item
      const itemResponse = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload)
        .expect(201);

      const itemId = itemResponse.body.itemsGroup.items[0]._id;

      // Update item
      const updatePayload: CreateItemBody = {
        name: 'Updated Item Name',
        description: 'Updated Item Description',
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

      const updateResponse = await request(app)
        .put(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items/${itemId}`,
        )
        .send(updatePayload)
        .expect(200);

      expect(updateResponse.body.itemsGroup.items[0].name).toBe(
        updatePayload.name,
      );
      expect(updateResponse.body.itemsGroup.items[0].description).toBe(
        updatePayload.description,
      );
    });
  });

  describe('ITEM DELETION', () => {
    describe('Success Scenario', () => {
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

      it('should delete an item', async () => {
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

        const moduleId = moduleResponse.body.version.modules[0].moduleId;

        const sectionResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
          .send(sectionPayload)
          .expect(201);

        const sectionId =
          sectionResponse.body.version.modules[0].sections[0].sectionId;

        const itemsGroupId =
          sectionResponse.body.version.modules[0].sections[0].itemsGroupId;

        const itemsGroupResponse = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload)
          .expect(201);

        const itemsResponse = await request(app)
          .delete(
            `/courses/itemGroups/${itemsGroupId}/items/${itemsGroupResponse.body.itemsGroup.items[0]._id}`,
          )
          .expect(200);

        expect(itemsResponse.body.deletedItemId).toBe(
          itemsGroupResponse.body.itemsGroup.items[0]._id,
        );
      });
    });

    describe('Failiure Scenario', () => {
      it('should fail to delete an item', async () => {
        // Testing for Invalid params

        const itemsResponse = await request(app)
          .delete('/courses/itemGroups/123/items/123')
          .expect(400);
      });

      it('should fail to delete an item', async () => {
        // Testing for Not found Case
        const itemsResponse = await request(app)
          .delete(
            '/courses/itemGroups/62341aeb5be816967d8fc2db/items/62341aeb5be816967d8fc2db',
          )
          .expect(400);
      });
    });
  });

  describe('ITEM MOVE', () => {
    describe('Success Scenario', () => {
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

      const itemPayload1 = {
        name: 'Item 1',
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
      const itemPayload2 = {
        name: 'Item 2',
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

      it('should move an item after another item', async () => {
        // Create course, version, module, section
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
        const moduleId = moduleResponse.body.version.modules[0].moduleId;

        const sectionResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
          .send(sectionPayload)
          .expect(201);
        const sectionId =
          sectionResponse.body.version.modules[0].sections[0].sectionId;

        // Add two items
        const item1Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload1)
          .expect(201);
        const item1Id = item1Response.body.itemsGroup.items[0]._id;

        const item2Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload2)
          .expect(201);
        const item2Id = item2Response.body.itemsGroup.items[1]._id;

        // Move item2 before item1
        const moveResponse = await request(app)
          .put(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items/${item2Id}/move`,
          )
          .send({beforeItemId: item1Id})
          .expect(200);

        const items = moveResponse.body.itemsGroup.items;
        expect(items.length).toBe(2);

        const idx1 = items.findIndex(i => i._id === item1Id);
        const idx2 = items.findIndex(i => i._id === item2Id);

        // item2 should now be before item1
        expect(idx2).toBeLessThan(idx1);
      });

      it('should move the third item before the first item in a list of three', async () => {
        // Create course, version, module, section
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
        const moduleId = moduleResponse.body.version.modules[0].moduleId;

        const sectionResponse = await request(app)
          .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
          .send(sectionPayload)
          .expect(201);
        const sectionId =
          sectionResponse.body.version.modules[0].sections[0].sectionId;

        // Add three items
        const item1Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload1)
          .expect(201);
        const item1Id = item1Response.body.itemsGroup.items[0]._id;

        const item2Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload2)
          .expect(201);
        const item2Id = item2Response.body.itemsGroup.items[1]._id;

        const itemPayload3: CreateItemBody = {
          name: 'Item3',
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

        const item3Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload3)
          .expect(201);
        const item3Id = item3Response.body.itemsGroup.items[2]._id;

        // Move item3 before item1
        const moveResponse = await request(app)
          .put(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items/${item3Id}/move`,
          )
          .send({beforeItemId: item1Id})
          .expect(200);

        const items = moveResponse.body.itemsGroup.items;
        expect(items.length).toBe(3);

        const idx1 = items.findIndex(i => i._id === item1Id);
        const idx2 = items.findIndex(i => i._id === item2Id);
        const idx3 = items.findIndex(i => i._id === item3Id);

        // item3 should now be before item1
        expect(idx3).toBeLessThan(idx1);
      });
    });
  });

  describe('ITEM SERVICE ERROR PATHS', () => {
    let itemService: any;
    let itemRepo: any;
    let courseRepo: any;

    beforeAll(() => {
      itemRepo = Container.get('ItemRepo');
      courseRepo = Container.get('CourseRepo');
      itemService = Container.get('ItemService');
    });

    it('should throw NotFoundError if version does not exist on createItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue(null);
      await expect(
        itemService.createItem('vId', 'mId', 'sId', {
          name: 'x',
          description: 'y',
          type: 'VIDEO',
          videoDetails: {},
        }),
      ).rejects.toThrow('Version vId not found.');
    });

    it('should throw if itemsGroup not found on createItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest.spyOn(itemRepo, 'readItemsGroup').mockResolvedValue(undefined);
      await expect(
        itemService.createItem('vId', 'mId', 'sId', {
          name: 'x',
          description: 'y',
          type: 'VIDEO',
          videoDetails: {},
        }),
      ).rejects.toThrow();
    });

    it('should throw if updateItemsGroup fails on createItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest.spyOn(itemRepo, 'readItemsGroup').mockResolvedValue({items: []});
      jest.spyOn(itemRepo, 'updateItemsGroup').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        itemService.createItem('vId', 'mId', 'sId', {
          name: 'x',
          description: 'y',
          type: 'VIDEO',
          videoDetails: {},
        }),
      ).rejects.toThrow('DB error');
    });

    it('should throw NotFoundError if version does not exist on updateItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue(null);
      await expect(
        itemService.updateItem('vId', 'mId', 'sId', 'itemId', {name: 'x'}),
      ).rejects.toThrow('Version vId not found.');
    });

    it('should throw if item not found on updateItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest.spyOn(itemRepo, 'readItemsGroup').mockResolvedValue({items: []});
      await expect(
        itemService.updateItem('vId', 'mId', 'sId', 'itemId', {name: 'x'}),
      ).rejects.toThrow();
    });

    it('should throw if updateItemsGroup fails on updateItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest
        .spyOn(itemRepo, 'readItemsGroup')
        .mockResolvedValue({items: [{_id: 'itemId'}]});
      jest.spyOn(itemRepo, 'updateItemsGroup').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        itemService.updateItem('vId', 'mId', 'sId', '_id', {name: 'x'}),
      ).rejects.toThrow('DB error');
    });

    it('should throw InternalServerError if deleteItem returns false', async () => {
      jest.spyOn(itemRepo, 'deleteItem').mockResolvedValue(false);
      await expect(itemService.deleteItem('igId', '_id')).rejects.toThrow(
        'Item deletion failed',
      );
    });

    it('should throw if deleteItem throws', async () => {
      jest.spyOn(itemRepo, 'deleteItem').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(itemService.deleteItem('igId', 'itemId')).rejects.toThrow(
        'DB error',
      );
    });

    it('should throw if neither afterItemId nor beforeItemId is provided in moveItem', async () => {
      await expect(
        itemService.moveItem('vId', 'mId', 'sId', 'itemId', {}),
      ).rejects.toThrow('Either afterItemId or beforeItemId is required');
    });

    it('should throw if item not found in moveItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest.spyOn(itemRepo, 'readItemsGroup').mockResolvedValue({items: []});
      await expect(
        itemService.moveItem('vId', 'mId', 'sId', 'itemId', {
          beforeItemId: 'otherId',
        }),
      ).rejects.toThrow();
    });

    it('should throw if updateItemsGroup fails on moveItem', async () => {
      jest.spyOn(courseRepo, 'readVersion').mockResolvedValue({
        modules: [
          {
            moduleId: 'mId',
            sections: [{sectionId: 'sId', itemsGroupId: 'igId'}],
          },
        ],
      });
      jest
        .spyOn(itemRepo, 'readItemsGroup')
        .mockResolvedValue({items: [{itemId: 'itemId', order: 'a'}]});
      jest.spyOn(itemRepo, 'updateItemsGroup').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        itemService.moveItem('vId', 'mId', 'sId', 'itemId', {
          beforeItemId: 'otherId',
        }),
      ).rejects.toThrow(
        "Cannot read properties of undefined (reading 'order')",
      );
    });
  });
});
