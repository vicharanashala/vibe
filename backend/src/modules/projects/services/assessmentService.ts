import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {inject, injectable} from 'inversify';
import {PROJECTS_TYPES} from '../types.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {IAssessmentRepository} from '../interfaces/IAssessmentRepository.js';
import {IRubricRepository} from '../interfaces/IRubricRepository.js';
import {IProjectSubmissionRepository} from '../interfaces/IProjectSubmissionRepository.js';
import {IAssessment, IAssessmentCriterionScore} from '../repositories/model.js';

@injectable()
export class AssessmentService extends BaseService {
  constructor(
    @inject(PROJECTS_TYPES.AssessmentRepository)
    private readonly _assessmentRepository: IAssessmentRepository,

    @inject(PROJECTS_TYPES.RubricRepository)
    private readonly _rubricRepository: IRubricRepository,

    @inject(PROJECTS_TYPES.projectSubmissionRepository)
    private readonly _submissionRepository: IProjectSubmissionRepository,

    @inject(GLOBAL_TYPES.Database)
    public readonly database: MongoDatabase,
  ) {
    super(database);
  }

  /**
   * Upserts an assessment for a submission.
   * Score calculation is 100% server-side — totalPoints, maxPoints, percentage
   * are computed here; never trust client-supplied values.
   * Does NOT touch the submission's `featured` field.
   */
  async saveAssessment(
    submissionId: string,
    rubricId: string,
    assessedBy: string,
    clientCriteria: {criterionId: string; points: number; feedback?: string}[],
    overallFeedback?: string,
  ): Promise<IAssessment> {
    return this._withTransaction(async session => {
      // 1. Load rubric — authoritative source for criteria and maxPoints
      const rubric = await this._rubricRepository.getById(rubricId, session);
      if (!rubric) throw new NotFoundError('Rubric not found.');

      // Build a map for O(1) lookup: criterionId → criterion
      const criterionMap = new Map(
        rubric.criteria.map(c => [c.id, c]),
      );

      // Guard: every criterion must have maxPoints > 0.
      // Prevents divide-by-zero in percentage computation even if the rubric
      // was seeded directly into Mongo without going through the DTO validator.
      for (const c of rubric.criteria) {
        if (c.maxPoints <= 0) {
          throw new BadRequestError(
            `Criterion '${c.name}' has maxPoints ${c.maxPoints} — all criteria must be worth at least 1 point. ` +
            'Fix the rubric before assessing.',
          );
        }
      }

      const scoredCriteria: IAssessmentCriterionScore[] = [];
      let totalPoints = 0;

      for (const item of clientCriteria) {
        const criterion = criterionMap.get(item.criterionId);
        if (!criterion) {
          throw new BadRequestError(
            `Unknown criterionId '${item.criterionId}' — it does not exist in this rubric.`,
          );
        }
        if (item.points < 0) {
          throw new BadRequestError(
            `Points for criterion '${criterion.name}' cannot be negative.`,
          );
        }
        if (item.points > criterion.maxPoints) {
          throw new BadRequestError(
            `Points (${item.points}) for criterion '${criterion.name}' exceed maxPoints (${criterion.maxPoints}).`,
          );
        }
        scoredCriteria.push({
          criterionId: item.criterionId,
          points: item.points,
          feedback: item.feedback,
        });
        totalPoints += item.points;
      }

      // 3. Server-side computation — maxPoints is always from the rubric at assessment time
      const maxPoints = rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
      const percentage =
        maxPoints > 0
          ? Math.round((totalPoints / maxPoints) * 10000) / 100
          : 0;

      // 4. Upsert — no duplicate assessment documents per submission
      const assessment = await this._assessmentRepository.upsert(
        submissionId,
        rubricId,
        assessedBy,
        scoredCriteria,
        totalPoints,
        maxPoints,
        percentage,
        overallFeedback,
        session,
      );

      if (!assessment) throw new InternalServerError('Failed to save assessment.');
      return assessment;
    });
  }

  async getAssessmentBySubmissionId(submissionId: string): Promise<IAssessment | null> {
    return this._assessmentRepository.getBySubmissionId(submissionId);
  }
}
