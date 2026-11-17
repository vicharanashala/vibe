import type { CourseInsights, InsightsRange } from '@/features/admin/insights/types';

/** Deterministic pseudo-random numbers, so the fixture is the same every run. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DAY_MS = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * A believable mid-course snapshot: ~240 students, weekday-evening study, a
 * steep drop after module 3, one hard quiz and a video lesson where 15
 * students have been stuck for days.
 */
export function courseInsightsFixture(range: InsightsRange = 30, end = Date.UTC(2026, 10, 17)): CourseInsights {
  const rand = seeded(42 + range);
  const daily = Array.from({ length: range }, (_, i) => {
    const t = end - (range - 1 - i) * DAY_MS;
    const weekday = (new Date(t).getUTCDay() + 6) % 7;
    const base = weekday >= 5 ? 48 : 78;
    const activeLearners = Math.round(base + rand() * 30 + i * 0.6);
    return {
      day: isoDay(t),
      activeLearners,
      learningHours: Math.round(activeLearners * (0.55 + rand() * 0.35) * 10) / 10,
      newEnrolments: Math.round(rand() * (i < 5 ? 14 : 5)),
    };
  });
  const heatmap = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const evening = h >= 19 && h <= 22 ? 1 : h >= 9 && h <= 12 ? 0.55 : h >= 14 && h <= 17 ? 0.4 : h < 6 ? 0.03 : 0.15;
      const weekend = d >= 5 ? 0.6 : 1;
      return Math.round(evening * weekend * (6 + rand() * 4) * 10) / 10;
    }),
  );
  return {
    status: 'ready',
    updatedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    range,
    headline: {
      students: { current: 240, previous: 212 },
      activeThisWeek: { current: 131, previous: 118 },
      averageProgress: { current: 46, previous: 39 },
      finished: { current: 12, previous: 8 },
      medianDaysToFinish: { current: 19, previous: 22 },
      learningHours: { current: 1648.5, previous: 1490 },
    },
    daily,
    heatmap,
    progressBands: [
      { band: '0', students: 18 },
      { band: '1-24', students: 44 },
      { band: '25-49', students: 71 },
      { band: '50-74', students: 63 },
      { band: '75-99', students: 32 },
      { band: 'finished', students: 12 },
    ],
    funnel: [
      { moduleId: 'm1', name: 'Getting started with AI', reached: 222, completed: 205 },
      { moduleId: 'm2', name: 'Prompting fundamentals', reached: 201, completed: 180 },
      { moduleId: 'm3', name: 'Building with tools', reached: 176, completed: 151 },
      { moduleId: 'm4', name: 'Evaluating outputs', reached: 66, completed: 41 },
      { moduleId: 'm5', name: 'Capstone project', reached: 38, completed: 12 },
    ],
    whereNow: [
      { itemId: 'v-tut3', moduleId: 'm3', sectionId: 's3', name: 'Tutorial 3: Calling an API from a notebook', type: 'VIDEO', students: 15, medianDaysThere: 4.2 },
      { itemId: 'q-m2', moduleId: 'm2', sectionId: 's2', name: 'Prompting checkpoint quiz', type: 'QUIZ', students: 11, medianDaysThere: 1.4 },
      { itemId: 'v-eval', moduleId: 'm4', sectionId: 's4', name: 'What makes an answer “good”?', type: 'VIDEO', students: 9, medianDaysThere: 0.6 },
      { itemId: 'b-tools', moduleId: 'm3', sectionId: 's3', name: 'Reading: tool-use patterns', type: 'BLOG', students: 7, medianDaysThere: 2.1 },
      { itemId: 'f-m1', moduleId: 'm1', sectionId: 's1', name: 'How was module 1?', type: 'FEEDBACK', students: 4, medianDaysThere: 5 },
    ],
    quizzes: [
      {
        itemId: 'q-m1',
        moduleId: 'm1',
        sectionId: 's1',
        name: 'Module 1 check-in',
        attempted: 214,
        firstAttemptPassRate: 0.86,
        avgAttemptsToPass: 1.2,
        scoreBands: [0, 1, 2, 4, 6, 9, 18, 37, 61, 76],
        hardestQuestions: [{ questionId: 'qa', text: 'Which of these is a large language model?', correctRate: 0.71, answered: 214 }],
      },
      {
        itemId: 'q-m3',
        moduleId: 'm3',
        sectionId: 's3',
        name: 'Tools and APIs quiz',
        attempted: 168,
        firstAttemptPassRate: 0.35,
        avgAttemptsToPass: 2.4,
        scoreBands: [3, 6, 14, 22, 31, 29, 24, 18, 13, 8],
        hardestQuestions: [
          { questionId: 'qb', text: 'What does a 429 status code from the API mean?', correctRate: 0.2, answered: 168 },
          { questionId: 'qc', text: 'Where should an API key be stored in a shared notebook?', correctRate: 0.38, answered: 168 },
          { questionId: 'qd', text: 'Which parameter limits the length of the response?', correctRate: 0.47, answered: 167 },
        ],
      },
      {
        itemId: 'q-m2',
        moduleId: 'm2',
        sectionId: 's2',
        name: 'Prompting checkpoint quiz',
        attempted: 190,
        firstAttemptPassRate: 0.72,
        avgAttemptsToPass: 1.5,
        scoreBands: [1, 2, 3, 7, 12, 15, 27, 41, 45, 37],
        hardestQuestions: [{ questionId: 'qe', text: 'Which prompt gives the model a role?', correctRate: 0.52, answered: 190 }],
      },
    ],
    videos: [
      { itemId: 'v-intro', moduleId: 'm1', sectionId: 's1', name: 'Welcome and course tour', started: 236, completed: 228, rewindHotspots: [{ startSecond: 75, rewinds: 9 }] },
      {
        itemId: 'v-tut3',
        moduleId: 'm3',
        sectionId: 's3',
        name: 'Tutorial 3: Calling an API from a notebook',
        started: 181,
        completed: 118,
        rewindHotspots: [
          { startSecond: 250, rewinds: 64 },
          { startSecond: 610, rewinds: 41 },
          { startSecond: 135, rewinds: 22 },
        ],
      },
      { itemId: 'v-eval', moduleId: 'm4', sectionId: 's4', name: 'What makes an answer “good”?', started: 70, completed: 52, rewindHotspots: [] },
    ],
    checkOn: [
      { userId: 'u1', name: 'Ananya Rao', email: 'ananya@example.com', reason: 'stuck', daysSinceActive: 1, item: { itemId: 'v-tut3', name: 'Tutorial 3: Calling an API from a notebook' }, daysOnItem: 5 },
      { userId: 'u2', name: 'Rohit Verma', email: 'rohit@example.com', reason: 'inactive', daysSinceActive: 9, item: { itemId: 'q-m2', name: 'Prompting checkpoint quiz' }, daysOnItem: 9 },
      { userId: 'u3', name: 'Fatima Sheikh', email: 'fatima@example.com', reason: 'inactive', daysSinceActive: 14, item: null, daysOnItem: null },
      { userId: 'u4', name: 'Karthik Iyer', email: 'karthik@example.com', reason: 'stuck', daysSinceActive: 0, item: { itemId: 'v-tut3', name: 'Tutorial 3: Calling an API from a notebook' }, daysOnItem: 4 },
    ],
    proctoring: {
      checksOn: true,
      daily: daily.map((d, i) => ({
        day: d.day,
        per100Hours: {
          NO_FACE: Math.round((12 + rand() * 10 - i * 0.15) * 10) / 10,
          MULTIPLE_FACES: Math.round((2 + rand() * 3) * 10) / 10,
          VOICE_DETECTION: Math.round((5 + rand() * 6) * 10) / 10,
          BLUR_DETECTION: Math.round(rand() * 3 * 10) / 10,
        },
      })),
      shareWithIncident: 0.38,
    },
    studyMode: { strictOnly: 141, studyOnly: 9, both: 72 },
  };
}
