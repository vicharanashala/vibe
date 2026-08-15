import { ObjectId } from 'mongodb';

export const STUDY_NOTES_TYPES = {
  StudyNotesRepository: Symbol.for('StudyNotesRepository'),
  StudyNotesService: Symbol.for('StudyNotesService'),
  StudyNotesController: Symbol.for('StudyNotesController'),
};

export interface TranscriptItem {
  videoId?: string;
  videoTitle?: string;
  transcriptText: string;
}

export type SectionStudyNoteStatus = 'pending' | 'ready' | 'error';

export interface SectionStudyNoteDocument {
  _id?: ObjectId;
  courseVersionId: string;
  sectionId: string;
  sectionTitle: string;
  contentMarkdown?: string;
  generatedAt: Date;
  status: SectionStudyNoteStatus;
  errorMessage?: string;
}

export interface IntermediateExtraction {
  chunkIndex: number;
  rawTopics: Array<{
    topicName: string;
    keyConcepts: string[];
    codeSnippetsOrFormulas?: string[];
    importantNotes?: string[];
  }>;
}
