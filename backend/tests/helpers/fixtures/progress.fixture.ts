import { ObjectId } from 'mongodb';

export interface ProgressFixture {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  itemId: ObjectId;
  watchedPct: number;
  completed: boolean;
  lastWatchedAt: Date;
}

export function makeProgress(overrides: Partial<ProgressFixture> = {}): ProgressFixture {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(),
    courseId: new ObjectId(),
    courseVersionId: new ObjectId(),
    itemId: new ObjectId(),
    watchedPct: 0,
    completed: false,
    lastWatchedAt: new Date(),
    ...overrides,
  };
}
