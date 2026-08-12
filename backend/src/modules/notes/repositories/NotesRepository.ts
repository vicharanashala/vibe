import { inject, injectable } from 'inversify';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';

export interface NoteSection {
  heading: string;
  content: string;
  keyPoints: string[];
}

export interface StructuredNotes {
  title: string;
  summary: string;
  sections: NoteSection[];
}

export interface CourseNote {
  _id?: ObjectId;
  courseVersionId: string;
  moduleId: string;
  moduleName: string;
  generatedAt: Date;
  status: 'pending' | 'ready' | 'error';
  errorMessage?: string;
  notes?: StructuredNotes;
}

@injectable()
export class NotesRepository {
  private notesCollection: Collection<CourseNote>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    this.notesCollection = await this.db.getCollection<CourseNote>('course_notes');
    await this.notesCollection.createIndex(
      { courseVersionId: 1, moduleId: 1 },
      { unique: true },
    );
  }

  async upsert(
    data: Omit<CourseNote, '_id'>,
    session?: ClientSession,
  ): Promise<CourseNote> {
    await this.init();
    const filter = {
      courseVersionId: data.courseVersionId,
      moduleId: data.moduleId,
    };
    await this.notesCollection.updateOne(
      filter,
      { $set: data },
      { upsert: true, session },
    );
    return this.notesCollection.findOne(filter, { session }) as Promise<CourseNote>;
  }

  async findByVersionAndModule(
    courseVersionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<CourseNote | null> {
    await this.init();
    return this.notesCollection.findOne(
      { courseVersionId, moduleId },
      { session },
    );
  }

  async findAllByVersion(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<CourseNote[]> {
    await this.init();
    return this.notesCollection
      .find({ courseVersionId }, { session })
      .sort({ moduleName: 1 })
      .toArray();
  }
}
