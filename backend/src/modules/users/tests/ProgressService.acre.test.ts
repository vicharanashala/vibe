import { describe, it, expect, vi } from 'vitest';
import { ProgressService } from '#users/services/ProgressService.js';
import { ObjectId } from 'mongodb';

// Helper to create ObjectIds
const makeId = () => new ObjectId().toString();

const USER_ID = makeId();
const COURSE_ID = makeId();
const VERSION_ID = makeId();
const MODULE_ID = makeId();
const SECTION_ID = makeId();
const QUIZ_ID = makeId();
const VIDEO_ID = makeId();
const BLOG_ID = makeId();

// Helper to mock the ProgressService
function makeAcreService(opts: {
  progress: any;
  courseVersion: any;
  itemsGroup: any;
  questionBanks: any[];
  itemsMap: Record<string, any>;
  enrollment?: any;
}) {
  const service: any = Object.create(ProgressService.prototype);

  // Stub the database provider
  service.database = {
    getCollection: async (name: string) => {
      return {
        find: (query: any) => ({
          toArray: async () => {
            if (name === 'questionBanks') {
              return opts.questionBanks;
            }
            return [];
          }
        }),
        findOne: async (query: any) => {
          const idStr = query._id instanceof ObjectId ? query._id.toString() : query._id;
          return opts.itemsMap[idStr] || null;
        }
      };
    }
  };

  // Stub transaction helper
  service._withTransaction = async (fn: any) => {
    return fn({});
  };

  // Stub progress repository
  let updatedProgressPayload: any = null;
  service.progressRepository = {
    findProgress: async () => opts.progress,
    updateProgress: async (uid: any, cid: any, cvid: any, payload: any) => {
      updatedProgressPayload = payload;
      return { ...opts.progress, ...payload };
    },
    isItemCompleted: async () => false,
    getCompletedItems: async () => [],
    getHiddenOrDeletedItems: async () => [],
    stopItemTracking: async () => ({ startTime: new Date() }),
  };

  // Stub course repository
  service.courseRepo = {
    readVersion: async () => opts.courseVersion,
    getCourseVersionStatus: async () => 'published',
  };

  // Stub item repository
  service.itemRepo = {
    readItemsGroup: async () => opts.itemsGroup,
    readItemById: async (id: string) => {
      const doc = opts.itemsMap[id];
      return doc ? { _id: id, type: doc.type, name: doc.name } : null;
    }
  };

  // Stub enrollment repository
  service.enrollmentRepo = {
    findEnrollment: async () => opts.enrollment || { _id: 'enrollment1', percentCompleted: 0 },
    updateProgressPercentById: async () => {},
  };

  // Stub settings service / linear progression
  service.getCourseSettingService = () => ({
    isLinearProgressionEnabled: async () => true,
  });

  // Stub validators
  service.validateProgressPositionOrPreviousCompleted = async () => {};
  service.validateItemStopEligibility = async () => {};

  // Stub other helpers
  service.getAllItemIds = async () => [VIDEO_ID, BLOG_ID, QUIZ_ID];
  service.getPreviousItemInSequence = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: VIDEO_ID
  });

  return {
    service: service as ProgressService,
    getUpdatedPayload: () => updatedProgressPayload
  };
}

describe('ACRE V1 - Vikram-Betaal Recovery Loop', () => {
  describe('handleQuizeProgressAfterSubmission (Quiz Failure)', () => {
    it('redirects to matched review item and sets recoveryState on concept match', async () => {
      const questionId = makeId();
      const progress = {
        userId: USER_ID,
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: QUIZ_ID,
        completed: false,
      };

      const courseVersion = {
        courseId: COURSE_ID,
        modules: [{
          moduleId: MODULE_ID,
          sections: [{
            sectionId: SECTION_ID,
            itemsGroupId: 'group1'
          }]
        }]
      };

      const itemsGroup = {
        _id: 'group1',
        items: [
          { _id: VIDEO_ID, type: 'VIDEO', order: 'a', isHidden: false },
          { _id: BLOG_ID, type: 'BLOG', order: 'b', isHidden: false },
          { _id: QUIZ_ID, type: 'QUIZ', order: 'c', isHidden: false }
        ]
      };

      const questionBanks = [{
        questions: [new ObjectId(questionId)],
        tags: ['mongodb', 'database']
      }];

      const itemsMap = {
        [VIDEO_ID]: { type: 'VIDEO', name: 'Intro Video', description: 'General overview' },
        [BLOG_ID]: { type: 'BLOG', name: 'DB Guide', description: 'Deep dive into databases', tags: ['database'] }
      };

      const { service, getUpdatedPayload } = makeAcreService({
        progress,
        courseVersion,
        itemsGroup,
        questionBanks,
        itemsMap
      });

      await service.handleQuizeProgressAfterSubmission(
        USER_ID,
        QUIZ_ID,
        COURSE_ID,
        VERSION_ID,
        false, // Failed
        undefined,
        undefined,
        MODULE_ID,
        SECTION_ID,
        [questionId] // Failed question
      );

      const payload = getUpdatedPayload();
      expect(payload).toBeDefined();
      expect(payload.currentItem).toBe(BLOG_ID); // Redirected to matched blog
      expect(payload.recoveryState).toEqual({
        isActive: true,
        targetQuizId: QUIZ_ID,
        reviewItemId: BLOG_ID,
        failedTags: ['mongodb', 'database']
      });
    });

    it('falls back to previous item when no tag match is found', async () => {
      const questionId = makeId();
      const progress = {
        userId: USER_ID,
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: QUIZ_ID,
        completed: false,
      };

      const courseVersion = {
        courseId: COURSE_ID,
        modules: [{
          moduleId: MODULE_ID,
          sections: [{
            sectionId: SECTION_ID,
            itemsGroupId: 'group1'
          }]
        }]
      };

      const itemsGroup = {
        _id: 'group1',
        items: [
          { _id: VIDEO_ID, type: 'VIDEO', order: 'a', isHidden: false },
          { _id: QUIZ_ID, type: 'QUIZ', order: 'b', isHidden: false }
        ]
      };

      // No tag match possible
      const questionBanks: any[] = [];
      const itemsMap = {
        [VIDEO_ID]: { type: 'VIDEO', name: 'Intro Video', description: 'General overview' }
      };

      const { service, getUpdatedPayload } = makeAcreService({
        progress,
        courseVersion,
        itemsGroup,
        questionBanks,
        itemsMap
      });

      await service.handleQuizeProgressAfterSubmission(
        USER_ID,
        QUIZ_ID,
        COURSE_ID,
        VERSION_ID,
        false, // Failed
        undefined,
        undefined,
        MODULE_ID,
        SECTION_ID,
        [questionId]
      );

      const payload = getUpdatedPayload();
      expect(payload).toBeDefined();
      expect(payload.currentItem).toBe(VIDEO_ID); // Fell back to previous item
      expect(payload.recoveryState).toEqual({
        isActive: true,
        targetQuizId: QUIZ_ID,
        reviewItemId: VIDEO_ID,
        failedTags: []
      });
    });
  });

  describe('stopItem (Auto-Return)', () => {
    it('redirects back to the target quiz and unsets recoveryState when review item is completed', async () => {
      const progress = {
        userId: USER_ID,
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: VIDEO_ID,
        completed: false,
        recoveryState: {
          isActive: true,
          targetQuizId: QUIZ_ID,
          reviewItemId: VIDEO_ID,
          failedTags: ['database']
        }
      };

      const courseVersion = {
        courseId: COURSE_ID,
        modules: [{
          moduleId: MODULE_ID,
          sections: [{
            sectionId: SECTION_ID,
            itemsGroupId: 'group1'
          }]
        }]
      };

      const itemsGroup = {
        _id: 'group1',
        items: [
          { _id: VIDEO_ID, type: 'VIDEO', order: 'a', isHidden: false },
          { _id: QUIZ_ID, type: 'QUIZ', order: 'b', isHidden: false }
        ]
      };

      const itemsMap = {
        [VIDEO_ID]: { type: 'VIDEO', name: 'Review Video', description: 'Reviewing database concepts' }
      };

      const { service, getUpdatedPayload } = makeAcreService({
        progress,
        courseVersion,
        itemsGroup,
        questionBanks: [],
        itemsMap
      });

      await service.stopItem(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        VIDEO_ID, // Completed the review video
        SECTION_ID,
        MODULE_ID,
        'watchTime1'
      );

      const payload = getUpdatedPayload();
      expect(payload).toBeDefined();
      expect(payload.currentItem).toBe(QUIZ_ID); // Redirected back to quiz
      expect(payload.recoveryState).toBeUndefined(); // recoveryState preserved (not cleared to null in update progress payload)
    });
  });
});
