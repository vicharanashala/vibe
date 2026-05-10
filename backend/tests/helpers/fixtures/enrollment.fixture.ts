import { ObjectId } from 'mongodb';

export interface EnrollmentFixture {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  status: 'active' | 'completed' | 'ejected' | 'dropped';
  enrolledAt: Date;
  completedAt: Date | null;
}

export function makeEnrollment(overrides: Partial<EnrollmentFixture> = {}): EnrollmentFixture {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(),
    courseId: new ObjectId(),
    courseVersionId: new ObjectId(),
    status: 'active',
    enrolledAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}
