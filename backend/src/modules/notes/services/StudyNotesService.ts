import { inject, injectable } from 'inversify';
import OpenAI from 'openai';
import { Groq } from 'groq-sdk';
import { aiConfig } from '#root/config/ai.js';
import { STUDY_NOTES_TYPES, SectionStudyNoteDocument, TranscriptItem } from '../types/studyNotesTypes.js';
import { StudyNotesRepository } from '../repositories/StudyNotesRepository.js';
import { StudyNotesChunker } from './StudyNotesChunker.js';
import {
  STUDY_NOTES_SYSTEM_PROMPT,
  INTERMEDIATE_EXTRACTION_PROMPT,
  SYNTHESIS_PROMPT,
} from '../prompts/studyNotesPrompt.js';

@injectable()
export class StudyNotesService {
  private aiClient: OpenAI | Groq | null = null;
  private clientProvider: string | null = null;

  constructor(
    @inject(STUDY_NOTES_TYPES.StudyNotesRepository)
    private readonly studyNotesRepository: StudyNotesRepository,
  ) {}

  private getLlmClient(): { client: OpenAI | Groq; provider: string; modelName: string } {
    const provider = (aiConfig.LLM_PROVIDER || process.env.LLM_PROVIDER || 'minimax').toLowerCase();

    if (this.aiClient && this.clientProvider === provider) {
      const modelName =
        provider === 'groq'
          ? aiConfig.GROQ_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
          : aiConfig.MINIMAX_MODEL || process.env.MINIMAX_MODEL || 'minimax-m3';
      return { client: this.aiClient, provider, modelName };
    }

    if (provider === 'groq') {
      const apiKey = aiConfig.GROQ_API_KEY || process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('Groq API key (GROQ_API_KEY) is not configured.');
      }
      this.aiClient = new Groq({ apiKey });
      this.clientProvider = 'groq';
      const modelName = aiConfig.GROQ_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      return { client: this.aiClient, provider, modelName };
    } else {
      const apiKey = aiConfig.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        throw new Error('MiniMax API key (MINIMAX_API_KEY) is not configured.');
      }
      this.aiClient = new OpenAI({
        baseURL: 'https://api.minimax.io/v1',
        apiKey,
      });
      this.clientProvider = 'minimax';
      const modelName = aiConfig.MINIMAX_MODEL || process.env.MINIMAX_MODEL || 'minimax-m3';
      return { client: this.aiClient, provider, modelName };
    }
  }

  /**
   * Safe fire-and-forget entry point for section notes generation.
   */
  async generateSectionNotes(
    courseVersionId: string,
    sectionId: string,
    sectionTitle: string,
    transcripts: TranscriptItem[],
  ): Promise<void> {
    // 1. Mark status as pending in MongoDB
    await this.studyNotesRepository.upsert({
      courseVersionId,
      sectionId,
      sectionTitle: sectionTitle || 'Untitled Section',
      generatedAt: new Date(),
      status: 'pending',
    });

    // 2. Perform async LLM processing
    try {
      const activeProvider = (aiConfig.LLM_PROVIDER || process.env.LLM_PROVIDER || 'minimax').toLowerCase();
      const chunkResult = StudyNotesChunker.processTranscripts(transcripts, sectionTitle, activeProvider);
      let finalMarkdown = '';

      if (!chunkResult.isChunked) {
        // Single-pass direct generation
        console.log(`[StudyNotesService] Single-pass generation for section "${sectionTitle}" (${StudyNotesChunker.estimateTokens(chunkResult.fullCombinedText)} tokens)...`);
        finalMarkdown = await this.generateSinglePassNotes(chunkResult.fullCombinedText, sectionTitle);
      } else {
        // Multi-pass fallback chunking (intermediate extractions in-memory only)
        console.log(`[StudyNotesService] Multi-pass chunked generation for section "${sectionTitle}" (${chunkResult.chunks.length} chunks)...`);
        finalMarkdown = await this.generateMultiPassNotes(chunkResult.chunks, sectionTitle);
      }

      // 3. Update MongoDB with ready status and final Markdown content
      await this.studyNotesRepository.upsert({
        courseVersionId,
        sectionId,
        sectionTitle: sectionTitle || 'Untitled Section',
        contentMarkdown: finalMarkdown,
        generatedAt: new Date(),
        status: 'ready',
      });
    } catch (error: any) {
      console.error('[StudyNotesService] Failed to generate section notes:', error?.message || error);
      await this.studyNotesRepository.upsert({
        courseVersionId,
        sectionId,
        sectionTitle: sectionTitle || 'Untitled Section',
        generatedAt: new Date(),
        status: 'error',
        errorMessage: error?.message || 'Unknown error occurred during generation',
      });
    }
  }

  /**
   * Fetches existing section notes document.
   */
  async getSectionNotes(
    courseVersionId: string,
    sectionId: string,
  ): Promise<SectionStudyNoteDocument | null> {
    return this.studyNotesRepository.findBySection(courseVersionId, sectionId);
  }

  /**
   * Single-pass LLM call.
   */
  private async generateSinglePassNotes(combinedText: string, sectionTitle: string): Promise<string> {
    const userPrompt = `Section Title: ${sectionTitle}\n\nTRANSCRIPTS:\n${combinedText}`;
    return this.callLlmWithRetry(STUDY_NOTES_SYSTEM_PROMPT, userPrompt);
  }

  /**
   * 2-pass LLM execution for long transcripts exceeding provider single-pass threshold.
   * Intermediate chunk outputs are kept in-memory and discarded after synthesis.
   */
  private async generateMultiPassNotes(chunks: string[], sectionTitle: string): Promise<string> {
    const intermediateExtractions: string[] = [];

    // Pass 1: Intermediate extraction per chunk
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[StudyNotesService] Processing chunk ${i + 1}/${chunks.length}...`);
      const chunkPrompt = `Chunk ${i + 1} of ${chunks.length} for section "${sectionTitle}":\n\n${chunks[i]}`;
      // Lower max_tokens to 2048 for chunk extractions to stay well within TPM reservation limits
      const rawExtraction = await this.callLlmWithRetry(INTERMEDIATE_EXTRACTION_PROMPT, chunkPrompt, 3, 2048);
      intermediateExtractions.push(`### Chunk ${i + 1} Raw Topics:\n${rawExtraction}`);

      if (i < chunks.length - 1) {
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    // Pass 2: Final synthesis pass
    console.log(`[StudyNotesService] Synthesizing final study notes from ${chunks.length} chunks...`);
    const synthesisUserPrompt = `Section Title: ${sectionTitle}\n\nEXTRACTED TOPICS FROM TRANSCRIPT CHUNKS:\n${intermediateExtractions.join('\n\n')}`;
    const synthesisSystemPrompt = `${STUDY_NOTES_SYSTEM_PROMPT}\n\n${SYNTHESIS_PROMPT}`;

    return this.callLlmWithRetry(synthesisSystemPrompt, synthesisUserPrompt, 3, 8192);
  }

  /**
   * Call LLM API with retry logic (up to 3 retries with backoff).
   */
  private async callLlmWithRetry(
    systemPrompt: string,
    userMessage: string,
    retries = 3,
    maxTokens = 8192,
  ): Promise<string> {
    const { client, provider, modelName } = this.getLlmClient();
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await (client as any).chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: maxTokens,
        });

        const rawText = response.choices[0]?.message?.content ?? '';
        return rawText.trim();
      } catch (err: any) {
        lastError = err;
        console.warn(`[StudyNotesService] LLM call attempt ${attempt + 1} (${provider}) failed: ${err?.message || err}`);
        if (attempt < retries) {
          // Exponential backoff: 2000ms, 4000ms, 8000ms
          const backoffMs = 2000 * Math.pow(2, attempt);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }

    throw new Error(`LLM API call (${provider}) failed after ${retries + 1} attempts: ${lastError?.message || lastError}`);
  }
}
