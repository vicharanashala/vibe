import { JsonController, Post, Body, Get, Param, QueryParam, HttpCode, BadRequestError, Authorized, NotFoundError, ForbiddenError } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { subject } from '@casl/ability';
import { YoutubeTranscript } from 'youtube-transcript';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getCourseVersionAbility, CourseVersionActions } from '#root/modules/courses/abilities/versionAbilities.js';
import { STUDY_NOTES_TYPES } from '../types/studyNotesTypes.js';
import { StudyNotesService } from '../services/StudyNotesService.js';
import { GenerateSectionNotesDto } from '../classes/validators/StudyNotesValidators.js';

function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

interface TranscriptCacheEntry {
  status: 'ready' | 'no_transcript' | 'invalid_url' | 'error';
  videoId: string;
  transcriptText?: string;
  message?: string;
  timestamp: number;
}

// In-memory cache for fetched YouTube transcripts (24-hour TTL)
const transcriptCache = new Map<string, TranscriptCacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@JsonController('/notes/section')
@injectable()
export class StudyNotesController {
  constructor(
    @inject(STUDY_NOTES_TYPES.StudyNotesService)
    private readonly studyNotesService: StudyNotesService,
  ) {}

  /**
   * Fetch and check YouTube transcript for a given YouTube URL or video ID.
   * Employs server-side caching (24h) to avoid rate limits and duplicate hits.
   */
  @Get('/youtube-transcript')
  async getYouTubeTranscript(@QueryParam('url') url: string) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return {
        status: 'invalid_url',
        message: 'Invalid YouTube URL or Video ID',
      };
    }

    // Check 24-hour server-side cache
    const cached = transcriptCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[StudyNotesController] Serving transcript for video ID "${videoId}" from server cache (status: ${cached.status}).`);
      return {
        status: cached.status,
        videoId: cached.videoId,
        transcriptText: cached.transcriptText,
        message: cached.message,
      };
    }

    try {
      console.log(`[StudyNotesController] Fetching YouTube transcript for video ID: ${videoId}...`);
      const transcriptEntries = await YoutubeTranscript.fetchTranscript(videoId);
      if (transcriptEntries && transcriptEntries.length > 0) {
        const fullText = transcriptEntries.map((t) => t.text).join(' ').trim();
        console.log(`[StudyNotesController] Successfully fetched ${transcriptEntries.length} transcript segments (${fullText.length} chars) for video ID: ${videoId}`);
        
        const result: TranscriptCacheEntry = {
          status: 'ready',
          videoId,
          transcriptText: fullText,
          timestamp: Date.now(),
        };
        transcriptCache.set(videoId, result);
        return result;
      } else {
        const result: TranscriptCacheEntry = {
          status: 'no_transcript',
          videoId,
          message: 'This video does not have a transcript available, so notes cannot be generated.',
          timestamp: Date.now(),
        };
        transcriptCache.set(videoId, result);
        return result;
      }
    } catch (err: any) {
      console.warn(`[StudyNotesController] Error fetching transcript for video ID "${videoId}":`, err?.message || err);
      const errMsg = String(err?.message || err).toLowerCase();
      const status = err?.status || err?.response?.status;

      // 1. Explicit 429 Rate Limit / Network / Temporary Failure handling
      if (
        status === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('too many requests') ||
        errMsg.includes('captcha') ||
        errMsg.includes('sorry') ||
        errMsg.includes('timeout') ||
        errMsg.includes('econnrefused') ||
        errMsg.includes('etimedout') ||
        errMsg.includes('500') ||
        errMsg.includes('503')
      ) {
        console.warn(`[StudyNotesController] YouTube rate limit / temporary network error detected for video ID "${videoId}". Returning recoverable error state.`);
        return {
          status: 'error',
          videoId,
          message: 'YouTube rate limit or temporary network error occurred. Please click retry.',
          error: err?.message || String(err),
        };
      }

      // 2. Explicit No Transcript / Disabled Captions handling
      if (
        errMsg.includes('disabled') ||
        errMsg.includes('could not find transcript') ||
        errMsg.includes('no transcript') ||
        errMsg.includes('transcript is not available') ||
        errMsg.includes('captions')
      ) {
        const result: TranscriptCacheEntry = {
          status: 'no_transcript',
          videoId,
          message: 'This video does not have a transcript available, so notes cannot be generated.',
          timestamp: Date.now(),
        };
        transcriptCache.set(videoId, result);
        return result;
      }

      // Default recoverable error fallback
      return {
        status: 'error',
        videoId,
        message: 'Failed to fetch transcript from YouTube due to a network or service error. Please retry.',
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Trigger study notes generation for a section (fire-and-forget).
   * Restricted to course instructors/managers with Modify permissions on the course version.
   */
  @Authorized()
  @Post('/generate')
  @HttpCode(202)
  async generateSectionNotes(
    @Body() payload: GenerateSectionNotesDto,
    @Ability(getCourseVersionAbility) { ability }: { ability: any },
  ) {
    const { courseVersionId, sectionId, sectionTitle, transcripts } = payload;

    if (!courseVersionId || !sectionId || !transcripts || transcripts.length === 0) {
      throw new BadRequestError('Missing required fields (courseVersionId, sectionId, transcripts)');
    }

    const versionResource = subject('CourseVersion', { versionId: courseVersionId });
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError('You do not have permission to modify notes for this course version');
    }

    // Fire-and-forget execution
    this.studyNotesService.generateSectionNotes(
      courseVersionId,
      sectionId,
      sectionTitle || '',
      transcripts,
    );

    return {
      status: 'pending',
      message: 'Section study notes generation started',
      courseVersionId,
      sectionId,
    };
  }

  /**
   * Fetch generated study notes for a course section.
   * Requires basic authentication and View permission on the course version.
   */
  @Authorized()
  @Get('/versions/:versionId/sections/:sectionId')
  async getSectionNotes(
    @Param('versionId') versionId: string,
    @Param('sectionId') sectionId: string,
    @Ability(getCourseVersionAbility) { ability }: { ability: any },
  ) {
    const versionResource = subject('CourseVersion', { versionId });
    if (!ability.can(CourseVersionActions.View, versionResource)) {
      throw new ForbiddenError('You do not have permission to view notes for this course version');
    }

    const note = await this.studyNotesService.getSectionNotes(versionId, sectionId);
    if (!note) {
      throw new NotFoundError('Study notes not found for the specified course section');
    }
    return note;
  }

  /**
   * Force regenerate notes for a section.
   * Restricted to course instructors/managers with Modify permissions on the course version.
   */
  @Authorized()
  @Post('/versions/:versionId/sections/:sectionId/regenerate')
  @HttpCode(202)
  async regenerateSectionNotes(
    @Param('versionId') versionId: string,
    @Param('sectionId') sectionId: string,
    @Body() payload: GenerateSectionNotesDto,
    @Ability(getCourseVersionAbility) { ability }: { ability: any },
  ) {
    const versionResource = subject('CourseVersion', { versionId });
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError('You do not have permission to modify notes for this course version');
    }

    this.studyNotesService.generateSectionNotes(
      versionId,
      sectionId,
      payload.sectionTitle || '',
      payload.transcripts,
    );

    return {
      status: 'pending',
      message: 'Section study notes regeneration started',
      courseVersionId: versionId,
      sectionId,
    };
  }
}
