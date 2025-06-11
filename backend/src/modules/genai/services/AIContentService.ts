import axios, {AxiosError} from 'axios';
import {Service} from 'typedi';
import {InternalServerError, HttpError} from 'routing-controllers'; // HttpError for input validation if needed
import {questionSchemas} from '../schemas';
import {extractJSONFromMarkdown} from '../utils/extractJSONFromMarkdown';
import {cleanTranscriptLines} from '../utils/cleanTranscriptLines';
// --- Type Definitions (Inferred or to be replaced by actual imports if available) ---

export interface TranscriptSegment {
  end_time: string;
  transcript_lines: string[];
}

export interface CleanedSegment {
  end_time: string;
  transcript_lines: string[]; // Text content without timestamps
}

export interface SegmentQuestionSpec {
  segmentId: string | number; // Changed from Id to segmentId
  questionSpecification: Array<Record<string, number>>; // e.g., [{"SOL": 2, "SML": 1}]
}

// Base for GeneratedQuestion, specific fields will vary by questionType
export interface GeneratedQuestion {
  segmentId?: string | number; // Changed to support both string and number
  questionType?: string;
  questionText: string; // Example common field
  options?: Array<{text: string; correct?: boolean; explanation?: string}>; // For MCQs
  solution?: any; // For various types
  isParameterized?: boolean;
  timeLimitSeconds?: number;
  points?: number;
  // ... other fields based on specific question schemas
}

// Placeholder for questionSchemas. In a real scenario, this would be more complex
export interface QuestionSchema {
  type: string; // e.g., 'SOL', 'SML', etc.
  properties: Record<string, any>; // Specific properties for each question type
}

@Service()
export class AIContentService {
  private readonly ollamaApiBaseUrl = 'http://localhost:11434/api';
  private readonly llmApiUrl = 'http://localhost:11434/api/generate'; // Added missing property

  // --- Segmentation Logic ---
  public async segmentTranscript(
    transcript: string,
    model = 'gemma3', // Default model
  ): Promise<Record<string, string>> {
    // Changed return type
    if (
      !transcript ||
      typeof transcript !== 'string' ||
      transcript.trim() === ''
    ) {
      throw new HttpError(
        400,
        'Transcript text is required and must be a non-empty string.',
      );
    }

    console.log(
      `Processing transcript for segmentation with LLM (length: ${transcript.length} chars) using model: ${model}`,
    );

    const prompt = `Analyze the following timed lecture transcript. Your task is to segment it into meaningful subtopics (not too many, maximum 5 segments).
The transcript is formatted with each line as: [start_time --> end_time] text OR start_time --> end_time text.

For each identified subtopic, you must provide:
1. "end_time": The end timestamp of the *last transcript line* that belongs to this subtopic (e.g., "02:53.000").
2. "transcript_lines": An array of strings, where each string is an *original transcript line (including its timestamps and text)* that belongs to this subtopic.

IMPORTANT: Your response must be ONLY a valid JSON array. Do not include any explanatory text, markdown formatting, or comments.

Example format:
[
  {
    "end_time": "01:30.000",
    "transcript_lines": ["00:00.000 --> 00:30.000 First topic content", "00:30.000 --> 01:30.000 More content"]
  },
  {
    "end_time": "03:00.000", 
    "transcript_lines": ["01:30.000 --> 02:15.000 Second topic content", "02:15.000 --> 03:00.000 Final content"]
  }
]

Transcript to process:
${transcript}
`;

    let segments: TranscriptSegment[] = [];
    try {
      const response = await axios.post(`${this.ollamaApiBaseUrl}/generate`, {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more consistent output
          top_p: 0.9,
        },
      });

      if (response.data && typeof response.data.response === 'string') {
        const generatedText = response.data.response;
        console.log(
          'Ollama segmentation response received, length:',
          generatedText.length,
        );

        // Log first 500 chars for debugging
        console.log('Response preview:', generatedText.substring(0, 500));

        let cleanedJsonText: string;
        try {
          cleanedJsonText = extractJSONFromMarkdown(generatedText);
        } catch (extractError) {
          console.warn(
            'Failed to extract JSON from markdown, using raw response',
          );
          cleanedJsonText = generatedText.trim();
        }

        // Single robust JSON parsing strategy
        try {
          // Clean up common JSON formatting issues in one go
          const fixedJson = cleanedJsonText
            .replace(/,\s*}]/g, '}]') // Remove trailing commas before closing
            .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
            .replace(/}\s*{/g, '},{') // Add missing commas between objects
            .replace(/]\s*\[/g, '],[') // Add missing commas between arrays
            .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
            .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
            .trim();

          // Extract JSON array if it's embedded in other text
          const arrayMatch = fixedJson.match(/\[[\s\S]*\]/);
          const jsonToParse = arrayMatch ? arrayMatch[0] : fixedJson;

          segments = JSON.parse(jsonToParse);

          // Validate the parsed segments
          if (!Array.isArray(segments)) {
            throw new Error('Response is not an array');
          }

          if (segments.length === 0) {
            throw new Error('Segments array is empty');
          }

          // Validate segment structure
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!segment.end_time || !Array.isArray(segment.transcript_lines)) {
              throw new Error(`Invalid segment structure at index ${i}`);
            }
          }

          console.log(`Successfully parsed ${segments.length} segments`);
        } catch (parseError: any) {
          console.error('JSON parsing failed. Raw response:', cleanedJsonText);
          throw new InternalServerError(
            `Failed to parse segmentation response: ${parseError.message}`,
          );
        }
      } else {
        throw new InternalServerError(
          'Ollama segmentation response missing expected data format.',
        );
      }
    } catch (error: any) {
      console.error('Error in transcript segmentation:', error.message);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('Ollama API Error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        const errorMessage =
          (axiosError.response?.data as any)?.error ||
          'Failed to process transcript with Ollama for segmentation';
        throw new InternalServerError(`Ollama API error: ${errorMessage}`);
      }

      throw new InternalServerError(
        `Error segmenting transcript: ${error.message}`,
      );
    }

    // Convert to the required format: {"end_time": "cleaned_transcript"}
    const segmentsForGeneration: Record<string, string> = {};
    segments.forEach(segment => {
      try {
        const cleanedTranscript = cleanTranscriptLines(
          segment.transcript_lines,
        );
        if (cleanedTranscript && cleanedTranscript.trim().length > 0) {
          segmentsForGeneration[segment.end_time] = cleanedTranscript;
        }
      } catch (cleanError) {
        console.warn(
          `Failed to clean transcript for segment ${segment.end_time}:`,
          cleanError,
        );
      }
    });

    console.log(
      `Segmentation completed. Found ${Object.keys(segmentsForGeneration).length} segments.`,
    );
    return segmentsForGeneration;
  }

  // --- Question Generation Logic ---
  private createQuestionPrompt(
    questionType: string,
    count: number,
    transcriptContent: string,
  ): string {
    const basePrompt = `Based on the following transcript content, generate ${count} educational question(s) of type ${questionType}.

Transcript content:
${transcriptContent}

Each question should:
- Be based on the transcript content
- Have appropriate difficulty level
- Set isParameterized to false unless the question uses variables

`;

    const typeSpecificInstructions: Record<string, string> = {
      SOL: `Create SELECT_ONE_IN_LOT questions (single correct answer multiple choice):
- Clear question text
- 3-4 incorrect options with explanations
- 1 correct option with explanation
- Set timeLimitSeconds to 60 and points to 5`,

      SML: `Create SELECT_MANY_IN_LOT questions (multiple correct answers):
- Clear question text
- 2-3 incorrect options with explanations
- 2-3 correct options with explanations
- Set timeLimitSeconds to 90 and points to 8`,

      OTL: `Create ORDER_THE_LOTS questions (ordering/sequencing):
- Clear question text asking to order items
- 3-5 items that need to be ordered correctly
- Each item should have text and explanation
- Order should be numbered starting from 1
- Set timeLimitSeconds to 120 and points to 10`,

      NAT: `Create NUMERIC_ANSWER_TYPE questions (numerical answers):
- Clear question text requiring a numerical answer
- Appropriate decimal precision (0-3)
- Realistic upper and lower limits for the answer
- Either a specific value or expression for the solution
- Set timeLimitSeconds to 90 and points to 6`,

      DES: `Create DESCRIPTIVE questions (text-based answers):
- Clear question text requiring explanation or description
- Detailed solution text that demonstrates the expected answer
- Questions that test understanding of concepts from the transcript
- Set timeLimitSeconds to 300 and points to 15`,
    };

    return (
      basePrompt +
      (typeSpecificInstructions[questionType] ||
        `Generate question of type ${questionType}.`)
    );
  }

  public async generateQuestions(args: {
    segments: Record<string | number, string>; // Dictionary with segmentId as key and transcript as value
    segmentQuestionSpec: SegmentQuestionSpec[];
    model?: string;
  }): Promise<GeneratedQuestion[]> {
    const {segments, segmentQuestionSpec, model = 'gemma3'} = args;

    if (
      !segments ||
      typeof segments !== 'object' ||
      Object.keys(segments).length === 0
    ) {
      throw new HttpError(
        400,
        'segments is required and must be a non-empty object with segmentId as keys and transcript as values.',
      );
    }
    if (
      !segmentQuestionSpec ||
      !Array.isArray(segmentQuestionSpec) ||
      segmentQuestionSpec.length === 0
    ) {
      throw new HttpError(
        400,
        'segmentQuestionSpec is required and must be a non-empty array.',
      );
    }

    const allGeneratedQuestions: GeneratedQuestion[] = [];
    console.log(`Using model: ${model} for question generation.`);

    // Process each segment
    for (const segment of segmentQuestionSpec) {
      const segmentId = segment.segmentId;
      const questionSpecs = segment.questionSpecification[0]; // Assuming first spec

      if (!questionSpecs) {
        console.warn(
          `No question specifications found for segment ${segmentId}. Skipping.`,
        );
        continue;
      }

      // Get transcript content for this specific segment
      const segmentTranscript = segments[segmentId];

      if (!segmentTranscript) {
        console.warn(`No transcript found for segment ${segmentId}. Skipping.`);
        continue;
      }

      console.log(`Processing segment ${segmentId} with specs:`, questionSpecs);

      // Generate questions for each type
      for (const [questionType, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            // Build schema for structured output
            let format: any;
            const baseSchema = (questionSchemas as any)[questionType];
            if (baseSchema) {
              if (count === 1) {
                format = baseSchema;
              } else {
                format = {
                  type: 'array',
                  items: baseSchema,
                  minItems: count,
                  maxItems: count,
                };
              }
            }

            const prompt = this.createQuestionPrompt(
              questionType,
              count,
              segmentTranscript,
            );

            const response = await axios.post(
              `${this.ollamaApiBaseUrl}/generate`,
              {
                model,
                prompt,
                stream: false,
                format: format || undefined,
                options: {temperature: 0},
              },
            );

            if (response.data && typeof response.data.response === 'string') {
              const generatedText = response.data.response;
              const cleanedJsonText = extractJSONFromMarkdown(generatedText);

              try {
                const generated = JSON.parse(cleanedJsonText) as
                  | GeneratedQuestion
                  | GeneratedQuestion[];
                const arr = Array.isArray(generated) ? generated : [generated];

                arr.forEach(q => {
                  q.segmentId = segmentId;
                  q.questionType = questionType;
                });

                allGeneratedQuestions.push(...arr);
                console.log(
                  `Generated ${arr.length} ${questionType} questions for segment ${segmentId}`,
                );
              } catch (parseError) {
                console.error(
                  `Error parsing JSON for ${questionType} questions in segment ${segmentId}:`,
                  parseError,
                );
              }
            }
          } catch (error: any) {
            console.error(
              `Error generating ${questionType} questions for segment ${segmentId}:`,
              error.message,
            );

            if (axios.isAxiosError(error)) {
              const axiosError = error as AxiosError;
              console.error('Ollama API Error:', {
                status: axiosError.response?.status,
                data: axiosError.response?.data,
              });
            }
            // Continue to next question type
          }
        }
      }
    }

    console.log(
      `Question generation completed. Generated ${allGeneratedQuestions.length} total questions.`,
    );
    return allGeneratedQuestions;
  }
}
