import {describe, it, expect, vi} from 'vitest';
import {ForbiddenError} from 'routing-controllers';
import {ObjectId} from 'mongodb';
import {ItemService} from '#courses/services/ItemService.js';
import {ItemController} from '#courses/controllers/ItemController.js';

const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const FORM = new ObjectId().toString();

const form = {
  details: {
    jsonSchema: {
      properties: {
        Useful: {
          type: 'string',
          oneOf: [
            {const: 'v', title: 'Very useful'},
            {const: 'n', title: 'Not useful'},
          ],
        },
        Rate: {
          type: 'string',
          oneOf: ['1', '2', '3'].map(v => ({const: v, title: v})),
        },
      },
    },
    uiSchema: {
      'ui:order': ['Rate', 'Useful'],
      Rate: {'ui:options': {display: 'rating'}},
    },
  },
};

describe('ItemService.getFeedbackSummary', () => {
  it('summarises every current answer, with no cap', async () => {
    const service: any = Object.create(ItemService.prototype);
    const answers = Array.from({length: 1500}, (_, i) => ({
      Useful: i % 3 ? 'v' : 'n',
      Rate: String((i % 3) + 1),
    }));
    service.feedbackRepo = {
      getFormById: async () => form,
      getCurrentAnswerDetails: vi.fn(async () => answers),
    };
    const summary = await service.getFeedbackSummary(COURSE, FORM, ['c1']);
    expect(service.feedbackRepo.getCurrentAnswerDetails).toHaveBeenCalledWith(
      FORM,
      COURSE,
      ['c1'],
    );
    expect(summary.total).toBe(1500);
    expect(summary.questions.map((q: any) => q.key)).toEqual([
      'Rate',
      'Useful',
    ]);
    expect(summary.questions[1].counts).toEqual({
      'Very useful': 1000,
      'Not useful': 500,
    });
    expect(summary.questions[0].average).toBe(2);
  });
});

describe('ItemController feedback access', () => {
  function controller() {
    const c: any = Object.create(ItemController.prototype);
    c.itemService = {
      findItemVersionId: async () => VERSION,
      getFeedbackSubmissions: vi.fn(async () => ({submissions: [], total: 0})),
      getFeedbackSummary: vi.fn(async () => ({total: 0, questions: []})),
    };
    c.cohortScopeService = {
      resolve: vi.fn(() => ({
        cohortIds: [new ObjectId('6af000000000000000000001')],
      })),
    };
    return c;
  }
  const ability = (staff: boolean) => ({can: () => staff});
  const params = {courseId: COURSE, feedbackId: FORM};

  it('refuses students', async () => {
    const c = controller();
    await expect(
      c.getFeedackSubmissions(
        params,
        {},
        {ability: ability(false), authenticatedUser: {}},
      ),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      c.getFeedbackSummary(
        params,
        {},
        {ability: ability(false), authenticatedUser: {}},
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it('passes search, student, history and the caller’s cohort scope through', async () => {
    const c = controller();
    await c.getFeedackSubmissions(
      params,
      {search: 'asha', page: '2', limit: '20', userId: 'u1', history: 'all'},
      {ability: ability(true), authenticatedUser: {}},
    );
    expect(c.itemService.getFeedbackSubmissions).toHaveBeenCalledWith(
      COURSE,
      FORM,
      'asha',
      2,
      20,
      {
        userId: 'u1',
        cohortIds: ['6af000000000000000000001'],
        history: 'all',
      },
    );
  });
});
