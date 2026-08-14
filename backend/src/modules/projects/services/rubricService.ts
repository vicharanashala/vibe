import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {inject, injectable} from 'inversify';
import {PROJECTS_TYPES} from '../types.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {BadRequestError, NotFoundError, InternalServerError} from 'routing-controllers';
import {IRubricRepository} from '../interfaces/IRubricRepository.js';
import {IAssessmentRepository} from '../interfaces/IAssessmentRepository.js';
import {ICriterion, IRubric} from '../repositories/model.js';
import {ObjectId} from 'mongodb';

@injectable()
export class RubricService extends BaseService {
  constructor(
    @inject(PROJECTS_TYPES.RubricRepository)
    private readonly _rubricRepository: IRubricRepository,

    @inject(PROJECTS_TYPES.AssessmentRepository)
    private readonly _assessmentRepository: IAssessmentRepository,

    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Creates a rubric. Criterion IDs are always server-generated here —
   * any client-supplied id field on criteria DTOs is stripped before this call.
   */
  async createRubric(
    courseId: string,
    courseVersionId: string,
    title: string,
    description: string | undefined,
    criteriaInput: Omit<ICriterion, 'id'>[],
  ): Promise<IRubric> {
    return this._withTransaction(async session => {
      // Generate server-side IDs for each criterion
      const criteria: ICriterion[] = criteriaInput.map(c => ({
        ...c,
        id: new ObjectId().toString(),
      }));

      const rubricData: Omit<IRubric, '_id' | 'createdAt' | 'updatedAt'> = {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        title,
        description,
        criteria,
      };

      const id = await this._rubricRepository.create(rubricData, session);
      const rubric = await this._rubricRepository.getById(id.toString(), session);
      if (!rubric) throw new InternalServerError('Failed to create rubric.');
      return rubric;
    });
  }

  async getRubric(rubricId: string): Promise<IRubric> {
    const rubric = await this._rubricRepository.getById(rubricId);
    if (!rubric) throw new NotFoundError('Rubric not found.');
    return rubric;
  }

  async getRubricsByCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<IRubric[]> {
    return this._rubricRepository.getByCourseVersion(courseId, courseVersionId);
  }

  async getAllRubrics(): Promise<IRubric[]> {
    return this._rubricRepository.getAll();
  }

  async cloneRubricToCourseVersion(
    rubricId: string,
    targetCourseId: string,
    targetVersionId: string,
  ): Promise<IRubric> {
    const existing = await this.getRubric(rubricId);
    const criteriaInput = existing.criteria.map(c => ({
      name: c.name,
      description: c.description,
      maxPoints: c.maxPoints,
    }));
    return this.createRubric(
      targetCourseId,
      targetVersionId,
      `${existing.title} (Copy)`,
      existing.description,
      criteriaInput,
    );
  }

  /**
   * Updates a rubric — only if no assessments reference it yet (lock semantics).
   * Criterion IDs are NOT regenerated on update; the client must send back the
   * existing criterion IDs (server-generated at creation time).
   */
  async updateRubric(
    rubricId: string,
    patch: {
      title?: string;
      description?: string;
      criteria?: (Omit<ICriterion, 'id'> & {id?: string})[];
    },
  ): Promise<IRubric> {
    return this._withTransaction(async session => {
      const existing = await this._rubricRepository.getById(rubricId, session);
      if (!existing) throw new NotFoundError('Rubric not found.');

      const assessmentCount = await this._assessmentRepository.countByRubricId(rubricId, session);

      let finalCriteria: ICriterion[] | undefined = undefined;

      if (patch.criteria) {
        const oldCriteria = existing.criteria;
        if (assessmentCount > 0) {
          if (patch.criteria.length < oldCriteria.length) {
            throw new BadRequestError(
              'Existing criteria cannot be deleted from a rubric that has already been used in assessments.',
            );
          }

          // Verify all existing criteria (indices 0..oldCriteria.length - 1) match exactly
          for (let i = 0; i < oldCriteria.length; i++) {
            const oldC = oldCriteria[i];
            const newC = patch.criteria[i];
            if (
              !newC ||
              newC.id !== oldC.id ||
              newC.name !== oldC.name ||
              (newC.description || undefined) !== (oldC.description || undefined) ||
              newC.maxPoints !== oldC.maxPoints
            ) {
              throw new BadRequestError(
                `Existing criteria cannot be modified on a rubric that has already been used in assessments. ` +
                `Criterion '${oldC.name}' was modified or removed. You can only append new criteria to the end.`,
              );
            }
          }
        }

        // Assign server-generated IDs to criteria if missing
        finalCriteria = patch.criteria.map(c => ({
          ...c,
          id: c.id && c.id.trim().length > 0 ? c.id : new ObjectId().toString(),
        }));
      }

      const updated = await this._rubricRepository.update(
        rubricId,
        {
          ...(patch.title !== undefined ? {title: patch.title} : {}),
          ...(patch.description !== undefined ? {description: patch.description} : {}),
          ...(finalCriteria !== undefined ? {criteria: finalCriteria} : {}),
        },
        session,
      );
      if (!updated) throw new InternalServerError('Failed to update rubric.');
      return updated;
    });
  }

  /**
   * Returns the number of assessments that reference this rubric.
   * Used by the controller to populate `assessmentCount` on GET responses
   * so the frontend can determine lock state without a separate round-trip.
   */
  async getRubricAssessmentCount(rubricId: string): Promise<number> {
    return this._assessmentRepository.countByRubricId(rubricId);
  }

  /**
   * Deletes a rubric — only if no assessments reference it (lock semantics mirrors update).
   *
   * NOTE: The controller has already loaded and authorization-checked the rubric before
   * calling this method, so we skip the redundant existence re-fetch here. A NotFoundError
   * is still thrown as a safety net in case the document disappears between the controller's
   * load and this call (genuine race condition).
   */
  async deleteRubric(rubricId: string): Promise<void> {
    return this._withTransaction(async session => {
      // Lock check — reject if any assessment already references this rubric.
      // Deleting a rubric with assessments pointing to it would leave those
      // assessments with an orphaned rubricId reference.
      const assessmentCount = await this._assessmentRepository.countByRubricId(rubricId, session);
      if (assessmentCount > 0) {
        throw new BadRequestError(
          'This rubric cannot be deleted because it has already been used to assess a submission. ' +
          'Assessments still reference this rubric and deleting it would leave them with a broken reference.',
        );
      }

      const deleted = await this._rubricRepository.delete(rubricId, session);
      if (!deleted) {
        // Safety net: covers the race condition where the rubric was deleted
        // between the controller's existence check and this call.
        throw new NotFoundError('Rubric not found.');
      }
    });
  }
}
