/**
 * Integration test for crowd-sourced question promotion (PR #1096).
 *
 * Student questions are submitted at a video→quiz transition and stored against
 * the VIDEO item's id. They must promote into the question bank of the quiz
 * that sits immediately AFTER that video in the same section. This test drives
 * the real `_resolveTargetQuiz` / `_promoteToQuestionBank` paths and the real
 * `ItemRepository` against an in-memory MongoDB, so the actual repository
 * queries, `order` sorting, and class-transformer serialization are exercised
 * (not mocked).
 *
 * Why a `db` shim instead of the DI container: the production MongoDatabase
 * hardcodes `tls:true` (Atlas-only) and cannot point at an in-memory server,
 * and the module DI graph has circular imports. The shim exposes the single
 * method ItemRepository uses (`getCollection`) backed by real in-memory
 * collections. The unchanged downstream services are spied so we can assert
 * exactly what the promotion routes to them.
 */
import 'reflect-metadata';
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {MongoClient, ObjectId} from 'mongodb';

describe('crowd-q promotion (real ItemRepository over in-memory Mongo)', () => {
  let replset: MongoMemoryReplSet;
  let client: MongoClient;
  let service: any;

  const created: any[] = [];
  const added: Array<{bankId: string; questionId: string}> = [];
  const promotedSet: Array<{sqId: string; promotedId: string}> = [];

  const sectionId = new ObjectId();
  const groupId = new ObjectId();
  const videoId = new ObjectId();
  const quizId = new ObjectId();
  const bankId = new ObjectId();
  const trailingVideoId = new ObjectId();

  beforeAll(async () => {
    replset = await MongoMemoryReplSet.create({replSet: {count: 1}});
    client = new MongoClient(replset.getUri());
    await client.connect();
    const db = client.db('vibe');

    await db.collection('videos').insertMany([
      {_id: videoId, type: 'VIDEO', name: 'Intro video'},
      {_id: trailingVideoId, type: 'VIDEO', name: 'Outro video'},
    ] as any);
    await db.collection('quizzes').insertOne({
      _id: quizId,
      type: 'QUIZ',
      name: 'Section quiz',
      details: {questionBankRefs: [{bankId}]},
    } as any);
    await db.collection('itemsGroup').insertOne({
      _id: groupId,
      sectionId,
      items: [
        {_id: videoId, type: 'VIDEO', order: 'a', name: 'Intro video'},
        {_id: quizId, type: 'QUIZ', order: 'b', name: 'Section quiz'},
        {_id: trailingVideoId, type: 'VIDEO', order: 'c', name: 'Outro video'},
      ],
    } as any);

    const dbShim = {
      async getCollection(name: string) {
        return client.db('vibe').collection(name);
      },
    };

    const {ItemRepository} = await import(
      '#root/shared/database/providers/mongo/repositories/ItemRepository.js'
    );
    const {StudentQuestionService} = await import(
      '../services/StudentQuestionService.js'
    );

    const itemRepo = new ItemRepository(dbShim as any, {} as any);

    const questionServiceSpy = {
      async create(q: any) {
        const id = new ObjectId().toString();
        created.push({id, q});
        return id;
      },
      async setReviewStatus() {},
      async delete() {},
    };
    const questionBankServiceSpy = {
      async addQuestion(b: string, q: string) {
        added.push({bankId: b, questionId: q});
        return null;
      },
    };
    const repositorySpy = {
      async setPromotedQuestionId(sqId: string, promotedId: string) {
        promotedSet.push({sqId, promotedId});
      },
    };

    service = new StudentQuestionService(
      repositorySpy as any,
      {} as any,
      {} as any,
      questionServiceSpy as any,
      questionBankServiceSpy as any,
      itemRepo,
    );
  }, 120000);

  afterAll(async () => {
    try {
      await client?.close();
    } finally {
      await replset?.stop();
    }
  });

  it('resolves the quiz immediately after the video', async () => {
    const quiz = await service._resolveTargetQuiz(videoId.toString());
    expect(quiz?._id?.toString()).toBe(quizId.toString());
    expect(quiz?.details?.questionBankRefs?.[0]?.bankId?.toString()).toBe(
      bankId.toString(),
    );
  }, 60000);

  it('promotes a STUDENT_GENERATED/PENDING_REVIEW question into that quiz bank', async () => {
    const sqId = new ObjectId().toString();
    await service._promoteToQuestionBank(sqId, {
      segmentId: videoId.toString(),
      questionText: 'What does useEffect run after?',
      options: [{text: 'render'}, {text: 'never'}, {text: 'import'}],
      correctOptionIndex: 0,
      createdBy: new ObjectId().toString(),
    });

    const q = created.at(-1)?.q;
    expect(q?.source).toBe('STUDENT_GENERATED');
    expect(q?.reviewStatus).toBe('PENDING_REVIEW');
    expect(q?.correctLotItem?.text).toBe('render');

    expect(added.at(-1)?.bankId).toBe(bankId.toString());
    expect(promotedSet.at(-1)?.sqId).toBe(sqId);
  }, 60000);

  it('does not promote when the item after the video is not a quiz', async () => {
    const before = added.length;
    await service._promoteToQuestionBank(new ObjectId().toString(), {
      segmentId: trailingVideoId.toString(),
      questionText: 'Should never be promoted anywhere.',
      options: [{text: 'a'}, {text: 'b'}],
      correctOptionIndex: 0,
      createdBy: new ObjectId().toString(),
    });
    expect(added.length).toBe(before);
  }, 60000);
});
