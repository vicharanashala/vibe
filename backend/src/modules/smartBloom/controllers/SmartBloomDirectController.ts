import {injectable, inject} from 'inversify';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Post,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {subject} from '@casl/ability';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  ItemActions,
  getItemAbility,
} from '#root/modules/courses/abilities/itemAbilities.js';
import {smartBloomConfig} from '#root/config/smartBloom.js';
import {SMART_BLOOM_TYPES} from '../types.js';
import {SmartBloomDirectService} from '../services/SmartBloomDirectService.js';
import {
  TranscriptBody,
  QuestionsBody,
  SegmentBody,
  UploadBody,
} from '../classes/validators/SmartBloomValidators.js';
import {BloomDistribution} from '../utils/Questions.js';

const LARGE_BODY = {
  required: true,
  options: {limit: smartBloomConfig.maxBodySize},
};

/**
 * Smart Bloom's direct path: runs when the AI server is unavailable, using
 * a transcript the instructor pastes or uploads, plus MiniMax. Every route requires
 * permission to create items in the course version, the same rule as adding an
 * item by hand, because the end result is new course items.
 */
@OpenAPI({
  tags: ['Smart Bloom (direct)'],
  description:
    'Smart Bloom without the AI server: transcript, segmentation, questions and upload.',
})
@injectable()
@JsonController('/smart-bloom/direct')
export class SmartBloomDirectController {
  constructor(
    @inject(SMART_BLOOM_TYPES.SmartBloomDirectService)
    private readonly service: SmartBloomDirectService,
  ) {}

  private assertCanCreate(ability: any, versionId: string) {
    if (!ability.can(ItemActions.Create, subject('Item', {versionId}))) {
      throw new ForbiddenError(
        'You do not have permission to create content in this course version',
      );
    }
  }

  @OpenAPI({summary: 'Whether the direct path is configured on this server'})
  @Get('/status')
  @Authorized()
  @HttpCode(200)
  async status() {
    return this.service.status();
  }

  @OpenAPI({
    summary:
      'Read a transcript the instructor pasted or uploaded, in any layout with timestamps',
  })
  @Post('/transcript')
  @Authorized()
  @HttpCode(200)
  async transcript(
    @Body(LARGE_BODY) body: TranscriptBody,
    @Ability(getItemAbility) {ability},
  ) {
    this.assertCanCreate(ability, body.versionId);
    return this.service.parseTranscript(body.content);
  }

  @OpenAPI({summary: 'Split the transcript into segments'})
  @Post('/segments')
  @Authorized()
  @HttpCode(200)
  async segment(
    @Body(LARGE_BODY) body: SegmentBody,
    @Ability(getItemAbility) {ability},
  ) {
    this.assertCanCreate(ability, body.versionId);
    const chunks = body.chunks
      .filter(
        chunk =>
          Array.isArray(chunk?.timestamp) && typeof chunk?.text === 'string',
      )
      .map(chunk => ({
        timestamp: [
          Number(chunk.timestamp[0]) || 0,
          Number(chunk.timestamp[1]) || 0,
        ] as [number, number],
        text: chunk.text,
      }));
    return this.service.segment(chunks, body.strategy, body.minSegmentSeconds);
  }

  @OpenAPI({summary: 'Generate questions for one segment'})
  @Post('/questions')
  @Authorized()
  @HttpCode(200)
  async questions(
    @Body(LARGE_BODY) body: QuestionsBody,
    @Ability(getItemAbility) {ability},
  ) {
    this.assertCanCreate(ability, body.versionId);
    return this.service.generateQuestions(body);
  }

  @OpenAPI({
    summary:
      'Create the video items, question banks and quizzes for the curated questions',
  })
  @Post('/upload')
  @Authorized()
  @HttpCode(201)
  async upload(
    @Body(LARGE_BODY) body: UploadBody,
    @Ability(getItemAbility) {ability, user},
  ) {
    this.assertCanCreate(ability, body.versionId);
    return this.service.upload(
      {
        ...body,
        distribution: body.distribution as BloomDistribution | undefined,
      },
      user._id.toString(),
    );
  }
}
