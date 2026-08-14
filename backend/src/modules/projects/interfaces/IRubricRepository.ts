import {ClientSession} from 'mongodb';
import {IRubric} from '../repositories/model.js';
import {ID} from '#root/shared/index.js';

export interface IRubricRepository {
  create(
    rubric: Omit<IRubric, '_id' | 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<ID>;

  getById(
    rubricId: string,
    session?: ClientSession,
  ): Promise<IRubric | null>;

  getByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IRubric[]>;

  getAll(session?: ClientSession): Promise<IRubric[]>;

  update(
    rubricId: string,
    patch: Pick<Partial<IRubric>, 'title' | 'description' | 'criteria'>,
    session?: ClientSession,
  ): Promise<IRubric | null>;

  /**
   * Deletes a rubric document by ID.
   * @returns `true` if a document was deleted, `false` if no match was found.
   */
  delete(rubricId: string, session?: ClientSession): Promise<boolean>;
}
