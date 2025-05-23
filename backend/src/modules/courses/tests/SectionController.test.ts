import {dbConfig} from '../../../config/db';
import Express from 'express';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import Container from 'typedi';
import {SectionService} from '../services/SectionService';
import {CourseVersionService} from '../services';
import {useExpressServer} from 'routing-controllers';
import {coursesModuleOptions} from 'modules/courses';
import request from 'supertest';
import {ItemRepository} from 'shared/database/providers/mongo/repositories/ItemRepository';

describe('Section Controller Integration Tests', () => {
  const App = Express();
  let app;

  beforeAll(async () => {
    // Set up the real MongoDatabase and CourseRepository
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

    const sectionService = new SectionService(
      Container.get<ItemRepository>('ItemRepo'),
      Container.get<CourseRepository>('CourseRepo'),
    );
    Container.set('CourseVersionService', courseVersionService);
    Container.set('SectionService', sectionService);

    // Create the Express app with the routing controllers configuration
    app = useExpressServer(App, coursesModuleOptions);
  });

  describe('SECTION CREATION', () => {
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

      it('should create a section', async () => {
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

        expect(sectionResponse.body.version.modules[0].sections.length).toBe(1);
        expect(sectionResponse.body.version.modules[0].sections[0].name).toBe(
          sectionPayload.name,
        );
      });
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

        const deleteSectionResponse = await request(app)
          .delete(
            `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}`,
          )
          .expect(200);
      });
    });

    describe('Failiure Scenario', () => {
      it('should fail to delete a section', async () => {
        // Testing for Invalid params

        const sectionResponse = await request(app)
          .delete('/courses/versions/123/modules/123/sections/123')
          .expect(400);
      });

      it('should fail to delete an item', async () => {
        // Testing for Not found Case
        const sectionResponse = await request(app)
          .delete(
            '/courses/versions/62341aeb5be816967d8fc2db/modules/62341aeb5be816967d8fc2db/sections/62341aeb5be816967d8fc2db',
          )
          .expect(404);
      });
    });
  });
});
