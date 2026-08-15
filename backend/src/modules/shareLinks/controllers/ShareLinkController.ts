import 'reflect-metadata';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  QueryParam,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {subject} from '@casl/ability';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {CohortScopeService} from '#root/shared/functions/cohortScope.js';
import {ShareLinkService} from '../services/ShareLinkService.js';
import {YouTubeEmbedService} from '../services/YouTubeEmbedService.js';
import {
  CourseAndVersionParams,
  CreateShareLinksBody,
  CreateShareLinksResponse,
  OpenShareLinkResponse,
  ShareLinkAnalyticsListResponse,
  ShareLinkIdParams,
  ShareLinkMessageResponse,
  ShareLinkTokenParams,
  ValidateYouTubeUrlBody,
  YouTubeValidationResponse,
} from '../classes/validators/ShareLinkValidators.js';
import {
  ShareLinkActions,
  getShareLinkAbility,
} from '../abilities/shareLinkAbilities.js';
import {SHARE_LINKS_TYPES} from '../types.js';

/**
 * Share links into an existing course version, and the watching they produce.
 *
 * @category ShareLinks/Controllers
 */
@OpenAPI({
  tags: ['Share Links'],
})
@JsonController('/share-links', {transformResponse: true})
@injectable()
export class ShareLinkController {
  constructor(
    @inject(SHARE_LINKS_TYPES.ShareLinkService)
    private readonly shareLinkService: ShareLinkService,
    @inject(SHARE_LINKS_TYPES.YouTubeEmbedService)
    private readonly youTubeEmbedService: YouTubeEmbedService,
    @inject(CohortScopeService)
    private readonly cohortScopeService: CohortScopeService,
  ) {}

  @Post('/youtube/validate')
  @HttpCode(200)
  @ResponseSchema(YouTubeValidationResponse, {
    description: 'Whether the pasted video can be played and tracked in ViBe',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Validate a pasted YouTube URL',
    description:
      'Checks at paste time whether the video can be embedded. A video ViBe '
      + 'cannot embed cannot be tracked either, so the instructor is told '
      + 'before any share link is generated.',
  })
  async validateYouTubeUrl(
    @Body() body: ValidateYouTubeUrlBody,
  ): Promise<YouTubeValidationResponse> {
    return (await this.youTubeEmbedService.check(
      body.url,
    )) as YouTubeValidationResponse;
  }

  @Authorized()
  @Post('/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(CreateShareLinksResponse, {
    description: 'One share link per recipient',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Create share links',
    description:
      'Mints one identity-bearing link per recipient into an existing course '
      + 'version. Recipients never sign in; the token carries who they are.',
  })
  async createShareLinks(
    @Params() params: CourseAndVersionParams,
    @Body() body: CreateShareLinksBody,
    @Ability(getShareLinkAbility) {ability, authenticatedUser},
  ): Promise<CreateShareLinksResponse> {
    const {courseId, versionId} = params;

    // A link enrolls whoever opens it, so the target cohort has to be inside
    // the sharer's own scope before the link exists.
    this.cohortScopeService.resolve(
      authenticatedUser,
      courseId,
      versionId,
      body.cohortId,
    );

    if (
      !ability.can(
        ShareLinkActions.Create,
        subject('ShareLink', {courseId, versionId}),
      )
    ) {
      throw new ForbiddenError(
        'You do not have permission to share this course.',
      );
    }

    const links = await this.shareLinkService.createShareLinks(
      courseId,
      versionId,
      body.recipients,
      authenticatedUser.userId,
      body.cohortId,
      body.itemId,
      body.expiresInDays,
      body.viewingMode,
    );

    return {links} as CreateShareLinksResponse;
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(ShareLinkAnalyticsListResponse, {
    description: 'Per-recipient watching for this course version',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Share link analytics',
    description:
      'Who the course was shared with, and what each of them watched.',
  })
  async getShareLinkAnalytics(
    @Params() params: CourseAndVersionParams,
    @Ability(getShareLinkAbility) {ability, authenticatedUser},
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<ShareLinkAnalyticsListResponse> {
    const {courseId, versionId} = params;

    this.cohortScopeService.resolve(
      authenticatedUser,
      courseId,
      versionId,
      cohortId,
    );

    if (
      !ability.can(
        ShareLinkActions.View,
        subject('ShareLink', {courseId, versionId}),
      )
    ) {
      throw new ForbiddenError(
        'You do not have permission to view share links for this course.',
      );
    }

    const recipients = await this.shareLinkService.getAnalytics(
      courseId,
      versionId,
      cohortId,
    );
    return {recipients} as ShareLinkAnalyticsListResponse;
  }

  @Authorized()
  @Post('/:shareLinkId/revoke')
  @HttpCode(200)
  @ResponseSchema(ShareLinkMessageResponse, {
    description: 'Share link revoked',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Revoke a share link',
    description:
      'Closes the link. Watching already recorded against it is kept.',
  })
  async revokeShareLink(
    @Params() params: ShareLinkIdParams,
    @Ability(getShareLinkAbility) {ability},
  ): Promise<ShareLinkMessageResponse> {
    const link = await this.shareLinkService.findById(params.shareLinkId);

    if (
      !ability.can(
        ShareLinkActions.Modify,
        subject('ShareLink', {
          courseId: link.courseId.toString(),
          versionId: link.courseVersionId.toString(),
        }),
      )
    ) {
      throw new ForbiddenError(
        'You do not have permission to revoke this share link.',
      );
    }

    return (await this.shareLinkService.revokeShareLink(
      params.shareLinkId,
    )) as ShareLinkMessageResponse;
  }

  /**
   * Deliberately unauthenticated: the token is the credential, and the whole
   * point is that a recipient never has to sign in.
   */
  @Post('/open/:token')
  @HttpCode(200)
  @ResponseSchema(OpenShareLinkResponse, {
    description: 'Guest session for the recipient this link belongs to',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid, expired or revoked link',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Open a share link',
    description:
      'Resolves the token to its recipient, binds it to a guest identity on '
      + 'first use, and returns a custom token the client signs in with.',
  })
  async openShareLink(
    @Params() params: ShareLinkTokenParams,
  ): Promise<OpenShareLinkResponse> {
    return (await this.shareLinkService.openShareLink(
      params.token,
    )) as OpenShareLinkResponse;
  }
}
