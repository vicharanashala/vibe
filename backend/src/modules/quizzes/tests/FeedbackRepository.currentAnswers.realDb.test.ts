import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {FeedbackRepository} from '#quizzes/repositories/providers/mongodb/FeedbackRepository.js';

/**
 * Current-answer rules against the project's mongodb-memory-server replica set:
 * the newest submission per student and form counts, including duplicates
 * written before the isCurrent flag existed, and replaced ones are history.
 */
describe(
  'FeedbackRepository current answers -- real MongoDB',
  {timeout: 60000},
  () => {
    let db: MongoDatabase;
    let repo: FeedbackRepository;

    beforeAll(async () => {
      const container = new Container();
      await container.load(sharedContainerModule);
      db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      await db.connect();
      repo = new FeedbackRepository(db);
    });

    async function seed() {
      const courseId = new ObjectId();
      const courseVersionId = new ObjectId();
      const formId = new ObjectId();
      const users = await db.getCollection('users');
      const asha = new ObjectId();
      const ravi = new ObjectId();
      // Unique per seed: users has unique email and firebaseUID indexes.
      const tag = new ObjectId().toString();
      await users.insertMany([
        {
          _id: asha,
          firebaseUID: `a-${tag}`,
          firstName: 'Asha',
          lastName: 'Rao',
          email: `asha.rao.${tag}@example.com`,
        },
        {
          _id: ravi,
          firebaseUID: `r-${tag}`,
          firstName: 'Ravi',
          lastName: 'Kumar',
          email: `rk-${tag}@example.com`,
        },
      ] as any);
      await db.getCollection('feedback_forms').then(c =>
        c.insertOne({
          _id: formId,
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
              },
            },
          },
        } as any),
      );
      const subs = await db.getCollection('feedback_submission');
      const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 10, min));
      // Asha: two legacy duplicates (no isCurrent flag); the later one counts.
      await subs.insertMany([
        {
          userId: asha,
          courseId,
          courseVersionId,
          feedbackFormId: formId,
          details: {Useful: 'n'},
          createdAt: at(1),
        },
        {
          userId: asha,
          courseId,
          courseVersionId,
          feedbackFormId: formId,
          details: {Useful: 'v'},
          createdAt: at(5),
        },
        {
          userId: ravi,
          courseId,
          courseVersionId,
          feedbackFormId: formId,
          details: {Useful: 'n'},
          createdAt: at(3),
        },
      ] as any);
      return {courseId, courseVersionId, formId, asha, ravi, tag};
    }

    it('lists each student once, with their latest answer, newest first', async () => {
      const {courseId, formId} = await seed();
      const page = await repo.getFeedbackSubmissionById(
        formId.toString(),
        courseId.toString(),
        '',
        1,
        20,
      );
      expect(page.total).toBe(2);
      expect(
        page.submissions.map((s: any) => [s.user.firstName, s.details.Useful]),
      ).toEqual([
        ['Asha', 'Very useful'],
        ['Ravi', 'Not useful'],
      ]);
    });

    it('includes replaced answers on request, marked as not current', async () => {
      const {courseId, formId, asha} = await seed();
      const page = await repo.getFeedbackSubmissionById(
        formId.toString(),
        courseId.toString(),
        '',
        1,
        20,
        {
          userId: asha.toString(),
          history: 'all',
        },
      );
      expect(
        page.submissions.map((s: any) => [
          s.details.Useful,
          s.isCurrentVersion,
        ]),
      ).toEqual([
        ['Very useful', true],
        ['Not useful', false],
      ]);
    });

    it('searches first name, last name, full name and email', async () => {
      const {courseId, formId, tag} = await seed();
      const search = async (term: string) =>
        (
          await repo.getFeedbackSubmissionById(
            formId.toString(),
            courseId.toString(),
            term,
            1,
            20,
          )
        ).submissions.map((s: any) => s.user.firstName);
      expect(await search('rao')).toEqual(['Asha']);
      expect(await search('asha r')).toEqual(['Asha']);
      expect(await search(`rk-${tag}@`)).toEqual(['Ravi']);
      expect(await search('(')).toEqual([]);
    });

    it('marks earlier answers replaced and finds the current one', async () => {
      const {formId, asha, courseId, courseVersionId} = await seed();
      expect(await repo.markReplaced(asha.toString(), formId.toString())).toBe(
        2,
      );
      await repo.createFeedback({
        userId: asha,
        courseId,
        courseVersionId,
        feedbackFormId: formId,
        details: {Useful: 'n'},
        previousItemId: null,
        previousItemType: null,
        isCurrent: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      const current = await repo.findCurrentForUser(
        asha.toString(),
        formId.toString(),
      );
      expect(current?.details).toEqual({Useful: 'n'});
      const replaced = await (
        await db.getCollection('feedback_submission')
      ).countDocuments({userId: asha, isCurrent: false});
      expect(replaced).toBe(2);
      // Still one current answer per student.
      expect(
        await repo.getCurrentAnswerDetails(
          formId.toString(),
          courseId.toString(),
        ),
      ).toHaveLength(2);
    });

    it('returns null when a student has not answered', async () => {
      const {formId} = await seed();
      expect(
        await repo.findCurrentForUser(
          new ObjectId().toString(),
          formId.toString(),
        ),
      ).toBeNull();
    });
  },
);
