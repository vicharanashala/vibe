import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable } from 'inversify';
import { ClientSession, Collection } from 'mongodb';
import { ConceptMap } from '#root/modules/genAI/classes/transformers/ConceptMap.js';

@injectable()
export class ConceptMapRepository {
  private conceptMapCollection: Collection<ConceptMap>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  async init() {
    this.conceptMapCollection =
      await this.db.getCollection<ConceptMap>('conceptmaps');
  }

  /**
   * One published map per job: re-publishing (e.g. after a rerun +
   * re-upload) replaces the previous document instead of accumulating.
   */
  async upsertForJob(map: ConceptMap, session?: ClientSession): Promise<void> {
    await this.init();
    const { _id, ...doc } = map;
    await this.conceptMapCollection.replaceOne(
      { jobId: map.jobId },
      doc,
      { upsert: true, session },
    );
  }

  async getBySection(
    versionId: string,
    sectionId: string,
    session?: ClientSession,
  ): Promise<ConceptMap[]> {
    await this.init();
    return this.conceptMapCollection
      .find({ versionId, sectionId }, { session })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async getByJob(
    jobId: string,
    session?: ClientSession,
  ): Promise<ConceptMap | null> {
    await this.init();
    return this.conceptMapCollection.findOne({ jobId }, { session });
  }
}
