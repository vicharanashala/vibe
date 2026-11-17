import {describe, it, expect} from 'vitest';
import {
  CourseStructure,
  LearnerSources,
  checkOn,
  learnerHeadline,
  moduleFunnel,
  progressBands,
  projectLearner,
  scoreBand,
  studyModeSplit,
  whereNow,
} from '../services/projection.js';
import {istDay, splitByIstHour, weekdayOfDay} from '../services/time.js';
import type {CaLearner} from '../interfaces.js';

// Times are written in IST (+05:30) for readability.
const ist = (s: string) => new Date(`${s}+05:30`);
const DAY = 24 * 3600 * 1000;

function structure(): CourseStructure {
  const items = new Map();
  const add = (
    itemId: string,
    type: string,
    moduleId: string,
    moduleIndex: number,
    order: number,
    durationSeconds: number | null = null,
  ) =>
    items.set(itemId, {
      itemId,
      type,
      name: `Item ${itemId}`,
      moduleId,
      sectionId: `s-${moduleId}`,
      moduleIndex,
      order,
      durationSeconds,
    });
  add('v1', 'VIDEO', 'm1', 0, 0, 600);
  add('q1', 'QUIZ', 'm1', 0, 1);
  add('v2', 'VIDEO', 'm2', 1, 2, 600);
  return {
    courseId: 'c',
    versionId: 'ver',
    modules: [
      {moduleId: 'm1', name: 'Module 1', itemIds: ['v1', 'q1']},
      {moduleId: 'm2', name: 'Module 2', itemIds: ['v2']},
    ],
    items,
    quizIds: ['q1'],
    videoIds: ['v1', 'v2'],
    questionText: new Map(),
  };
}

function sources(over: Partial<LearnerSources> = {}): LearnerSources {
  return {
    userId: 'u1',
    enrollment: {
      enrollmentDate: ist('2026-11-01T10:00:00'),
      percentCompleted: 30,
    },
    progress: {currentItem: 'q1', completed: false},
    user: {firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com'},
    watchTimes: [],
    submissions: [],
    anomalies: [],
    studyViews: [],
    activityEvents: [],
    ...over,
  };
}

const upTo = ist('2026-11-17T12:00:00');

describe('time helpers', () => {
  it('splits a session across IST hours and midnight', () => {
    const pieces = splitByIstHour(
      ist('2026-11-10T23:30:00'),
      ist('2026-11-11T00:45:00'),
    );
    expect(pieces).toEqual([
      {day: '2026-11-10', hour: 23, seconds: 1800},
      {day: '2026-11-11', hour: 0, seconds: 2700},
    ]);
  });
  it('weekday of an IST day, Monday = 0', () => {
    expect(weekdayOfDay('2026-11-16')).toBe(0); // a Monday
    expect(weekdayOfDay('2026-11-22')).toBe(6);
  });
});

describe('projectLearner: learning time (2.2)', () => {
  it('attributes a viewing crossing midnight IST to both days', () => {
    const p = projectLearner(
      structure(),
      sources({
        watchTimes: [
          {
            itemId: 'v1',
            startTime: ist('2026-11-10T23:55:00'),
            endTime: ist('2026-11-11T00:05:00'),
          },
        ],
      }),
      null,
      upTo,
    );
    const d10 = p.days.find(d => d.day === '2026-11-10')!;
    const d11 = p.days.find(d => d.day === '2026-11-11')!;
    expect(d10.learningSeconds).toBe(300);
    expect(d10.secondsByHour[23]).toBe(300);
    expect(d11.learningSeconds).toBe(300);
    expect(d11.secondsByHour[0]).toBe(300);
  });

  it('caps an abandoned viewing at 3x the video length', () => {
    const p = projectLearner(
      structure(),
      sources({
        watchTimes: [
          {
            itemId: 'v1',
            startTime: ist('2026-11-10T08:00:00'),
            endTime: ist('2026-11-10T20:00:00'),
          },
        ],
      }),
      null,
      upTo,
    );
    const total = p.days.reduce((a, d) => a + d.learningSeconds, 0);
    expect(total).toBe(1800); // 3 × 600 s
  });

  it('ignores an open viewing for time, but counts the video as started', () => {
    const p = projectLearner(
      structure(),
      sources({
        watchTimes: [{itemId: 'v1', startTime: ist('2026-11-10T08:00:00')}],
      }),
      null,
      upTo,
    );
    expect(p.days.every(d => d.learningSeconds === 0)).toBe(true);
    expect(p.videos).toEqual([
      expect.objectContaining({itemId: 'v1', started: true, completed: false}),
    ]);
  });
});

describe('projectLearner: learner fields (2.3)', () => {
  const watched = {
    itemId: 'v1',
    startTime: ist('2026-11-12T10:00:00'),
    endTime: ist('2026-11-12T10:10:00'),
  };

  it('keeps currentItemSince when the item is unchanged and resets it when it changes', () => {
    const first = projectLearner(
      structure(),
      sources({watchTimes: [watched]}),
      null,
      upTo,
    );
    expect(first.learner.currentItemSince).toEqual(ist('2026-11-12T10:10:00'));

    const prev: CaLearner = {
      ...first.learner,
      currentItemSince: ist('2026-11-05T09:00:00'),
    };
    const same = projectLearner(
      structure(),
      sources({watchTimes: [watched]}),
      prev,
      upTo,
    );
    expect(same.learner.currentItemSince).toEqual(ist('2026-11-05T09:00:00'));

    const moved = projectLearner(
      structure(),
      sources({watchTimes: [watched], progress: {currentItem: 'v2'}}),
      prev,
      upTo,
    );
    expect(moved.learner.currentItemSince).toEqual(ist('2026-11-12T10:10:00'));
  });

  it('ignores items that are not visible and finds the furthest/completed modules', () => {
    const p = projectLearner(
      structure(),
      sources({
        progress: {currentItem: 'v2'},
        watchTimes: [
          watched,
          {
            itemId: 'q1',
            startTime: ist('2026-11-12T11:00:00'),
            endTime: ist('2026-11-12T11:05:00'),
          },
          {
            itemId: 'hidden',
            startTime: ist('2026-11-12T12:00:00'),
            endTime: ist('2026-11-12T12:05:00'),
          },
        ],
        studyViews: [
          {itemId: 'v2', firstStudiedAt: ist('2026-11-13T09:00:00')},
        ],
        anomalies: [{type: 'NO_FACE', createdAt: ist('2026-11-12T10:05:00')}],
      }),
      null,
      upTo,
    );
    expect(p.learner.furthestModuleIndex).toBe(1);
    expect(p.learner.completedModuleIds).toEqual(['m1']);
    expect(p.learner.usedStrict).toBe(true);
    expect(p.learner.usedStudy).toBe(true);
    expect(p.learner.incidentCount).toBe(1);
    expect(p.learner.lastActiveAt).toEqual(ist('2026-11-13T09:00:00'));
    expect(p.learner.name).toBe('Asha Rao');
  });

  it('marks a finished learner as having reached every module', () => {
    const p = projectLearner(
      structure(),
      sources({
        enrollment: {percentCompleted: 100},
        progress: {
          currentItem: 'v2',
          completed: true,
          completedAt: ist('2026-11-14T10:00:00'),
        },
      }),
      null,
      upTo,
    );
    expect(p.learner.finished).toBe(true);
    expect(p.learner.furthestModuleIndex).toBe(1);
    expect(p.learner.completedAt).toEqual(ist('2026-11-14T10:00:00'));
  });
});

describe('projectLearner: quizzes (2.4)', () => {
  const sub = (at: string, status: string, score: number, fb: any[] = []) => ({
    quizId: 'q1',
    submittedAt: ist(at),
    gradingResult: {
      totalScore: score,
      totalMaxScore: 10,
      gradingStatus: status,
      overallFeedback: fb,
    },
  });

  it('fail then pass gives 2 attempts to pass and first attempt not passed', () => {
    const p = projectLearner(
      structure(),
      sources({
        submissions: [
          sub('2026-11-12T11:00:00', 'PASSED', 8),
          sub('2026-11-12T10:00:00', 'FAILED', 3, [
            {questionId: 'qa', status: 'CORRECT'},
            {questionId: 'qb', status: 'INCORRECT'},
          ]),
        ],
      }),
      null,
      upTo,
    );
    expect(p.quizzes).toEqual([
      expect.objectContaining({
        attempts: 2,
        firstAttemptPassed: false,
        attemptsToPass: 2,
        firstAttemptScorePct: 30,
        bestScorePct: 80,
        firstAttemptQuestions: [
          {questionId: 'qa', correct: true},
          {questionId: 'qb', correct: false},
        ],
      }),
    ]);
  });

  it('never passed has no attemptsToPass', () => {
    const p = projectLearner(
      structure(),
      sources({submissions: [sub('2026-11-12T10:00:00', 'FAILED', 2)]}),
      null,
      upTo,
    );
    expect(p.quizzes[0].attemptsToPass).toBeNull();
    expect(p.quizzes[0].firstAttemptPassed).toBe(false);
  });
});

describe('projectLearner: rewinds (2.5) and incidents/enrolment (2.6)', () => {
  it('puts rewinds to 4:12 and 4:18 in the 4:10 segment', () => {
    const p = projectLearner(
      structure(),
      sources({
        activityEvents: [
          {
            videoId: 'v1',
            rewindData: [{to: '00:04:12'}, {to: '00:04:18'}, {to: '00:00:05'}],
          },
        ],
      }),
      null,
      upTo,
    );
    expect(p.videos[0].rewindSegments).toEqual({'250': 2, '0': 1});
  });

  it('places an incident at 23:50 IST on that IST day and marks the enrolment day', () => {
    const p = projectLearner(
      structure(),
      sources({
        enrollment: {
          enrollmentDate: ist('2026-11-01T23:59:00'),
          percentCompleted: 0,
        },
        anomalies: [
          {type: 'MULTIPLE_FACES', createdAt: ist('2026-11-12T23:50:00')},
        ],
      }),
      null,
      upTo,
    );
    expect(p.days.find(d => d.day === '2026-11-12')?.incidentsByType).toEqual({
      MULTIPLE_FACES: 1,
    });
    expect(p.days.find(d => d.day === '2026-11-01')?.enrolled).toBe(true);
    expect(istDay(ist('2026-11-12T23:50:00'))).toBe('2026-11-12');
  });
});

describe('course summaries from learner rows (3.1)', () => {
  const now = ist('2026-11-17T12:00:00');
  const learner = (over: Partial<CaLearner>): CaLearner => ({
    versionId: 'ver',
    userId: Math.random().toString(36).slice(2),
    name: 'S',
    email: 's@example.com',
    cohort: null,
    enrolledAt: ist('2026-10-01T10:00:00'),
    percent: 0,
    finished: false,
    completedAt: null,
    lastActiveAt: now,
    currentItemId: 'v1',
    currentItemSince: now,
    furthestModuleIndex: 0,
    completedModuleIds: [],
    usedStrict: true,
    usedStudy: false,
    incidentCount: 0,
    lastIncidentAt: null,
    computedAt: now,
    ...over,
  });

  it('progress bands add up to the roster', () => {
    const ls = [
      learner({percent: 0}),
      learner({percent: 10}),
      learner({percent: 30}),
      learner({percent: 60}),
      learner({percent: 80}),
      learner({percent: 100, finished: true}),
    ];
    const bands = progressBands(ls);
    expect(bands.map(b => b.students)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(bands.reduce((a, b) => a + b.students, 0)).toBe(ls.length);
  });

  it('funnel counts reached and completed per module', () => {
    const ls = [
      learner({furthestModuleIndex: 1, completedModuleIds: ['m1']}),
      learner({furthestModuleIndex: 0}),
    ];
    expect(moduleFunnel(structure(), ls)).toEqual([
      {moduleId: 'm1', name: 'Module 1', reached: 2, completed: 1},
      {moduleId: 'm2', name: 'Module 2', reached: 1, completed: 0},
    ]);
  });

  it('where students are now lists the stuck video with the median time there', () => {
    const ls = Array.from({length: 15}, () =>
      learner({
        currentItemId: 'v1',
        currentItemSince: new Date(now.getTime() - 4 * DAY),
      }),
    );
    ls.push(learner({currentItemId: 'q1'}));
    const rows = whereNow(structure(), ls, now);
    expect(rows[0]).toMatchObject({
      itemId: 'v1',
      students: 15,
      medianDaysThere: 4,
    });
  });

  it('students to check on: inactive 9 days listed, finished never listed, stuck 3+ days listed', () => {
    const rows = checkOn(
      structure(),
      [
        learner({
          userId: 'inactive',
          lastActiveAt: new Date(now.getTime() - 9 * DAY),
        }),
        learner({
          userId: 'done',
          finished: true,
          lastActiveAt: new Date(now.getTime() - 30 * DAY),
        }),
        learner({
          userId: 'stuck',
          currentItemSince: new Date(now.getTime() - 3.5 * DAY),
        }),
        learner({userId: 'fine'}),
      ],
      now,
    );
    expect(rows.map(r => [r.userId, r.reason, r.daysSinceActive])).toEqual([
      ['inactive', 'inactive', 9],
      ['stuck', 'stuck', 0],
    ]);
    expect(rows[1].daysOnItem).toBe(3);
  });

  it('headline compares finished this period with the previous one', () => {
    const today = istDay(now);
    const ls = [
      ...Array.from({length: 12}, () =>
        learner({
          finished: true,
          percent: 100,
          completedAt: new Date(now.getTime() - 5 * DAY),
        }),
      ),
      ...Array.from({length: 8}, () =>
        learner({
          finished: true,
          percent: 100,
          completedAt: new Date(now.getTime() - 40 * DAY),
        }),
      ),
    ];
    const h = learnerHeadline(ls, 30, today, {
      activeThisWeek: {current: 3, previous: 2},
      learningHours: {current: 10, previous: null},
      shareWithIncident: 0,
    });
    expect(h.finished).toEqual({current: 12, previous: 8});
    expect(h.students.current).toBe(20);
    expect(h.averageProgress.previous).toBeNull();
  });

  it('study mode split and score bands', () => {
    expect(
      studyModeSplit([
        learner({usedStrict: true, usedStudy: true}),
        learner({usedStrict: false, usedStudy: true}),
        learner({usedStrict: true, usedStudy: false}),
      ]),
    ).toEqual({strictOnly: 1, studyOnly: 1, both: 1});
    expect([0, 9.9, 10, 99, 100].map(scoreBand)).toEqual([0, 0, 1, 9, 9]);
  });
});
