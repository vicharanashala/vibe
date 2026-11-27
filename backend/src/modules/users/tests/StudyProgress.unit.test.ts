import 'reflect-metadata';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {ObjectId} from 'mongodb';

import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {StudyViewRepository} from '#root/shared/database/providers/mongo/repositories/StudyViewRepository.js';
import {
  computeStudyProgress,
  eligibleLessons,
  lessonsOf,
} from '../services/StudyProgressService.js';

const id = () => new ObjectId().toString();

/** A small course: module A (study allowed) and module B (study mode off). */
function course() {
  const ids = {v1: id(), v2: id(), a1: id(), q1: id(), b1: id(), hidden: id()};
  const gA = id();
  const gB = id();
  const version = {
    modules: [
      {moduleId: 'mA', sections: [{sectionId: 'sA', itemsGroupId: gA}]},
      {
        moduleId: 'mB',
        studyModeEnabled: false,
        sections: [{sectionId: 'sB', itemsGroupId: gB}],
      },
    ],
  };
  const groups = [
    {
      _id: gA,
      items: [
        {_id: ids.v1, type: 'VIDEO'},
        {_id: ids.v2, type: 'VIDEO'},
        {_id: ids.a1, type: 'BLOG'},
        {_id: ids.q1, type: 'QUIZ'},
        {_id: ids.hidden, type: 'VIDEO', isHidden: true},
      ],
    },
    {_id: gB, items: [{_id: ids.b1, type: 'VIDEO'}]},
  ];
  return {ids, version, groups};
}

describe('study progress calculation', () => {
  it('counts study views and strict completions together', () => {
    const {ids, version, groups} = course();
    const eligible = eligibleLessons(lessonsOf(version, groups));
    expect(eligible).toEqual([ids.v1, ids.v2, ids.a1]);
    const p = computeStudyProgress(eligible, [ids.v1], [ids.a1]);
    expect(p).toMatchObject({
      studiedItems: 2,
      totalItems: 3,
      percentStudied: 67,
    });
    expect(p.studiedItemIds.sort()).toEqual([ids.v1, ids.a1].sort());
  });

  it('leaves out strict-only, quiz and hidden lessons from the total', () => {
    const {ids, version, groups} = course();
    const eligible = eligibleLessons(lessonsOf(version, groups));
    expect(eligible).not.toContain(ids.b1);
    expect(eligible).not.toContain(ids.q1);
    expect(eligible).not.toContain(ids.hidden);
    // A strict completion of a strict-only video doesn't count either.
    expect(
      computeStudyProgress(eligible, [], [ids.b1, ids.q1]).studiedItems,
    ).toBe(0);
  });

  it('follows the teacher turning study mode off and on again', () => {
    const {ids, version, groups} = course();
    (version.modules[0] as {studyModeEnabled?: boolean}).studyModeEnabled =
      false;
    const off = computeStudyProgress(
      eligibleLessons(lessonsOf(version, groups)),
      [ids.v1],
      [],
    );
    expect(off).toMatchObject({studiedItems: 0, totalItems: 0});
    (
      version.modules[0] as {studyModeEnabled?: boolean | null}
    ).studyModeEnabled = null;
    const on = computeStudyProgress(
      eligibleLessons(lessonsOf(version, groups)),
      [ids.v1],
      [],
    );
    expect(on).toMatchObject({studiedItems: 1, totalItems: 3});
  });

  it('is 0 of 0 with 0% when nothing can be studied', () => {
    expect(computeStudyProgress([], [], [])).toEqual({
      studiedItems: 0,
      totalItems: 0,
      percentStudied: 0,
      studiedItemIds: [],
    });
  });

  it('honours an item that turns study mode back on inside a disabled module', () => {
    const {ids, version, groups} = course();
    (groups[1].items[0] as {studyModeEnabled?: boolean}).studyModeEnabled =
      true;
    expect(eligibleLessons(lessonsOf(version, groups))).toContain(ids.b1);
  });
});

describe('StudyViewRepository', () => {
  let db: MongoDatabase;
  let repo: StudyViewRepository;
  beforeAll(async () => {
    db = new MongoDatabase(
      process.env.DB_URL,
      'study_views_test_' + Date.now(),
    );
    await db.connect();
    repo = new StudyViewRepository(db);
  });
  afterAll(async () => {
    await db.disconnect?.();
  });

  it('keeps one view per student, version and lesson, with the first time', async () => {
    const view = {
      userId: id(),
      courseId: id(),
      courseVersionId: id(),
      itemId: id(),
    };
    await repo.recordView(view);
    const col = await db.getCollection<{firstStudiedAt: Date}>('studyViews');
    const first = (await col.findOne({}))!.firstStudiedAt;
    await new Promise(r => setTimeout(r, 20));
    await repo.recordView(view);
    await Promise.all([repo.recordView(view), repo.recordView(view)]);
    const docs = await col.find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].firstStudiedAt).toEqual(first);
  });

  it('finds views only for the given users and lessons', async () => {
    const versionId = id();
    const [u1, u2, u3] = [id(), id(), id()];
    const [i1, i2] = [id(), id()];
    const courseId = id();
    await repo.recordView({
      userId: u1,
      courseId,
      courseVersionId: versionId,
      itemId: i1,
    });
    await repo.recordView({
      userId: u2,
      courseId,
      courseVersionId: versionId,
      itemId: i2,
    });
    await repo.recordView({
      userId: u3,
      courseId,
      courseVersionId: versionId,
      itemId: i1,
    });
    await repo.recordView({
      userId: u1,
      courseId,
      courseVersionId: id(),
      itemId: i1,
    });
    const found = await repo.findViews(versionId, [u1, u2], [i1]);
    expect(found).toEqual([{userId: u1, itemId: i1}]);
    expect(await repo.findViews(versionId, [], [i1])).toEqual([]);
  });
});
