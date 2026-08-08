import { IPacingGroup } from '#shared/interfaces/models.js';
import { ClientSession, ObjectId } from 'mongodb';

export interface IPacingGroupRepository {
  getByUserId(
    userId: string | ObjectId,
    session?: ClientSession,
  ): Promise<IPacingGroup | null>;

  upsertForUser(
    userId: string | ObjectId,
    targetCompletionDate: Date,
    courseSelections: Array<{
      courseId: string | ObjectId;
      courseVersionId: string | ObjectId;
      cohortId?: string | ObjectId;
    }>,
    session?: ClientSession,
  ): Promise<void>;

  clearForUser(
    userId: string | ObjectId,
    session?: ClientSession,
  ): Promise<void>;
}
