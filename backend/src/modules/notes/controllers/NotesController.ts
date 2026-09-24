import { JsonController, Post, Body, Get, Param, HttpCode, BadRequestError } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { NOTES_TYPES } from '../types.js';
import { NotesService } from '../services/NotesService.js';

interface GenerateNotesPayload {
  transcriptText: string;
  courseVersionId: string;
  moduleId: string;
  moduleName: string;
}

@JsonController('/notes')
@injectable()
export class NotesController {
  constructor(@inject(NOTES_TYPES.NotesService) private readonly notesService: NotesService) {}

  // Trigger notes generation (fire‑and‑forget)
  @Post('/generate')
  @HttpCode(202)
  async generate(@Body() payload: GenerateNotesPayload) {
    const { transcriptText, courseVersionId, moduleId, moduleName } = payload;
    if (!transcriptText || !courseVersionId || !moduleId || !moduleName) {
      throw new BadRequestError('Missing required fields for notes generation');
    }
    // Fire‑and‑forget generation, does not block the upload flow.
    this.notesService.generateNotesFromText(transcriptText, courseVersionId, moduleId, moduleName);
    return { status: 'queued' };
  }

  // Get notes for a single module
  @Get('/versions/:versionId/modules/:moduleId')
  async getModuleNotes(
    @Param('versionId') versionId: string,
    @Param('moduleId') moduleId: string,
  ) {
    const note = await this.notesService.getModuleNotes(versionId, moduleId);
    if (!note) {
      throw new BadRequestError('Notes not found for the specified module');
    }
    return note;
  }

  // Get all notes for a course version
  @Get('/versions/:versionId')
  async getVersionNotes(@Param('versionId') versionId: string) {
    const notes = await this.notesService.getAllVersionNotes(versionId);
    return notes;
  }
}
