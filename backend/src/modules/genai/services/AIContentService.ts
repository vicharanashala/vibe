import axios, {AxiosError} from 'axios';
import {injectable} from 'inversify';
import {HttpError, InternalServerError} from 'routing-controllers'; // HttpError for input validation if needed
import {questionSchemas} from '../schemas/index.js';
import {extractJSONFromMarkdown} from '../utils/extractJSONFromMarkdown.js';
import {cleanTranscriptLines} from '../utils/cleanTranscriptLines.js';
// --- Type Definitions (Inferred or to be replaced by actual imports if available) ---

export interface TranscriptSegment {
  end_time: string;
  transcript_lines: string[];
}

export interface CleanedSegment {
  end_time: string;
  transcript_lines: string[]; // Text content without timestamps
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

@injectable()
export class AIContentService {
  private readonly ollimaApiBaseUrl = 'http://localhost:11434/api';
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
    "segments": ["00:00.000 --> 00:30.000 First topic content", "00:30.000 --> 01:30.000 More content"]
  },
  {
    "end_time": "03:00.000", 
    "segments": ["01:30.000 --> 02:15.000 Second topic content", "02:15.000 --> 03:00.000 Final content"]
  }
]

Transcript to process:
${transcript}

JSON:`;

    let segments: TranscriptSegment[] = [];
    try {
      const response = await axios.post(`${this.ollimaApiBaseUrl}/generate`, {
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
          'Ollima segmentation response received, length:',
          generatedText.length,
        );

        // Log first 500 chars for debugging
        console.log('Response preview:', generatedText.substring(0, 500));

        // Enhanced JSON extraction with multiple fallback strategies
        let cleanedJsonText: string;
        try {
          cleanedJsonText = extractJSONFromMarkdown(generatedText);
        } catch (extractError) {
          console.warn(
            'Failed to extract JSON from markdown, using raw response',
          );
          cleanedJsonText = generatedText.trim();
        }

        // Multiple robust JSON parsing strategies
        try {
          let jsonToParse: string = '';
          
          // Strategy 1: Look for JSON array in the response
          const arrayMatch = cleanedJsonText.match(/\[[\s\S]*?\]/);
          if (arrayMatch) {
            jsonToParse = arrayMatch[0];
          } else {
            // Strategy 2: Try to find JSON object and wrap in array
            const objectMatch = cleanedJsonText.match(/\{[\s\S]*?\}/);
            if (objectMatch) {
              jsonToParse = `[${objectMatch[0]}]`;
            } else {
              // Strategy 3: Remove all non-JSON content before and after
              const lines = cleanedJsonText.split('\n');
              let startIdx = -1;
              let endIdx = -1;
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('[') || line.startsWith('{')) {
                  startIdx = i;
                  break;
                }
              }
              
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line.endsWith(']') || line.endsWith('}')) {
                  endIdx = i;
                  break;
                }
              }
              
              if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
                jsonToParse = lines.slice(startIdx, endIdx + 1).join('\n');
              } else {
                jsonToParse = cleanedJsonText;
              }
            }
          }

          // Clean up common JSON formatting issues
          const fixedJson = jsonToParse
            .replace(/,\s*}]/g, '}]') // Remove trailing commas before closing
            .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
            .replace(/}\s*{/g, '},{') // Add missing commas between objects
            .replace(/]\s*\[/g, '],[') // Add missing commas between arrays
            .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
            .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
            .trim();

          console.log('Attempting to parse JSON:', fixedJson.substring(0, 200) + '...');
          segments = JSON.parse(fixedJson);

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
          console.error('All JSON parsing strategies failed.');
          console.error('Raw response:', generatedText);
          console.error('Parse error:', parseError.message);
          
          // Final fallback: create a simple segmentation based on transcript length
          console.log('Creating fallback segmentation...');
          const transcriptLines = transcript.split('\n').filter(line => line.trim());
          const linesPerSegment = Math.ceil(transcriptLines.length / 3); // Create 3 segments
          const fallbackSegments: TranscriptSegment[] = [];
          
          for (let i = 0; i < transcriptLines.length; i += linesPerSegment) {
            const segmentLines = transcriptLines.slice(i, i + linesPerSegment);
            const lastLine = segmentLines[segmentLines.length - 1];
            
            // Extract end time from last line (format: "HH:MM:SS.mmm --> HH:MM:SS.mmm text")
            const timeMatch = lastLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3})/g);
            const endTime = timeMatch && timeMatch.length > 1 ? timeMatch[1] : `${String(Math.floor(i / linesPerSegment) + 1).padStart(2, '0')}:00.000`;
            
            fallbackSegments.push({
              end_time: endTime,
              transcript_lines: segmentLines
            });
          }
          
          segments = fallbackSegments;
          console.log(`Created ${segments.length} fallback segments`);
        }
      } else {
        throw new InternalServerError(
          'Ollima segmentation response missing expected data format.',
        );
      }
    } catch (error: any) {
      console.error('Error in transcript segmentation:', error.message);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('Ollima API Error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        const errorMessage =
          (axiosError.response?.data as any)?.error ||
          'Failed to process transcript with Ollima for segmentation';
        throw new InternalServerError(`Ollima API error: ${errorMessage}`);
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
    globalQuestionSpecification: Array<Record<string, number>>; // Global question specification
    model?: string;
  }): Promise<GeneratedQuestion[]> {
    const {segments, globalQuestionSpecification, model = 'gemma3'} = args;

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
      !globalQuestionSpecification ||
      !Array.isArray(globalQuestionSpecification) ||
      globalQuestionSpecification.length === 0 ||
      !globalQuestionSpecification[0] || // Ensure the first element exists
      typeof globalQuestionSpecification[0] !== 'object' ||
      Object.keys(globalQuestionSpecification[0]).length === 0
    ) {
      throw new HttpError(
        400,
        'globalQuestionSpecification is required and must be a non-empty array with a non-empty object defining question types and counts.',
      );
    }

    const allGeneratedQuestions: GeneratedQuestion[] = [];
    console.log(`Using model: ${model} for question generation.`);

    const questionSpecs = globalQuestionSpecification[0]; // Assuming the first spec in the array is the global one

    // Process each segment
    for (const segmentId in segments) {
      if (Object.prototype.hasOwnProperty.call(segments, segmentId)) {
        const segmentTranscript = segments[segmentId];

        if (!segmentTranscript) {
          console.warn(`No transcript found for segment ${segmentId}. Skipping.`);
          continue;
        }

        console.log(`Processing segment ${segmentId} with global specs:`, questionSpecs);

        // Generate questions for each type based on globalQuestionSpecification
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
                `${this.ollimaApiBaseUrl}/generate`,
                {
                  model,
                  prompt,
                  stream: false,
                  format: format || undefined, // Ensure format is passed correctly
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
                  // Optionally, handle or log the raw response if JSON parsing fails
                  // console.error('Raw response for parsing error:', generatedText);
                }
              } else {
                 console.warn(
                    `No response data or response.response is not a string for ${questionType} in segment ${segmentId}. Response:`, 
                    response.data
                );
              }
            } catch (error: any) {
              console.error(
                `Error generating ${questionType} questions for segment ${segmentId}:`,
                error.message,
              );

              if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                console.error('Ollima API Error:', {
                  status: axiosError.response?.status,
                  data: axiosError.response?.data,
                });
              }
              // Continue to next question type, do not let one error stop all generation
            }
          }
        }
      }
    }

    console.log(
      `Question generation completed. Generated ${allGeneratedQuestions.length} total questions.`,
    );
    return allGeneratedQuestions; // Ensure the function returns the accumulated questions
  }
}
