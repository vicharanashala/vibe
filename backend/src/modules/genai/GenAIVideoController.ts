import {
  JsonController,
  Post,
  HttpCode,
  Req,
  Res,
  OnUndefined,
  Body,
} from 'routing-controllers';
import {Service} from 'typedi';
import {Request, Response} from 'express';

import {VideoService} from './services/VideoService';
import {AudioService} from './services/AudioService';
import {TranscriptionService} from './services/TranscriptionService';
import {AIContentService} from './services/AIContentService';
import {CleanupService} from './services/CleanupService';

@Service()
@JsonController('/genai')
export default class GenAIVideoController {
  constructor(
    private videoService: VideoService,
    private audioService: AudioService,
    private transcriptionService: TranscriptionService,
    private aiContentService: AIContentService,
    private cleanupService: CleanupService,
  ) {}

  @Post('/generate/transcript')
  @HttpCode(200)
  @OnUndefined(500)
  async generateTranscript(@Req() req: Request, @Res() res: Response) {
    const tempPaths: string[] = [];

    try {
      const {youtubeUrl} = req.body;

      if (!youtubeUrl && !req.file) {
        return res.status(400).json({
          message: 'YouTube URL or PDF file is required.',
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

      // Handle PDF processing if file is uploaded
      if (req.file) {
        // Add PDF processing logic here if needed
        transcript += ' [PDF content processed]';
      }

      // 4. Return transcript
      return res.json({
        message: 'Transcript generation completed successfully.',
        youtubeUrl: youtubeUrl || null,
        pdfFile: req.file ? req.file.path : null,
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
      segments: Record<string | number, string>; // Changed from transcriptLines to segments
      segmentQuestionSpec: any[];
      model?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const {segments, segmentQuestionSpec, model} = body;

      const questions = await this.aiContentService.generateQuestions({
        segments, // Changed from transcriptLines to segments
        segmentQuestionSpec,
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
  //complete testing
  // @Post('/process')
  // @HttpCode(200)
  // @OnUndefined(500)
  // async processVideo(@Req() req: Request, @Res() res: Response) {
  //   const tempPaths: string[] = [];

  //   try {
  //     // 1. Download video
  //     const videoPath = await this.videoService.downloadVideo(
  //       req.body.videoUrl,
  //     );
  //     tempPaths.push(videoPath);

  //     // 2. Extract audio
  //     const audioPath = await this.audioService.extractAudio(videoPath);
  //     tempPaths.push(audioPath);

  //     // 3. Transcribe audio
  //     const transcript = await this.transcriptionService.transcribe(audioPath);

  //     // 4. Segment transcript
  //     const segments =
  //       await this.aiContentService.segmentTranscript(transcript);

  //     // Note: For question generation, use the separate /generate/questions endpoint
  //     // which accepts the proper parameter structure

  //     // 5. Return structured response
  //     return res.json({
  //       message: 'Video processing completed successfully.',
  //       transcript,
  //       segments,
  //       segmentCount: segments.length,
  //     });
  //   } catch (err: any) {
  //     console.error('Error in GenAIVideoController.processVideo:', err);
  //     return res
  //       .status(err.status || 500)
  //       .json({message: err.message || 'Internal Server Error'});
  //   } finally {
  //     // 6. Cleanup temporary files
  //     await this.cleanupService.cleanup(tempPaths);
  //   }
  // }
}
