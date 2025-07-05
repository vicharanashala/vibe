import {
  JsonController,
  Post,
  HttpCode,
  Req,
  Res,
  Body,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {Request, Response} from 'express';

import {VideoService} from './services/VideoService.js';
import {AudioService} from './services/AudioService.js';
import {TranscriptionService} from './services/TranscriptionService.js';
import {AIContentService} from './services/AIContentService.js';
import {CleanupService} from './services/CleanupService.js';
import {ItemService} from '../courses/services/ItemService.js';
import {COURSES_TYPES} from '../courses/types.js';
import {QUIZZES_TYPES} from '../quizzes/types.js';
import {QuestionBankService} from '../quizzes/services/QuestionBankService.js';
import {QuestionService} from '../quizzes/services/QuestionService.js';
import {QuizService} from '../quizzes/services/QuizService.js';
import {QuestionBank} from '../quizzes/classes/transformers/QuestionBank.js';
import {BaseQuestion} from '../quizzes/classes/transformers/Question.js';
import {CreateItemBody} from '../courses/classes/validators/ItemValidators.js';
import {ItemType} from '#shared/interfaces/models.js';

@injectable()
@JsonController('/genai')
export default class GenAIVideoController {
  constructor(
    private videoService: VideoService,
    private audioService: AudioService,
    private transcriptionService: TranscriptionService,
    private aiContentService: AIContentService,
    private cleanupService: CleanupService,
    @inject(COURSES_TYPES.ItemService) private itemService: ItemService,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private questionBankService: QuestionBankService,
    @inject(QUIZZES_TYPES.QuestionService)
    private questionService: QuestionService,
    @inject(QUIZZES_TYPES.QuizService) private quizService: QuizService,
  ) {}

  @Post('/generate/transcript')
  @HttpCode(200)
  async generateTranscript(
    @Body() body: {youtubeUrl: string},
    @Res() res: Response,
  ) {
    const tempPaths: string[] = [];

    try {
      const {youtubeUrl} = body;

      if (!youtubeUrl) {
        return res.status(400).json({
          message: 'YouTube URL is required.',
        });
      }

      let transcript = '';

      if (youtubeUrl) {
        // 1. Download video
        const videoPath = await this.videoService.downloadVideo(youtubeUrl);
        tempPaths.push(videoPath);

        // 2. Extract audio
        const audioPath = await this.audioService.extractAudio(videoPath);
        tempPaths.push(audioPath);

        // 3. Transcribe audio
        transcript = await this.transcriptionService.transcribe(audioPath);
      }

      // 4. Return transcript
      return res.json({
        message: 'Transcript generation completed successfully.',
        youtubeUrl: youtubeUrl || null,
        generatedTranscript: transcript,
      });
    } catch (err: any) {
      console.error('Error in GenAIVideoController.generateTranscript:', err);
      return res
        .status(err.status || 500)
        .json({message: err.message || 'Internal Server Error'});
    } finally {
      // 5. Cleanup temporary files
      await this.cleanupService.cleanup(tempPaths);
    }
  }

  @Post('/generate/transcript/segment')
  @HttpCode(200)
  async segmentTranscript(
    @Body() body: {transcript: string; model?: string},
    @Res() res: Response,
  ) {
    try {
      const {transcript, model} = body;

      if (
        !transcript ||
        typeof transcript !== 'string' ||
        transcript.trim() === ''
      ) {
        return res.status(400).json({
          error: 'Transcript text is required and must be a non-empty string.',
        });
      }

      const segments = await this.aiContentService.segmentTranscript(
        transcript,
        model,
      );

      return res.json({
        message: 'Transcript segmentation completed successfully.',
        segments,
        segmentCount: segments.length,
      });
    } catch (err: any) {
      console.error('Error in GenAIVideoController.segmentTranscript:', err);
      return res
        .status(err.status || 500)
        .json({error: err.message || 'Error segmenting transcript'});
    }
  }

  @Post('/generate/questions')
  @HttpCode(200)
  async generateQuestions(
    @Body()
    body: {
      segments: Record<string | number, string>; 
      globalQuestionSpecification: any[]; 
      model?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const {segments, globalQuestionSpecification, model} = body; 

      const questions = await this.aiContentService.generateQuestions({
        segments, 
        globalQuestionSpecification, 
        model,
      });

      return res.json({
        message: 'Questions generation completed successfully.',
        totalQuestions: questions.length,
        questions,
      });
    } catch (err: any) {
      console.error('Error in GenAIVideoController.generateQuestions:', err);
      return res
        .status(err.status || 500)
        .json({error: err.message || 'Error generating questions'});
    }
  }

  @Post('/generate-course-items-from-video')
  @HttpCode(200)
  async generateCourseItemsFromVideo(
    @Body()
    body: {
      versionId: string;
      moduleId: string;
      sectionId: string;
      courseId: string; // Added courseId parameter
      videoURL: string;
      globalQuestionSpecification?: {
        SOL?: number;
        SML?: number;
        OTL?: number;
        NAT?: number;
        DES?: number;
      };
      videoItemBaseName?: string;
      quizItemBaseName?: string;
      questionBankOptions?: {
        count: number;
        difficulty?: string[];
        tags?: string[];
      };
    },
    @Res() res: Response,
  ) {
    const {
      versionId,
      moduleId,
      sectionId,
      courseId, // Extract courseId
      videoURL,
      globalQuestionSpecification,
      videoItemBaseName,
      quizItemBaseName,
      questionBankOptions,
    } = body;

    if (!versionId || !moduleId || !sectionId || !videoURL || !courseId) {
      return res.status(400).json({
        message: 'versionId, moduleId, sectionId, courseId, and videoURL are required.',
      });
    }

    const tempPaths: string[] = [];
    try {
      // 1. Video Processing & Transcription
      const videoPath = await this.videoService.downloadVideo(videoURL);
      tempPaths.push(videoPath);
      const audioPath = await this.audioService.extractAudio(videoPath);
      tempPaths.push(audioPath);
      const transcript = await this.transcriptionService.transcribe(audioPath);

      // 2. Segment Transcript
      const rawSegments =
        await this.aiContentService.segmentTranscript(transcript);
      const segmentsMap: Record<string, string> = Array.isArray(rawSegments)
        ? rawSegments.reduce((obj, seg, i) => {
            const key =
              typeof seg === 'object' && seg.endTime
                ? seg.endTime
                : `segment_id_${i + 1}`;
            const text = typeof seg === 'object' && seg.text ? seg.text : seg;
            return {...obj, [key]: text as string};
          }, {})
        : (rawSegments as Record<string, string>) || {};

      // 3. Generate Questions for all relevant segments
      const transformedGlobalQuestionSpec = [globalQuestionSpecification || {}];

      const allQuestionsData = await this.aiContentService.generateQuestions({
        segments: segmentsMap,
        globalQuestionSpecification: transformedGlobalQuestionSpec,
      });

      // 4. Group questions by segmentId
      const questionsGroupedBySegment: Record<string, any[]> = {};
      if (Array.isArray(allQuestionsData)) {
        for (const question of allQuestionsData) {
          const segId = (question as any).segmentId;
          if (segId && segmentsMap[segId]) {
            if (!questionsGroupedBySegment[segId]) {
              questionsGroupedBySegment[segId] = [];
            }
            questionsGroupedBySegment[segId].push(question);
          } else {
            console.warn(
              `Question found without a valid segmentId ("${segId}") or segmentId not in segmentsMap.`,
              question,
            );
          }
        }
      }

      // Prepare tracking arrays
      const createdVideoItemsInfo: Array<{
        id?: string;
        name: string;
        segmentId: string;
        startTime: string;
        endTime: string;
        points: number;
      }> = [];
      const createdQuizItemsInfo: Array<{
        id?: string;
        name: string;
        segmentId: string;
        questionCount: number;
      }> = [];
      const createdQuestionBanksInfo: Array<{
        id: string;
        name: string;
        segmentId: string;
        questionCount: number;
        questionIds: string[];
      }> = [];

      const sortedSegmentIds = Object.keys(segmentsMap).sort((a, b) =>
        a.localeCompare(b),
      );
      let previousSegmentEndTime = '0:00:00';

      for (const currentSegmentId of sortedSegmentIds) {
        const segmentText = segmentsMap[currentSegmentId];
        const segmentStartTime = previousSegmentEndTime;
        const currentSegmentEndTime = currentSegmentId;
        const segmentTextPreview = segmentText
          ? segmentText.substring(0, 70) +
            (segmentText.length > 70 ? '...' : '')
          : 'No content';

        // Create Video Item for the segment
        const videoSegName = videoItemBaseName
          ? `${videoItemBaseName} - Segment (${segmentStartTime} - ${currentSegmentEndTime})`
          : `Video Segment (${segmentStartTime} - ${currentSegmentEndTime})`;

        const videoItemBody: CreateItemBody = {
          name: videoSegName,
          description: `Video content for segment: ${segmentStartTime} - ${currentSegmentEndTime}. ${segmentTextPreview}`,
          type: ItemType.VIDEO,
          videoDetails: {
            URL: videoURL,
            startTime: segmentStartTime,
            endTime: currentSegmentEndTime,
            points: 10,
          },
        };
        const createdVideoItem = await this.itemService.createItem(
          versionId,
          moduleId,
          sectionId,
          videoItemBody,
        );
        createdVideoItemsInfo.push({
          id: createdVideoItem.createdItem?._id?.toString(),
          name: videoSegName,
          segmentId: currentSegmentId,
          startTime: segmentStartTime,
          endTime: currentSegmentEndTime,
          points: 10,
        });

        // Create Question Bank and Questions for the segment
        const questionsForSegment = questionsGroupedBySegment[currentSegmentId] || [];
        if (questionsForSegment.length > 0) {
          // Create Question Bank for this segment
          const questionBankName = `Question Bank - Segment (${segmentStartTime} - ${currentSegmentEndTime})`;
          const questionBank = new QuestionBank({
            title: questionBankName,
            description: `Question bank for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. Content: "${segmentTextPreview}"`,
            courseId: courseId,
            courseVersionId: versionId,
            questions: [], // Will be populated after creating questions
            tags: [`segment_${currentSegmentId}`, 'ai_generated'],
          });

          const questionBankId = await this.questionBankService.create(questionBank);

          // Create individual questions and add them to the question bank
          const createdQuestionIds: string[] = [];
          for (const questionData of questionsForSegment) {
            try {
              // Prepare the question data object for creation
              const questionPayload = {
                text: questionData.question.text,
                type: questionData.question.type, 
                isParameterized: questionData.question.isParameterized,
                parameters: questionData.question.parameters || [],
                hint: questionData.question.hint,
                timeLimitSeconds: questionData.question.timeLimitSeconds,
                points: questionData.question.points,
                solution: questionData.solution, 
                tags: [`segment_${currentSegmentId}`, 'ai_generated', questionData.question.type.toLowerCase()],
              };

              const questionId = await this.questionService.create(questionPayload);
              createdQuestionIds.push(questionId);

              // Add question to the question bank
              await this.questionBankService.addQuestion(questionBankId, questionId);
            } catch (questionError) {
              console.warn(`Failed to create question for segment ${currentSegmentId}:`, questionError);
            }
          }

          createdQuestionBanksInfo.push({
            id: questionBankId,
            name: questionBankName,
            segmentId: currentSegmentId,
            questionCount: createdQuestionIds.length,
            questionIds: createdQuestionIds,
          });

          // Create Quiz Item for the segment
          const quizSegName = quizItemBaseName
            ? `${quizItemBaseName} - Segment Quiz (${segmentStartTime} - ${currentSegmentEndTime})`
            : `Quiz for Segment (${segmentStartTime} - ${currentSegmentEndTime})`;

          const quizItemBody: CreateItemBody = {
            name: quizSegName,
            description: `Quiz for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. Content: "${segmentTextPreview}". This quiz's points are based on its questions.`,
            type: ItemType.QUIZ,
            quizDetails: {
              passThreshold: 0.7,
              maxAttempts: 3,
              quizType: 'NO_DEADLINE',
              approximateTimeToComplete: '00:05:00',
              allowPartialGrading: true,
              allowHint: true,
              showCorrectAnswersAfterSubmission: true,
              showExplanationAfterSubmission: true,
              showScoreAfterSubmission: true,
              questionVisibility: createdQuestionIds.length,
              releaseTime: new Date(),
              deadline: undefined,
            },
          };
          const createdQuizItem = await this.itemService.createItem(
            versionId,
            moduleId,
            sectionId,
            quizItemBody,
          );

          // Link the QuestionBank to the Quiz
          const quizId = createdQuizItem.createdItem?._id?.toString();
          if (quizId && questionBankId) {
            try {
              await this.quizService.addQuestionBank(quizId, {
                bankId: questionBankId,
                count: questionBankOptions?.count ?? createdQuestionIds.length,
                difficulty: questionBankOptions?.difficulty,
                tags: questionBankOptions?.tags,
              });
            } catch (linkError) {
              console.warn(
                `Failed to link question bank ${questionBankId} to quiz ${quizId}:`,
                linkError,
              );
            }
          }

          createdQuizItemsInfo.push({
            id: createdQuizItem.createdItem?._id?.toString(),
            name: quizSegName,
            segmentId: currentSegmentId,
            questionCount: createdQuestionIds.length,
          });
        }
        
        previousSegmentEndTime = currentSegmentEndTime;
      }

      return res.json({
        message:
          'Video items, Quiz items, and Question banks for segments generated successfully from video.',
        videoURL,
        transcriptPreview: transcript.substring(0, 200) + '...',
        generatedItemsSummary: {
          totalSegmentsProcessed: sortedSegmentIds.length,
          totalVideoItemsCreated: createdVideoItemsInfo.length,
          totalQuizItemsCreated: createdQuizItemsInfo.length,
          totalQuestionBanksCreated: createdQuestionBanksInfo.length,
          totalQuestionsGenerated: createdQuestionBanksInfo.reduce((sum, bank) => sum + bank.questionCount, 0),
        },
        createdVideoItems: createdVideoItemsInfo,
        createdQuizItems: createdQuizItemsInfo,
        createdQuestionBanks: createdQuestionBanksInfo,
      });
    } catch (err: any) {
      console.error(
        'Error in GenAIVideoController.generateCourseItemsFromVideo:',
        err,
      );
      return res
        .status(err.status || 500)
        .json({message: err.message || 'Internal Server Error'});
    } finally {
      // 6. Cleanup temporary files
      await this.cleanupService.cleanup(tempPaths);
    }
  }
}
