import {IAssessmentRepository} from '#root/modules/projects/interfaces/IAssessmentRepository.js';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {IAssessment, IAssessmentCriterionScore} from '../../model.js';
import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';

@injectable()
export class AssessmentRepository implements IAssessmentRepository {
  private _assessmentCollection: Collection<IAssessment>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this._assessmentCollection =
      await this.db.getCollection<IAssessment>('project_assessments');
  }

  async getBySubmissionId(
    submissionId: string,
    session?: ClientSession,
  ): Promise<IAssessment | null> {
    if (!ObjectId.isValid(submissionId)) return null;
    await this.init();
    return await this._assessmentCollection.findOne(
      {submissionId: new ObjectId(submissionId)},
      {session},
    );
  }

  async upsert(
    submissionId: string,
    rubricId: string,
    assessedBy: string,
    criteria: IAssessmentCriterionScore[],
    totalPoints: number,
    maxPoints: number,
    percentage: number,
    overallFeedback?: string,
    session?: ClientSession,
  ): Promise<IAssessment> {
    await this.init();
    const now = new Date();
    const setOnInsert = {assessedAt: now};
    const setFields: Partial<IAssessment> & {updatedAt: Date} = {
      rubricId: new ObjectId(rubricId),
      assessedBy: new ObjectId(assessedBy),
      criteria,
      totalPoints,
      maxPoints,
      percentage,
      updatedAt: now,
    };
    if (overallFeedback !== undefined) {
      setFields.overallFeedback = overallFeedback;
    }

    const result = await this._assessmentCollection.findOneAndUpdate(
      {submissionId: new ObjectId(submissionId)},
      {
        $set: setFields,
        $setOnInsert: setOnInsert,
      },
      {session, upsert: true, returnDocument: 'after'},
    );
    return result as IAssessment;
  }

  async countByRubricId(
    rubricId: string,
    session?: ClientSession,
  ): Promise<number> {
    if (!ObjectId.isValid(rubricId)) return 0;
    await this.init();
    return await this._assessmentCollection.countDocuments(
      {rubricId: new ObjectId(rubricId)},
      {session},
    );
  }
}
