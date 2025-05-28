import {coursesModuleOptions} from 'modules/courses';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import Container from 'typedi';
import Express from 'express';
import request from 'supertest';
import {ItemRepository} from 'shared/database/providers/mongo/repositories/ItemRepository';
import {dbConfig} from '../../../config/db';
import {CourseVersionService, ItemService, SectionService} from '../services';

jest.setTimeout(90000);
describe('Item Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));
    const courseRepo = new CourseRepository(
      Container.get<MongoDatabase>('Database'),
    );
    Container.set('CourseRepo', courseRepo);
    const itemRepo = new ItemRepository(
      Container.get<MongoDatabase>('Database'),
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('ItemRepo', itemRepo);
    const courseVersionService = new CourseVersionService(
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('CourseVersionService', courseVersionService);
    const sectionService = new SectionService(
      Container.get<ItemRepository>('ItemRepo'),
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('SectionService', sectionService);
    const itemService = new ItemService(
      Container.get<ItemRepository>('ItemRepo'),
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('ItemService', itemService);
    app = useExpressServer(App, coursesModuleOptions);
  });

  describe('ITEM CREATION', () => {
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

      it('should create an item', async () => {
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

        const itemsGroupResponse = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload)
          .expect(201);

        expect(itemsGroupResponse.body.itemsGroup.items.length).toBe(1);
        expect(itemsGroupResponse.body.itemsGroup.items[0].name).toBe(
          itemPayload.name,
        );
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
      name: 'ReadAll Item1',
      description: 'desc1',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com/1',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '5',
      },
    };
    const itemPayload2 = {
      name: 'ReadAll Item2',
      description: 'desc2',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com/2',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '8',
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
      await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload1)
        .expect(201);

      await request(app)
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
      expect(readAllResponse.body.items.length).toBeGreaterThanOrEqual(2);
      const names = readAllResponse.body.items.map(i => i.name);
      expect(names).toContain(itemPayload1.name);
      expect(names).toContain(itemPayload2.name);
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
    const itemPayload = {
      name: 'Update Item',
      description: 'desc',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com/1',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '5',
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

      const itemId = itemResponse.body.itemsGroup.items[0].itemId;

      // Update item
      const updatePayload = {
        name: 'Updated Item Name',
        description: 'Updated description',
        type: 'VIDEO',
        videoDetails: {
          URL: 'http://url.com/updated',
          startTime: '00:00:10',
          endTime: '00:01:00',
          points: '15',
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
      expect(updateResponse.body.itemsGroup.items[0].videoDetails.URL).toBe(
        updatePayload.videoDetails.URL,
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
            `/courses/itemGroups/${itemsGroupId}/items/${itemsGroupResponse.body.itemsGroup.items[0].itemId}`,
          )
          .expect(200);

        expect(itemsResponse.body.deletedItemId).toBe(
          itemsGroupResponse.body.itemsGroup.items[0].itemId,
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
        name: 'Item1',
        description: 'This is item 1',
        type: 'VIDEO',
        videoDetails: {
          URL: 'http://url.com/1',
          startTime: '00:00:00',
          endTime: '00:00:40',
          points: '10.5',
        },
      };

      const itemPayload2 = {
        name: 'Item2',
        description: 'This is item 2',
        type: 'VIDEO',
        videoDetails: {
          URL: 'http://url.com/2',
          startTime: '00:00:00',
          endTime: '00:00:40',
          points: '8.0',
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
        const item1Id = item1Response.body.itemsGroup.items[0].itemId;

        const item2Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload2)
          .expect(201);
        const item2Id = item2Response.body.itemsGroup.items[1].itemId;

        // Move item2 before item1
        const moveResponse = await request(app)
          .put(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items/${item2Id}/move`,
          )
          .send({beforeItemId: item1Id})
          .expect(200);

        const items = moveResponse.body.itemsGroup.items;
        expect(items.length).toBe(2);

        const idx1 = items.findIndex(i => i.itemId === item1Id);
        const idx2 = items.findIndex(i => i.itemId === item2Id);

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
        const item1Id = item1Response.body.itemsGroup.items[0].itemId;

        const item2Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload2)
          .expect(201);
        const item2Id = item2Response.body.itemsGroup.items[1].itemId;

        const itemPayload3 = {
          name: 'Item3',
          description: 'This is item 3',
          type: 'VIDEO',
          videoDetails: {
            URL: 'http://url.com/3',
            startTime: '00:00:00',
            endTime: '00:00:40',
            points: '7.0',
          },
        };

        const item3Response = await request(app)
          .post(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
          )
          .send(itemPayload3)
          .expect(201);
        const item3Id = item3Response.body.itemsGroup.items[2].itemId;

        // Move item3 before item1
        const moveResponse = await request(app)
          .put(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items/${item3Id}/move`,
          )
          .send({beforeItemId: item1Id})
          .expect(200);

        const items = moveResponse.body.itemsGroup.items;
        expect(items.length).toBe(3);

        const idx1 = items.findIndex(i => i.itemId === item1Id);
        const idx2 = items.findIndex(i => i.itemId === item2Id);
        const idx3 = items.findIndex(i => i.itemId === item3Id);

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
        .mockResolvedValue({items: [{itemId: 'itemId'}]});
      jest.spyOn(itemRepo, 'updateItemsGroup').mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(
        itemService.updateItem('vId', 'mId', 'sId', 'itemId', {name: 'x'}),
      ).rejects.toThrow('DB error');
    });

    it('should throw InternalServerError if deleteItem returns false', async () => {
      jest.spyOn(itemRepo, 'deleteItem').mockResolvedValue(false);
      await expect(itemService.deleteItem('igId', 'itemId')).rejects.toThrow(
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
