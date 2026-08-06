import {ClientSession} from 'mongodb';
import {IAssessment, IAssessmentCriterionScore} from '../repositories/model.js';

export interface IAssessmentRepository {
  getBySubmissionId(
    submissionId: string,
    session?: ClientSession,
  ): Promise<IAssessment | null>;

  upsert(
    submissionId: string,
    rubricId: string,
    assessedBy: string,
    criteria: IAssessmentCriterionScore[],
    totalPoints: number,
    maxPoints: number,
    percentage: number,
    overallFeedback?: string,
    session?: ClientSession,
  ): Promise<IAssessment>;

  countByRubricId(
    rubricId: string,
    session?: ClientSession,
  ): Promise<number>;
}
