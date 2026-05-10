import { faker } from '@faker-js/faker';
import { ObjectId } from 'mongodb';

export interface CourseFixture {
  _id: ObjectId;
  name: string;
  description: string;
  versions: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export function makeCourse(overrides: Partial<CourseFixture> = {}): CourseFixture {
  const now = new Date();
  return {
    _id: new ObjectId(),
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(),
    versions: [],
    createdBy: new ObjectId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export interface CourseVersionFixture {
  _id: ObjectId;
  courseId: ObjectId;
  version: string;
  modules: ObjectId[];
  createdAt: Date;
}

export function makeCourseVersion(overrides: Partial<CourseVersionFixture> = {}): CourseVersionFixture {
  return {
    _id: new ObjectId(),
    courseId: new ObjectId(),
    version: faker.system.semver(),
    modules: [],
    createdAt: new Date(),
    ...overrides,
  };
}

export interface ItemFixture {
  _id: ObjectId;
  type: 'video' | 'quiz' | 'article';
  title: string;
  sectionId: ObjectId;
  order: string;
  payload: Record<string, unknown>;
}

export function makeItem(overrides: Partial<ItemFixture> = {}): ItemFixture {
  return {
    _id: new ObjectId(),
    type: 'video',
    title: faker.lorem.words(3),
    sectionId: new ObjectId(),
    order: faker.string.alphanumeric(8),
    payload: { url: faker.internet.url(), durationSec: faker.number.int({ min: 30, max: 3600 }) },
    ...overrides,
  };
}
