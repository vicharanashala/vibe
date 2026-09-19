import { inject, injectable } from 'inversify';
import Anthropic from '@anthropic-ai/sdk';
import JSON5 from 'json5';
import { aiConfig } from '#root/config/ai.js';
import { NOTES_TYPES } from '../types.js';
import { NotesRepository, StructuredNotes, CourseNote } from '../repositories/NotesRepository.js';

@injectable()
export class NotesService {
  constructor(
    @inject(NOTES_TYPES.NotesRepository)
    private readonly notesRepository: NotesRepository,
  ) {}

  /**
   * Generate structured notes from raw transcript text using Claude.
   * Saves the result (or error) to MongoDB.
   * Safe to call without await — errors are caught internally.
   */
  async generateNotesFromText(
    transcriptText: string,
    courseVersionId: string,
    moduleId: string,
    moduleName: string,
  ): Promise<void> {
    // Mark as pending immediately
    await this.notesRepository.upsert({
      courseVersionId,
      moduleId,
      moduleName,
      generatedAt: new Date(),
      status: 'pending',
    });

    try {
      const ANTHROPIC_CRED = aiConfig.ANTHROPIC_CRED;
      const ANTHROPIC_MODEL = aiConfig.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

      if (!ANTHROPIC_CRED) {
        throw new Error('Anthropic API key not configured');
      }

      const prompt = this.buildNotesPrompt(moduleName);

      const client = new Anthropic({ apiKey: ANTHROPIC_CRED });

      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nTRANSCRIPT:\n${transcriptText}`,
          },
        ],
      });

      const rawText =
        response.content?.map(c => ('text' in c ? c.text : '')).join('') ?? '';

      // Strip markdown fences if present
      const cleaned = rawText.replace(/```json|```/gi, '').trim();

      let parsed: StructuredNotes;
      try {
        parsed = JSON5.parse(cleaned) as StructuredNotes;
      } catch {
        throw new Error(`Failed to parse AI JSON response: ${cleaned.slice(0, 200)}`);
      }

      await this.notesRepository.upsert({
        courseVersionId,
        moduleId,
        moduleName,
        generatedAt: new Date(),
        status: 'ready',
        notes: parsed,
      });
    } catch (error: any) {
      console.error('[NotesService] Failed to generate notes:', error?.message ?? error);
      await this.notesRepository.upsert({
        courseVersionId,
        moduleId,
        moduleName,
        generatedAt: new Date(),
        status: 'error',
        errorMessage: error?.message ?? 'Unknown error',
      });
    }
  }

  async getModuleNotes(
    courseVersionId: string,
    moduleId: string,
  ): Promise<CourseNote | null> {
    return this.notesRepository.findByVersionAndModule(courseVersionId, moduleId);
  }

  async getAllVersionNotes(courseVersionId: string): Promise<CourseNote[]> {
    return this.notesRepository.findAllByVersion(courseVersionId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildNotesPrompt(moduleName: string): string {
    return `You are an expert educational content writer and instructor. Your task is to convert the provided video transcript into comprehensive, well-structured study notes for students.

The notes are for the module: "${moduleName}"

OUTPUT FORMAT (return ONLY valid JSON, no markdown, no extra text):

{
  "title": "string — clear, descriptive title for the module",
  "summary": "string — 2-4 sentence executive summary of the entire module",
  "sections": [
    {
      "heading": "string — concise section title",
      "content": "string — detailed explanation in clear prose (2-6 sentences)",
      "keyPoints": ["string", "string", "..."] // 3-7 bullet-point takeaways
    }
  ]
}

RULES:
- Create 4-8 logical sections that group related concepts together
- Use plain, clear English — avoid jargon unless explained
- keyPoints should be actionable, memorable takeaways a student can revise from
- Do NOT invent information not present in the transcript
- If the transcript is very short or unclear, create fewer sections but keep quality high
- Return ONLY the JSON object, nothing else`;
  }
}
