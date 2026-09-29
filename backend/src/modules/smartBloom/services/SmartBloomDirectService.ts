import {injectable, inject} from 'inversify';
import {BadRequestError, HttpError} from 'routing-controllers';
import {ObjectId} from 'mongodb';
import {ItemType} from '#root/shared/index.js';
import {COURSES_TYPES} from '#root/modules/courses/types.js';
import {ItemService} from '#root/modules/courses/services/ItemService.js';
import {CourseVersionService} from '#root/modules/courses/services/CourseVersionService.js';
import {CreateItemBody} from '#root/modules/courses/classes/index.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {QuestionFactory} from '#root/modules/quizzes/classes/index.js';
import {QuestionBank} from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import {QuestionService} from '#root/modules/quizzes/services/QuestionService.js';
import {
  QuestionBankService,
  QuizService,
} from '#root/modules/quizzes/services/index.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {SMART_BLOOM_TYPES} from '../types.js';
import {MinimaxClient} from './MinimaxClient.js';
import {
  ITranscript,
  ITranscriptChunk,
  evenSegmentMap,
  normalizeSegmentMap,
  renderTimestampedTranscript,
  transcriptEndTime,
} from '../utils/Transcript.js';
import {
  TranscriptFormatError,
  parseAnyTranscript,
} from '../utils/TranscriptFormats.js';
import {
  BLOOM_LEVELS,
  BloomDistribution,
  BloomLevelKey,
  allocateBloomCountsForAttempt,
  groupByBloom,
  normalizeGeneratedQuestion,
  toFactoryBody,
} from '../utils/Questions.js';

type BloomKey = Exclude<BloomLevelKey, 'unclassified'>;

export interface ITranscriptResult {
  transcript: ITranscript;
}

export interface IGenerateQuestionsInput {
  segmentNumber: number;
  startSeconds: number;
  endSeconds: number;
  segmentText: string;
  bloomTargets: Partial<Record<BloomKey, number>>;
  questionTypes: string[];
  instructions?: string;
}

export interface IUploadInput {
  versionId: string;
  moduleId: string;
  sectionId: string;
  videoUrl: string;
  segmentMap: number[];
  questions: any[];
  distribution?: BloomDistribution;
  videoItemBaseName?: string;
  quizItemBaseName?: string;
}

/**
 * Smart Bloom without the AI server.
 *
 * Four stateless steps, each its own short request so none runs into Cloud Run's
 * request timeout: transcript (pasted or uploaded by the instructor), segment
 * boundaries (MiniMax), questions for one segment (MiniMax), and upload of the
 * curated questions into the course. The page holds the intermediate results;
 * nothing here reads or writes the genAI jobs collection.
 */
@injectable()
export class SmartBloomDirectService {
  constructor(
    @inject(SMART_BLOOM_TYPES.MinimaxClient)
    private readonly minimax: MinimaxClient,
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(COURSES_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  status() {
    return {minimaxConfigured: this.minimax.isConfigured()};
  }

  /**
   * Segmentation and questions need MiniMax. Without a key, say so plainly (503:
   * a server setup problem, not a bad request) instead of failing quietly.
   */
  private assertMinimaxConfigured() {
    if (!this.minimax.isConfigured()) {
      throw new HttpError(
        503,
        'Smart Bloom direct mode is not set up on this server: MINIMAX_API_KEY is missing from the backend environment.',
      );
    }
  }

  // ── Step 1: transcript ────────────────────────────────────────────────────

  /**
   * The instructor supplies the transcript: usually pasted from YouTube's "Show
   * transcript" panel, or a file in any layout that carries timestamps (SRT, VTT,
   * SBV, Zoom/Teams/Otter exports, CSV, JSON, text from a Word file). The page
   * extracts text from binary formats before sending it.
   */
  parseTranscript(content: string): ITranscriptResult {
    let chunks: ITranscriptChunk[];
    try {
      chunks = parseAnyTranscript(content);
    } catch (error) {
      if (error instanceof TranscriptFormatError) {
        throw new BadRequestError(error.message);
      }
      throw error;
    }
    return {transcript: {chunks}};
  }

  // ── Step 2: segmentation ──────────────────────────────────────────────────

  async segment(
    chunks: ITranscriptChunk[],
    strategy: 'DEFAULT' | 'CONCEPT_END',
    minSegmentSeconds: number,
  ): Promise<{
    segmentMap: number[];
    method: 'MODEL' | 'EVEN_SPLIT';
    warning?: string;
  }> {
    if (!chunks.length) throw new BadRequestError('The transcript is empty.');
    this.assertMinimaxConfigured();
    const end = transcriptEndTime(chunks);

    // A video too short for two segments is one segment; no model call needed.
    if (end < minSegmentSeconds * 2) {
      return {
        segmentMap: normalizeSegmentMap([], end, minSegmentSeconds),
        method: 'MODEL',
      };
    }

    const system =
      'You split lecture transcripts into teaching segments. Reply with JSON only, no prose.';
    const user = [
      `Split this lecture into topic segments for a video course. Total length: ${Math.round(end)} seconds.`,
      strategy === 'CONCEPT_END'
        ? 'Place each boundary where a concept or topic has just been fully explained, not in the middle of an explanation.'
        : 'Place each boundary at a natural change of topic.',
      `Every segment must be at least ${minSegmentSeconds} seconds long. Prefer segments of about 4 to 10 minutes.`,
      'Return the END time in seconds of every segment, in order, as {"boundaries": [seconds, ...]}.',
      'The last value must be the end of the lecture.',
      '',
      'Transcript (each line starts with its start time in seconds):',
      renderTimestampedTranscript(chunks),
    ].join('\n');

    try {
      const reply: any = await this.minimax.askJson(system, user, 4000);
      const proposed = Array.isArray(reply) ? reply : reply?.boundaries;
      if (!Array.isArray(proposed))
        throw new Error('reply had no "boundaries" list');
      const segmentMap = normalizeSegmentMap(proposed, end, minSegmentSeconds);
      if (segmentMap.length) return {segmentMap, method: 'MODEL'};
      throw new Error('no usable boundaries');
    } catch (error) {
      // Fall back to even segments so the instructor is never stuck at this step.
      return {
        segmentMap: evenSegmentMap(end, Math.max(minSegmentSeconds, 360)),
        method: 'EVEN_SPLIT',
        warning: `Topic-based segmentation failed (${(error as Error).message}); the video was split into equal parts instead.`,
      };
    }
  }

  // ── Step 3: questions for one segment ─────────────────────────────────────

  async generateQuestions(
    input: IGenerateQuestionsInput,
  ): Promise<{questions: any[]; failedLevels: string[]; dropped: number}> {
    const text = String(input.segmentText ?? '').trim();
    if (!text)
      throw new BadRequestError(
        'This segment has no transcript text to generate questions from.',
      );

    const types = input.questionTypes?.length ? input.questionTypes : ['SOL'];
    const levels = BLOOM_LEVELS.filter(
      level => (input.bloomTargets?.[level] ?? 0) > 0,
    );
    if (!levels.length)
      throw new BadRequestError('No Bloom levels were requested.');
    this.assertMinimaxConfigured();

    const system =
      'You write assessment questions for an online course from a lecture transcript. ' +
      'Every question must be answerable from the transcript. Reply with JSON only, no prose.';

    // One call per Bloom level, in parallel: smaller replies are faster and less
    // likely to be cut off, and one failing level does not lose the others.
    const results = await Promise.allSettled(
      levels.map(level => {
        const count = Math.max(
          1,
          Math.min(15, Math.round(input.bloomTargets[level] ?? 0)),
        );
        const user = [
          input.instructions
            ? `Instructor's requirements:\n${input.instructions}\n`
            : '',
          `Write exactly ${count} questions at the "${level}" level of Bloom's taxonomy for segment ${input.segmentNumber}`,
          `(from ${Math.round(input.startSeconds)}s to ${Math.round(input.endSeconds)}s of the video).`,
          `Allowed question types: ${types.join(', ')}. SOL = one correct option, SML = two or more correct options,`,
          'BIN = exactly two options (Yes/No or True/False) with one correct, NAT = numeric answer, DES = short written answer.',
          '',
          'Return {"questions": [ ... ]} where each item is:',
          '{"segmentNumber": ' +
            input.segmentNumber +
            ', "bloomLevel": "' +
            level +
            '",',
          ' "question": {"text": "...", "type": "SOL|SML|BIN|NAT|DES", "hint": "short hint"},',
          ' "solution": {"correctLotItem": {"text": "...", "explaination": "why"} OR "correctLotItems": [...],',
          '   "incorrectLotItems": [{"text": "...", "explaination": "why not"}],',
          '   for NAT: "value": number, "lowerLimit": number, "upperLimit": number, "decimalPrecision": 2,',
          '   for DES: "solutionText": "model answer"}}',
          '',
          'Segment transcript:',
          text,
        ].join('\n');
        return this.minimax.askJson(system, user, 8000);
      }),
    );

    const questions: any[] = [];
    const failedLevels: string[] = [];
    let firstFailure = '';
    let dropped = 0;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedLevels.push(levels[index]);
        firstFailure ||=
          (result.reason as Error)?.message ?? String(result.reason);
        return;
      }
      const reply: any = result.value;
      const items: any[] = Array.isArray(reply)
        ? reply
        : Array.isArray(reply?.questions)
          ? reply.questions
          : [];
      for (const item of items) {
        const normalized = normalizeGeneratedQuestion(
          {...item, bloomLevel: item?.bloomLevel ?? levels[index]},
          input.segmentNumber,
        );
        if (normalized) questions.push(normalized);
        else dropped += 1;
      }
    });

    if (!questions.length && failedLevels.length === levels.length) {
      // An upstream failure, not the caller's fault: 502 with the real cause.
      throw new HttpError(
        502,
        `MiniMax could not generate questions for this segment (${firstFailure}). Please try again.`,
      );
    }
    return {questions, failedLevels, dropped};
  }

  // ── Step 4: upload ────────────────────────────────────────────────────────

  async upload(input: IUploadInput, userId: string) {
    const segmentMap = (input.segmentMap ?? [])
      .map(Number)
      .filter(Number.isFinite);
    if (!segmentMap.length)
      throw new BadRequestError('The segment map is empty.');
    if (!Array.isArray(input.questions) || !input.questions.length) {
      throw new BadRequestError('There are no accepted questions to upload.');
    }

    // The course comes from the version, never from the request, so a caller
    // cannot attach question banks to a course they do not teach.
    const version = await this.courseVersionService.getVersionDetails(
      input.versionId,
    );
    const courseId = version.courseId.toString();

    // Questions carry their segment's END time as segmentId (the page's convention).
    const bySegment = new Map<number, any[]>();
    for (const question of input.questions) {
      const segmentId = Number(question?.segmentId);
      if (!bySegment.has(segmentId)) bySegment.set(segmentId, []);
      bySegment.get(segmentId)!.push(question);
    }

    const summary = {
      videoItems: 0,
      quizItems: 0,
      questionBanks: 0,
      questionsCreated: 0,
      questionsSkipped: 0,
    };
    let segmentStart = 0;

    for (const segmentEnd of segmentMap) {
      await this.itemService.createItem(
        input.versionId,
        input.moduleId,
        input.sectionId,
        {
          name: input.videoItemBaseName || 'Video',
          description: 'Video content',
          type: ItemType.VIDEO,
          videoDetails: {
            URL: input.videoUrl,
            startTime: secondsToTimeString(segmentStart),
            endTime: secondsToTimeString(segmentEnd),
            points: 10,
          },
        } as CreateItemBody,
      );
      summary.videoItems += 1;

      const segmentQuestions = bySegment.get(segmentEnd) ?? [];
      if (segmentQuestions.length) {
        const buckets = groupByBloom(segmentQuestions, input.distribution);
        const banks: Array<{
          id: string;
          bloomLevel: BloomKey;
          questionCount: number;
        }> = [];

        // One bank per Bloom level, including empty ones, matching the AI-server upload.
        for (const bloomLevel of BLOOM_LEVELS) {
          const bankId = await this.questionBankService.create(
            new QuestionBank({
              title: `Question Bank - Segment (${segmentStart} - ${segmentEnd}) - ${bloomLevel.toUpperCase()}`,
              description: `Question bank for video segment from ${segmentStart} to ${segmentEnd} (Bloom: ${bloomLevel}).`,
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(input.versionId),
              questions: [],
              tags: [
                `segment_${segmentEnd}`,
                `bloom_${bloomLevel}`,
                'ai_generated',
              ],
              points: 5,
            }),
          );
          summary.questionBanks += 1;

          let created = 0;
          for (const curated of buckets[bloomLevel]) {
            const body = toFactoryBody(curated, bloomLevel);
            if (!body) {
              summary.questionsSkipped += 1;
              continue;
            }
            try {
              const question = QuestionFactory.createQuestion(
                body as any,
                userId,
              );
              const questionId = await this.questionService.create(question);
              await this.questionBankService.addQuestion(bankId, questionId);
              created += 1;
            } catch (error) {
              summary.questionsSkipped += 1;
              console.warn(
                `[SmartBloomDirect] skipped a question in segment ending ${segmentEnd}:`,
                error,
              );
            }
          }
          summary.questionsCreated += created;
          banks.push({id: bankId, bloomLevel, questionCount: created});
        }

        const totalForSegment = banks.reduce(
          (sum, bank) => sum + bank.questionCount,
          0,
        );
        const quiz = await this.itemService.createItem(
          input.versionId,
          input.moduleId,
          input.sectionId,
          {
            name: input.quizItemBaseName || 'Quiz',
            description: `Quiz for video segment from ${segmentStart} to ${segmentEnd}. This quiz's points are based on its questions.`,
            type: ItemType.QUIZ,
            quizDetails: {
              passThreshold: 0.7,
              maxAttempts: 1000,
              quizType: 'NO_DEADLINE',
              approximateTimeToComplete: '00:05:00',
              allowPartialGrading: true,
              allowSkip: false,
              allowHint: true,
              showCorrectAnswersAfterSubmission: true,
              showExplanationAfterSubmission: true,
              showScoreAfterSubmission: true,
              questionVisibility: totalForSegment,
              releaseTime: new Date(),
              deadline: undefined,
            },
          } as CreateItemBody,
        );
        summary.quizItems += 1;

        const quizId = quiz.createdItem?._id?.toString();
        if (quizId) {
          const counts = allocateBloomCountsForAttempt(
            banks.map(bank => ({
              bloomLevel: bank.bloomLevel,
              availableCount: bank.questionCount,
            })),
            input.distribution,
          );
          for (const bank of banks) {
            await this.quizService.addQuestionBank(quizId, {
              bankId: bank.id,
              count: counts[bank.bloomLevel],
              tags: [`bloom_${bank.bloomLevel}`, 'ai_generated'],
            });
          }
        }
      }
      segmentStart = segmentEnd;
    }

    // Same follow-up the course's own "add item" route performs.
    await this.enrollmentService.flagNewItemsForCompletedStudents(
      input.versionId,
    );
    return summary;
  }
}

function secondsToTimeString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toFixed(3).padStart(6, '0'),
  ].join(':');
}
