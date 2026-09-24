import { apiClient } from '../api-client.js';

export interface TranscriptInput {
  videoId?: string;
  videoTitle?: string;
  transcriptText: string;
}

export interface GenerateStudyNotesPayload {
  courseVersionId: string;
  sectionId: string;
  sectionTitle?: string;
  transcripts: TranscriptInput[];
}

export interface SectionStudyNoteResponse {
  _id?: string;
  courseVersionId: string;
  sectionId: string;
  sectionTitle: string;
  contentMarkdown?: string;
  generatedAt: string;
  status: 'pending' | 'ready' | 'error';
  errorMessage?: string;
}

export const studyNotesApi = {
  generateNotes: async (payload: GenerateStudyNotesPayload) => {
    const response = await apiClient.post<{ status: string; message: string }>('/notes/section/generate', payload);
    return response.data;
  },

  getNotes: async (versionId: string, sectionId: string) => {
    const response = await apiClient.get<SectionStudyNoteResponse>(`/notes/section/versions/${versionId}/sections/${sectionId}`);
    return response.data;
  },

  regenerateNotes: async (versionId: string, sectionId: string, payload: GenerateStudyNotesPayload) => {
    const response = await apiClient.post<{ status: string; message: string }>(`/notes/section/versions/${versionId}/sections/${sectionId}/regenerate`, payload);
    return response.data;
  },
};
