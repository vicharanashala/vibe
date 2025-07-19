import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { faker } from '@faker-js/faker';
import { describe, it, beforeEach, beforeAll, expect, vi } from 'vitest';
import { AnomalyController } from '../controllers/AnomalyController.js';
import { HttpErrorHandler, ItemType } from '#shared/index.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container, ContainerModule } from 'inversify';
import { AuthController } from '#root/modules/auth/controllers/AuthController.js';
import { createCourse, createVersion, createModule, createSection } from '#root/modules/courses/tests/utils/creationFunctions.js';
import { CreateItemBody } from '#root/modules/courses/classes/index.js';
import { CourseController } from '#root/modules/courses/controllers/CourseController.js';
import { CourseVersionController } from '#root/modules/courses/controllers/CourseVersionController.js';
import { ItemController } from '#root/modules/courses/controllers/ItemController.js';
import { ModuleController } from '#root/modules/courses/controllers/ModuleController.js';
import { SectionController } from '#root/modules/courses/controllers/SectionController.js';
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#root/modules/auth/container.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { anomaliesContainerModule } from '../container.js';
import { AnomalyData, NewAnomalyData } from '../classes/validators/AnomalyValidators.js';
import { AnomalyType } from '../classes/transformers/Anomaly.js';
const ContainerModules: ContainerModule[] = [
  anomaliesContainerModule,
  coursesContainerModule,
  sharedContainerModule,
  authContainerModule,
  notificationsContainerModule,
  usersContainerModule,
  quizzesContainerModule
]
const validImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',);
describe('Anomaly Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let anomalyData: NewAnomalyData;

  beforeAll(async () => {
    const container = new Container();
    await container.load(...ContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    app = useExpressServer(appInstance, {
      controllers: [AnomalyController, AuthController, CourseController, CourseVersionController, ModuleController, SectionController, ItemController],
      validation: true,
      defaultErrorHandler: false,
      middlewares: [HttpErrorHandler],
      authorizationChecker: () => true, // Mock authorization for testing
    });
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
    expect(itemResponse.status).toBe(201);
    expect(itemResponse.body.itemsGroup.items.length).toBe(1);
    // create a valid user
    const user = await request(app)
      .post('/auth/signup')
      .send({
        email: faker.internet.email(),
        password: faker.internet.password(),
        firstName: faker.person.firstName('male').replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      })
      .expect(201);
    const userId = user.body.userId;
    // Arrange
    anomalyData = {
      courseId: course._id.toString(),
      versionId: version._id.toString(),
      itemId: itemResponse.body.itemsGroup.items[0]._id.toString(),
      type: AnomalyType.VOICE_DETECTION,
    };
  }, 30000);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ANOMALY RECORDING', () => {
    describe('Success Scenario', () => {
      it('should record an anomaly with a valid image and data', async () => {
        // Act
        const response = await request(app)
          .post('/anomalies/record')
          .field('data', JSON.stringify(anomalyData))
          .attach('image', validImageBuffer, 'test-image.jpg')
          .expect(201);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.hexId).toBeDefined();
        expect(response.body.message).toBe(
          'Anomaly recorded successfully with compressed & encrypted image',
        );
      }, 60000);
    });

    describe('Error Scenarios', () => {
      it('should return 500 for invalid image data', async () => {
        // Act
        const response = await request(app)
          .post('/anomalies/record')
          .field('data', JSON.stringify(anomalyData))
          .attach('image', Buffer.from('fake-image-data'), 'test-image.jpg')
          .expect(500);
  
        // Assert
        expect(response.body.message).toContain('Input buffer contains unsupported image format');
      });
    });
  });
});
