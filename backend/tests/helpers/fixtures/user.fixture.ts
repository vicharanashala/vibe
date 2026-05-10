import { faker } from '@faker-js/faker';
import { ObjectId } from 'mongodb';

export interface UserFixture {
  _id: ObjectId;
  firebaseUID: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  const now = new Date();
  return {
    _id: new ObjectId(),
    firebaseUID: faker.string.alphanumeric(28),
    email: faker.internet.email().toLowerCase(),
    firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
    lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
    roles: ['student'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeStudent(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUser({ roles: ['student'], ...overrides });
}

export function makeTeacher(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUser({ roles: ['teacher'], ...overrides });
}

export function makeAdmin(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUser({ roles: ['admin'], ...overrides });
}
