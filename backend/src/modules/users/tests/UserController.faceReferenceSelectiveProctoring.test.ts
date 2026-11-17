import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { UserController } from '#root/modules/users/controllers/UserController.js';
import { ProctoringComponent } from '#root/shared/database/interfaces/ISettingRepository.js';

/**
 * getCurrentUserFaceReference used to decide whether to return a student's
 * face embedding by reading only the course-wide proctoring setting
 * (CourseSettingService.readCourseSettings), ignoring any item/module-level
 * selective-proctoring override (resolveProctoringDetectors, #1424). A
 * student whose course enables FACE_RECOGNITION only via an item/module
 * override -- not the course-wide default -- had their already-registered
 * embedding wrongly withheld forever, since the course-wide setting alone
 * never reflected the override. The fix resolves the override the same way
 * AnomalyController's own FACE_RECOGNITION gate already does.
 */
describe('UserController.getCurrentUserFaceReference -- selective proctoring', () => {
  function makeController({
    courseSetting,
    item,
    courseVersion,
  }: {
    courseSetting: any;
    item: any;
    courseVersion: any;
  }) {
    const userId = new ObjectId();
    const embedding = Array.from({ length: 128 }, (_, i) => i / 128);
    const user = {
      _id: userId,
      firstName: 'Test',
      lastName: 'Student',
      email: 'student@example.com',
      profileImage: 'data:image/png;base64,abc',
      faceEmbedding: embedding,
    };

    const authService = {
      getCurrentUserFromToken: vi.fn().mockResolvedValue(user),
    };
    const courseSettingService = {
      readCourseSettings: vi.fn().mockResolvedValue(courseSetting),
    };
    const itemRepo = {
      readItemById: vi.fn().mockResolvedValue(item),
    };
    const courseRepo = {
      readVersion: vi.fn().mockResolvedValue(courseVersion),
    };

    const controller = new UserController(
      {} as any, // userService -- unused by this endpoint
      authService as any,
      {} as any, // enrollmentService -- unused by this endpoint
      courseSettingService as any,
      courseRepo as any,
      itemRepo as any,
    );

    return { controller, embedding };
  }

  function req() {
    return { headers: { authorization: 'Bearer test-token' } };
  }

  it('course-level FACE_RECOGNITION off, item override turns it on -> embedding returned when itemId is supplied', async () => {
    const moduleId = new ObjectId();
    const { controller, embedding } = makeController({
      courseSetting: {
        settings: {
          proctors: {
            detectors: [
              { detectorName: ProctoringComponent.FACERECOGNITION, settings: { enabled: false } },
            ],
          },
        },
      },
      item: {
        proctoringDetectors: [
          { detectorName: ProctoringComponent.FACERECOGNITION, settings: { enabled: true } },
        ],
      },
      courseVersion: { modules: [{ moduleId, proctoringDetectors: null }] },
    });

    // The bug this fix addresses: without itemId, only the course-level
    // setting (off) is consulted, wrongly withholding the embedding.
    const withoutItemId = await controller.getCurrentUserFaceReference(
      req(),
      'course1',
      'version1',
    );
    expect(withoutItemId.faceEmbedding).toBeNull();

    const withItemId = await controller.getCurrentUserFaceReference(
      req(),
      'course1',
      'version1',
      undefined,
      'item1',
    );
    expect(withItemId.faceEmbedding).toEqual(embedding);
  });

  it('course-level FACE_RECOGNITION on, item override turns it off -> embedding withheld even with itemId supplied', async () => {
    const { controller } = makeController({
      courseSetting: {
        settings: {
          proctors: {
            detectors: [
              { detectorName: ProctoringComponent.FACERECOGNITION, settings: { enabled: true } },
            ],
          },
        },
      },
      item: {
        proctoringDetectors: [
          { detectorName: ProctoringComponent.FACERECOGNITION, settings: { enabled: false } },
        ],
      },
      courseVersion: null,
    });

    const result = await controller.getCurrentUserFaceReference(
      req(),
      'course1',
      'version1',
      undefined,
      'item1',
    );
    expect(result.faceEmbedding).toBeNull();
  });

  it('module override present, item unset -> resolves through the module tier via moduleId', async () => {
    const moduleId = new ObjectId();
    const { controller, embedding } = makeController({
      courseSetting: {
        settings: { proctors: { detectors: [] } },
      },
      item: { proctoringDetectors: null },
      courseVersion: {
        modules: [
          {
            moduleId,
            proctoringDetectors: [
              { detectorName: ProctoringComponent.FACERECOGNITION, settings: { enabled: true } },
            ],
          },
        ],
      },
    });

    const withoutModuleId = await controller.getCurrentUserFaceReference(
      req(),
      'course1',
      'version1',
      undefined,
      'item1',
    );
    expect(withoutModuleId.faceEmbedding).toBeNull();

    const withModuleId = await controller.getCurrentUserFaceReference(
      req(),
      'course1',
      'version1',
      moduleId.toString(),
      'item1',
    );
    expect(withModuleId.faceEmbedding).toEqual(embedding);
  });

  it('no courseId/versionId supplied -> embedding returned unconditionally (unscoped lookup, unchanged behavior)', async () => {
    const { controller, embedding } = makeController({
      courseSetting: null,
      item: null,
      courseVersion: null,
    });

    const result = await controller.getCurrentUserFaceReference(req());
    expect(result.faceEmbedding).toEqual(embedding);
  });
});
