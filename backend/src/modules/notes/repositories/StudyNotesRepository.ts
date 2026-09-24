import { inject, injectable } from 'inversify';
import { Collection, ClientSession } from 'mongodb';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { SectionStudyNoteDocument } from '../types/studyNotesTypes.js';

@injectable()
export class StudyNotesRepository {
  private collection: Collection<SectionStudyNoteDocument>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this.collection) {
      this.collection = await this.db.getCollection<SectionStudyNoteDocument>('section_study_notes');
      await this.collection.createIndex(
        { courseVersionId: 1, sectionId: 1 },
        { unique: true },
      );
    }
  }

  async upsert(
    data: Omit<SectionStudyNoteDocument, '_id'>,
    session?: ClientSession,
  ): Promise<SectionStudyNoteDocument> {
    await this.init();
    const filter = {
      courseVersionId: data.courseVersionId,
      sectionId: data.sectionId,
    };
    await this.collection.updateOne(
      filter,
      { $set: data },
      { upsert: true, session },
    );
    const result = await this.collection.findOne(filter, { session });
    return result as SectionStudyNoteDocument;
  }

  async findBySection(
    courseVersionId: string,
    sectionId: string,
    session?: ClientSession,
  ): Promise<SectionStudyNoteDocument | null> {
    await this.init();
    return this.collection.findOne(
      { courseVersionId, sectionId },
      { session },
    );
  }

  async findAllByVersion(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<SectionStudyNoteDocument[]> {
    await this.init();
    return this.collection
      .find({ courseVersionId }, { session })
      .toArray();
  }
}
