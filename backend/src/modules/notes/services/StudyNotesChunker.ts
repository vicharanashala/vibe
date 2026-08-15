import { TranscriptItem } from '../types/studyNotesTypes.js';

export interface ChunkResult {
  isChunked: boolean;
  fullCombinedText: string;
  chunks: string[];
}

export interface ProviderChunkConfig {
  singlePassTokenLimit: number;
  chunkSizeTokens: number;
  overlapTokens: number;
}

export const PROVIDER_CHUNK_CONFIGS: Record<string, ProviderChunkConfig> = {
  minimax: {
    singlePassTokenLimit: 32000,
    chunkSizeTokens: 16000,
    overlapTokens: 1000,
  },
  groq: {
    // Groq free tier limit is 12,000 TPM for llama-3.3-70b-versatile.
    // Requested tokens = input_tokens + max_tokens (8192) + sys_prompt (~500).
    // Max safe single pass input transcript tokens = 12000 - 8192 - 500 - 308 (safety buffer) = 3000 tokens.
    singlePassTokenLimit: 3000,
    chunkSizeTokens: 2500,
    overlapTokens: 500,
  },
  gemini: {
    singlePassTokenLimit: 100000,
    chunkSizeTokens: 60000,
    overlapTokens: 2500,
  },
  anthropic: {
    singlePassTokenLimit: 80000,
    chunkSizeTokens: 40000,
    overlapTokens: 2000,
  },
};

export class StudyNotesChunker {
  private static readonly CHARS_PER_TOKEN = 4;

  /**
   * Concatenate transcripts into a unified section transcript text with video headers.
   */
  static combineTranscripts(transcripts: TranscriptItem[], sectionTitle?: string): string {
    const parts: string[] = [];
    if (sectionTitle) {
      parts.push(`=== SECTION TITLE: ${sectionTitle} ===\n`);
    }

    transcripts.forEach((item, idx) => {
      const title = item.videoTitle ? item.videoTitle : `Video ${idx + 1}`;
      parts.push(`--- BEGIN TRANSCRIPT [${title}] ---`);
      parts.push(item.transcriptText.trim());
      parts.push(`--- END TRANSCRIPT [${title}] ---\n`);
    });

    return parts.join('\n');
  }

  /**
   * Estimate token count of string.
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Prepare text chunks using provider-specific or custom chunking configuration.
   */
  static processTranscripts(
    transcripts: TranscriptItem[],
    sectionTitle?: string,
    providerOrConfig: string | Partial<ProviderChunkConfig> = 'minimax',
  ): ChunkResult {
    const defaultProviderConfig = PROVIDER_CHUNK_CONFIGS.minimax;
    const config: ProviderChunkConfig =
      typeof providerOrConfig === 'string'
        ? PROVIDER_CHUNK_CONFIGS[providerOrConfig.toLowerCase()] || defaultProviderConfig
        : { ...defaultProviderConfig, ...providerOrConfig };

    const fullCombinedText = this.combineTranscripts(transcripts, sectionTitle);
    const totalTokens = this.estimateTokens(fullCombinedText);

    if (totalTokens <= config.singlePassTokenLimit) {
      return {
        isChunked: false,
        fullCombinedText,
        chunks: [fullCombinedText],
      };
    }

    const chunkCharTarget = config.chunkSizeTokens * this.CHARS_PER_TOKEN;
    const overlapCharTarget = config.overlapTokens * this.CHARS_PER_TOKEN;

    const chunks: string[] = [];
    let startIdx = 0;

    while (startIdx < fullCombinedText.length) {
      let endIdx = startIdx + chunkCharTarget;

      if (endIdx >= fullCombinedText.length) {
        chunks.push(fullCombinedText.slice(startIdx));
        break;
      }

      // Find nearest structural boundary before endIdx to avoid cutting mid-sentence/paragraph
      const boundaryIndex = this.findStructuralBoundary(fullCombinedText, endIdx);
      if (boundaryIndex > startIdx) {
        endIdx = boundaryIndex;
      }

      chunks.push(fullCombinedText.slice(startIdx, endIdx));

      // Calculate next start index using overlap, seeking backwards to a boundary
      const potentialNextStart = endIdx - overlapCharTarget;
      const nextStartBoundary = this.findStructuralBoundary(fullCombinedText, potentialNextStart);
      startIdx = nextStartBoundary > startIdx ? nextStartBoundary : endIdx;
    }

    return {
      isChunked: true,
      fullCombinedText,
      chunks,
    };
  }

  /**
   * Finds nearest preceding paragraph break, transcript header, or newline.
   */
  private static findStructuralBoundary(text: string, targetIdx: number): number {
    const searchWindowStart = Math.max(0, targetIdx - 2000);
    const windowText = text.slice(searchWindowStart, targetIdx);

    // Check for double newline or transcript boundary markers
    const dblNewline = windowText.lastIndexOf('\n\n');
    if (dblNewline !== -1) {
      return searchWindowStart + dblNewline + 2;
    }

    const singleNewline = windowText.lastIndexOf('\n');
    if (singleNewline !== -1) {
      return searchWindowStart + singleNewline + 1;
    }

    return targetIdx;
  }
}
