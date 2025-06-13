import request from 'supertest';
import Express from 'express';
import {useExpressServer, useContainer} from 'routing-controllers';
import {faker} from '@faker-js/faker';
import {settingsModuleOptions, setupSettingsContainer} from '..';
import {ProctoringComponent} from '#shared/database/interfaces/ISettingsRepository.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '../../../container';
import {coursesContainerModule} from '../../courses/container';
import {settingsContainerModule} from '../container';
import {InversifyAdapter} from '../../../inversify-adapter';
import {jest, describe, it, expect, beforeAll, afterEach} from '@jest/globals';

describe('CourseSettings Controller Tests', () => {
  const App = Express();
  let app;
  let courseId: string;
  let courseVersionId: string;
  let nonExistentCourseId: string;
  let nonExistentCourseVersionId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      sharedContainerModule,
      coursesContainerModule,
      settingsContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    app = useExpressServer(App, settingsModuleOptions);

    // Create a course and course version for testing
    const coursePayload = {
      name: 'Test Course',
      description: 'Course for testing settings',
    };

    const courseResponse = await request(app)
      .post('/courses/')
      .send(coursePayload)
      .expect(201);

    courseId = courseResponse.body._id;

    const courseVersionPayload = {
      version: '1.0',
      description: 'Version for testing settings',
    };

    const versionResponse = await request(app)
      .post(`/courses/${courseId}/versions`)
      .send(courseVersionPayload)
      .expect(201);

    courseVersionId = versionResponse.body._id;

    // Generate non-existent IDs for testing
    nonExistentCourseId = faker.database.mongodbObjectId();
    nonExistentCourseVersionId = faker.database.mongodbObjectId();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /settings/courses', () => {
    it('should create course settings when course and course version exist', async () => {
      const payload = {
        courseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                settings: {
                  enabled: true,
                },
              },
              {
                detectorName: ProctoringComponent.SCREENSHARING,
                settings: {
                  enabled: false,
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body._id).toBeDefined();
      expect(response.body.courseId).toBe(courseId);
      expect(response.body.courseVersionId).toBe(courseVersionId);
      expect(response.body.settings.proctors.detectors).toHaveLength(2);

      // Verify first detector
      const cameraMicroDetector =
        response.body.settings.proctors.detectors.find(
          d => d.detectorName === ProctoringComponent.CAMERAMICRO,
        );
      expect(cameraMicroDetector).toBeDefined();
      expect(cameraMicroDetector.settings.enabled).toBe(true);

      // Verify second detector
      const screenSharingDetector =
        response.body.settings.proctors.detectors.find(
          d => d.detectorName === ProctoringComponent.SCREENSHARING,
        );
      expect(screenSharingDetector).toBeDefined();
      expect(screenSharingDetector.settings.enabled).toBe(false);
    }, 60000);

    it('should enable all detectors by default when detectors array is empty', async () => {
      const payload = {
        courseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body._id).toBeDefined();
      expect(response.body.courseId).toBe(courseId);
      expect(response.body.courseVersionId).toBe(courseVersionId);

      // All default detectors should be enabled
      const detectors = response.body.settings.proctors.detectors;
      expect(detectors).toBeInstanceOf(Array);
      expect(detectors.length).toBeGreaterThan(0);

      // Check that all standard proctoring components are included
      const detectorNames = detectors.map(d => d.detectorName);
      Object.values(ProctoringComponent).forEach(component => {
        expect(detectorNames).toContain(component);
      });

      // Verify all detectors are enabled by default
      detectors.forEach(detector => {
        expect(detector.settings.enabled).toBe(true);
      });
    }, 60000);

    it('should return 404 when course does not exist', async () => {
      const payload = {
        courseId: nonExistentCourseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                settings: {
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(404);

      expect(response.body.message).toContain('Course not found');
    }, 60000);

    it('should return 404 when course version does not exist', async () => {
      const payload = {
        courseId,
        courseVersionId: nonExistentCourseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                settings: {
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(404);

      expect(response.body.message).toContain('Course version not found');
    }, 60000);

    it('should return 400 when detector name is invalid', async () => {
      const payload = {
        courseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: 'invalidDetector',
                settings: {
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(400);

      expect(response.body.message).toContain('Invalid body');
    }, 60000);

    it('should return 400 when settings are missing for detector', async () => {
      const payload = {
        courseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                // Missing settings
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(payload)
        .expect(400);

      expect(response.body.message).toContain('Invalid body');
    }, 60000);

    it('should return 400 when required fields are missing', async () => {
      // Missing courseId
      const invalidPayload = {
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                settings: {
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/settings/courses')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.message).toContain('Invalid body');
    }, 60000);
  });

  describe('GET /settings/courses/:courseId/:courseVersionId', () => {
    it('should retrieve course settings successfully', async () => {
      // First create settings
      const createPayload = {
        courseId,
        courseVersionId,
        settings: {
          proctors: {
            detectors: [
              {
                detectorName: ProctoringComponent.CAMERAMICRO,
                settings: {
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      await request(app).post('/settings/courses').send(createPayload);

      // Now retrieve them
      const response = await request(app)
        .get(`/settings/courses/${courseId}/${courseVersionId}`)
        .expect(200);

      expect(response.body.courseId).toBe(courseId);
      expect(response.body.courseVersionId).toBe(courseVersionId);
      expect(response.body.settings.proctors.detectors).toHaveLength(1);
    }, 60000);

    it('should return 404 when trying to retrieve non-existent settings', async () => {
      const response = await request(app)
        .get(`/settings/courses/${nonExistentCourseId}/${courseVersionId}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    }, 60000);
  });
});
