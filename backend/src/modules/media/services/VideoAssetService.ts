import {inject, injectable} from 'inversify';
import {ObjectId} from 'mongodb';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {IUser} from '#root/shared/interfaces/models.js';
import {storageConfig} from '#root/config/storage.js';
import {MEDIA_TYPES} from '../types.js';
import {
  IVideoAsset,
  VideoAsset,
} from '../classes/transformers/VideoAsset.js';
import {VideoAssetRepository} from '../repositories/providers/mongodb/VideoAssetRepository.js';
import {VideoStorageService} from './storage/VideoStorageService.js';
import {
  PlaybackGrant,
  PlaybackUrlProvider,
} from './storage/PlaybackUrlProvider.js';
import {
  ALLOWED_SOURCE_EXTENSION_LIST,
  buildUploadObjectKey,
  isAllowedSourceFileName,
} from './storage/videoStoragePaths.js';

/** Enrollment roles allowed to upload and manage course video. */
const MANAGING_ROLES = new Set(['INSTRUCTOR', 'MANAGER', 'TA', 'STAFF']);

/**
 * How long an asset may sit in UPLOADING before it is treated as abandoned.
 *
 * An upload URL is issued before the browser sends anything, so a cancelled tab,
 * a failed PUT or a closed laptop leaves a record that will never progress. We
 * cannot ask the bucket whether the object arrived — the credential is write-only
 * there by design — so staleness is judged by age. Generous enough for a large
 * file on slow upstream; short enough that a library does not fill with ghosts.
 */
const ABANDONED_UPLOAD_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Limits on refreshing in-flight assets while serving a list.
 *
 * Transcoding takes minutes, so probing the same asset every few seconds tells us
 * nothing new and just multiplies bucket calls by the number of open library tabs.
 */
const REFRESH_COOLDOWN_MS = 15 * 1000;
const MAX_REFRESH_PER_LIST = 4;

@injectable()
export class VideoAssetService {
  constructor(
    @inject(MEDIA_TYPES.VideoAssetRepo)
    private readonly repository: VideoAssetRepository,
    @inject(MEDIA_TYPES.VideoStorageService)
    private readonly storage: VideoStorageService,
    @inject(MEDIA_TYPES.PlaybackUrlProvider)
    private readonly playbackUrls: PlaybackUrlProvider,
    @inject(EnrollmentService)
    private readonly enrollments: EnrollmentService,
  ) {}

  /**
   * Reserve an asset and hand back a signed URL the browser PUTs the file to.
   *
   * The bytes never transit ViBe — this only issues the grant, so a large
   * upload costs the backend one signature instead of a long-lived request.
   */
  async createUploadUrl(input: {
    user: IUser;
    courseId: string;
    courseVersionId: string;
    fileName: string;
    contentType: string;
    sizeBytes?: number;
    /** Library display name; defaults to the filename without its extension. */
    title?: string;
    description?: string;
  }): Promise<{
    assetId: string;
    uploadUrl: string;
    uploadObjectKey: string;
    expiresAt: Date;
    requiredContentType: string;
  }> {
    const userId = requireUserId(input.user);
    await this.assertCanManage(input.user, input.courseId, input.courseVersionId);

    if (!isAllowedSourceFileName(input.fileName)) {
      // Message derived from the allow-list so the two cannot disagree.
      throw new BadRequestError(
        `Unsupported video file type. Allowed: ${ALLOWED_SOURCE_EXTENSION_LIST}`,
      );
    }
    if (input.contentType !== 'video/mp4') {
      // Pinned rather than any video/*: this exact value goes into the upload
      // signature, and the pipeline has only been verified with MP4.
      throw new BadRequestError('contentType must be video/mp4.');
    }
    const {maxUploadBytes} = storageConfig.video;
    if (input.sizeBytes !== undefined && input.sizeBytes > maxUploadBytes) {
      throw new BadRequestError(
        `This video is ${formatGiB(input.sizeBytes)} — the maximum upload size is ` +
          `${formatGiB(maxUploadBytes)}. Please compress it or split the recording.`,
      );
    }

    // The object key embeds the assetId, so the id has to exist first.
    const assetId = new ObjectId();
    const uploadObjectKey = buildUploadObjectKey({
      assetId: assetId.toString(),
      originalFileName: input.fileName,
    });

    const asset = new VideoAsset({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      createdBy: userId,
      originalFileName: input.fileName,
      contentType: input.contentType,
      uploadObjectKey,
      title: input.title,
      description: input.description,
    });
    await this.repository.create({...asset, _id: assetId});

    const {url, expiresAt} = await this.storage.createUploadUrl(
      uploadObjectKey,
      input.contentType,
    );

    return {
      assetId: assetId.toString(),
      uploadUrl: url,
      uploadObjectKey,
      expiresAt,
      requiredContentType: input.contentType,
    };
  }

  /**
   * Called by the client once its PUT succeeds.
   *
   * Treated as a *hint*, not a fact: the transition only happens if the object
   * is actually present in the bucket, so a client cannot advance an asset it
   * never uploaded.
   */
  async markUploaded(assetId: string, user: IUser): Promise<IVideoAsset> {
    const asset = await this.loadManageable(assetId, user);

    const {exists, sizeBytes} = await this.storage.statUpload(
      asset.uploadObjectKey,
    );
    // Only a definite "not there" blocks. 'unknown' means our credentials are
    // write-only on the upload bucket — the correct least-privilege grant — so
    // we cannot look, and refusing here would break every upload. READY still
    // requires a real playlist in the stream bucket, which a client cannot fake.
    if (exists === false) {
      throw new BadRequestError(
        'Upload not found in storage. Complete the upload before marking it done.',
      );
    }

    const updated = await this.repository.update(assetId, {
      status: 'PROCESSING',
      uploadedAt: new Date(),
      sizeBytes,
    });
    return updated ?? asset;
  }

  /**
   * Current state, refreshing it from the stream bucket when still in flight.
   *
   * Polling lives here rather than in a webhook handler so readiness works
   * whether or not the pipeline notifies us. A webhook can later call
   * `refreshReadiness` directly and this stays correct.
   */
  async getStatus(
    assetId: string,
    user: IUser,
  ): Promise<IVideoAsset> {
    const asset = await this.loadPlayable(assetId, user);
    if (asset.status === 'READY' || asset.status === 'FAILED') return asset;
    return this.refreshReadiness(asset);
  }

  /** Probe the stream bucket once and persist any state change. */
  async refreshReadiness(asset: IVideoAsset): Promise<IVideoAsset> {
    const assetId = asset._id?.toString();
    if (!assetId) return asset;

    // Retire abandoned uploads rather than probing them forever. Only UPLOADING
    // qualifies: once PROCESSING, the bytes did land and the transcoder owns it.
    if (
      asset.status === 'UPLOADING' &&
      Date.now() - new Date(asset.createdAt).getTime() > ABANDONED_UPLOAD_AFTER_MS
    ) {
      const updated = await this.repository.update(assetId, {
        status: 'FAILED',
        failureReason:
          'The upload never finished. Please upload this video again.',
        lastPolledAt: new Date(),
      });
      return updated ?? asset;
    }

    let probe;
    try {
      probe = await this.storage.probeForPlaylist({
        assetId,
        uploadObjectKey: asset.uploadObjectKey,
      });
    } catch (error) {
      // A storage hiccup must not flip a good asset to FAILED — leave the state
      // alone and let the next poll retry.
      console.warn(
        `[VideoAssetService] readiness probe failed for ${assetId}:`,
        error,
      );
      await this.repository.update(assetId, {lastPolledAt: new Date()});
      return asset;
    }

    if (probe.playlistObjectKey) {
      const updated = await this.repository.update(assetId, {
        status: 'READY',
        playlistObjectKey: probe.playlistObjectKey,
        readyAt: new Date(),
        lastPolledAt: new Date(),
        failureReason: undefined,
      });
      return updated ?? asset;
    }

    if (probe.problem) {
      const updated = await this.repository.update(assetId, {
        status: 'FAILED',
        failureReason: probe.problem,
        lastPolledAt: new Date(),
      });
      return updated ?? asset;
    }

    // Nothing yet. If the raw upload has landed, we are legitimately waiting on
    // the transcoder; otherwise the asset is still awaiting its upload.
    const updated = await this.repository.update(assetId, {
      lastPolledAt: new Date(),
    });
    return updated ?? asset;
  }

  /**
   * Issue a playback grant for a learner.
   *
   * Authorization is resolved from the asset's own course scope, so it holds
   * even before any item references the asset.
   */
  async createPlaybackGrant(
    assetId: string,
    user: IUser,
  ): Promise<PlaybackGrant> {
    const userId = requireUserId(user);
    let asset = await this.loadPlayable(assetId, user);

    if (asset.status !== 'READY') {
      asset = await this.refreshReadiness(asset);
    }
    if (asset.status !== 'READY' || !asset.playlistObjectKey) {
      throw new BadRequestError(
        `Video is not ready to play (status: ${asset.status}).`,
      );
    }

    return this.playbackUrls.createGrant({
      playlistObjectKey: asset.playlistObjectKey,
      userId,
    });
  }

  /**
   * The course's video library. Visible to any instructor on the course version,
   * not only the uploader — a co-instructor segmenting someone else's lecture is
   * the expected workflow.
   */
  async listByCourseVersion(input: {
    user: IUser;
    courseId: string;
    courseVersionId: string;
    limit?: number;
    search?: string;
    readyOnly?: boolean;
  }): Promise<IVideoAsset[]> {
    await this.assertCanManage(
      input.user,
      input.courseId,
      input.courseVersionId,
    );

    const assets = await this.repository.listByCourseVersion(
      input.courseVersionId,
      {
        limit: input.limit ?? 100,
        search: input.search,
        readyOnly: input.readyOnly,
      },
    );

    // Advance anything still in flight as it is listed, so the library reflects
    // reality without needing the cron sweep to have run.
    //
    // Bounded deliberately: the library polls every few seconds, and refreshing
    // every in-flight asset on every poll would mean a bucket probe per asset per
    // poll. Assets probed very recently are skipped, and only a handful are
    // advanced per request — the rest are picked up by the next poll or the cron.
    let budget = MAX_REFRESH_PER_LIST;
    return Promise.all(
      assets.map(asset => {
        if (asset.status === 'READY' || asset.status === 'FAILED') return asset;
        if (budget <= 0 || wasPolledRecently(asset)) return asset;
        budget -= 1;
        return this.refreshReadiness(asset);
      }),
    );
  }

  /**
   * Rename an asset or record details learned after upload.
   *
   * `durationSeconds` is accepted from the client because the backend cannot read
   * it — the upload credential is write-only on the raw bucket by design, and the
   * transcoder does not report back. The value is only ever used to prefill and
   * validate segment timestamps in the editor, never for authorization, so a
   * wrong value costs a bad default rather than access to anything.
   */
  async updateAsset(input: {
    assetId: string;
    user: IUser;
    title?: string;
    description?: string;
    durationSeconds?: number;
  }): Promise<IVideoAsset> {
    const asset = await this.loadManageable(input.assetId, input.user);

    const changes: Partial<IVideoAsset> = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new BadRequestError('Title cannot be empty.');
      changes.title = title;
    }
    if (input.description !== undefined) {
      changes.description = input.description.trim() || undefined;
    }
    if (input.durationSeconds !== undefined && input.durationSeconds > 0) {
      changes.durationSeconds = Math.round(input.durationSeconds);
    }

    if (Object.keys(changes).length === 0) return asset;
    const updated = await this.repository.update(input.assetId, changes);
    return updated ?? asset;
  }

  /**
   * Remove an asset from the library.
   *
   * Refused while any item still plays it — otherwise that lesson would silently
   * become unplayable. The stored objects are left in place: the service holds no
   * delete permission on either bucket, and pretending otherwise would make this
   * look like it reclaims storage when it does not.
   */
  async deleteAsset(assetId: string, user: IUser): Promise<void> {
    await this.loadManageable(assetId, user);

    if (await this.repository.isReferencedByItem(assetId)) {
      throw new BadRequestError(
        'This video is used by one or more lessons. Remove it from them first.',
      );
    }
    await this.repository.softDelete(assetId);
  }

  /**
   * Advance every in-flight asset one step. Intended for a cron sweep so an
   * asset still becomes READY even if nobody is polling it from the UI.
   */
  async sweepInFlight(limit = 25): Promise<{checked: number; ready: number}> {
    const pending = await this.repository.listInFlight(limit);
    let ready = 0;
    for (const asset of pending) {
      const updated = await this.refreshReadiness(asset);
      if (updated.status === 'READY') ready += 1;
    }
    return {checked: pending.length, ready};
  }

  // ── authorization ────────────────────────────────────────────────────────

  private async loadManageable(
    assetId: string,
    user: IUser,
  ): Promise<IVideoAsset> {
    const asset = await this.requireAsset(assetId);
    await this.assertCanManage(
      user,
      asset.courseId.toString(),
      asset.courseVersionId.toString(),
    );
    return asset;
  }

  private async loadPlayable(
    assetId: string,
    user: IUser,
  ): Promise<IVideoAsset> {
    const asset = await this.requireAsset(assetId);
    const userId = requireUserId(user);

    // The uploader always keeps access, so a teacher can verify an asset before
    // it is attached to any item.
    if (asset.createdBy.toString() === userId) return asset;
    if (isAdmin(user)) return asset;

    const enrolled = await this.hasAnyEnrollment(
      userId,
      asset.courseId.toString(),
      asset.courseVersionId.toString(),
    );
    if (!enrolled) {
      throw new ForbiddenError(
        'You do not have access to this video.',
      );
    }
    return asset;
  }

  private async requireAsset(assetId: string): Promise<IVideoAsset> {
    const asset = await this.repository.findById(assetId);
    if (!asset) throw new NotFoundError('Video asset not found.');
    return asset;
  }

  private async assertCanManage(
    user: IUser,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    if (isAdmin(user)) return;
    const userId = requireUserId(user);
    const enrollments = await this.enrollments.getAllEnrollments(userId);
    const canManage = enrollments.some(
      enrollment =>
        enrollment.courseId?.toString() === courseId &&
        enrollment.courseVersionId?.toString() === courseVersionId &&
        MANAGING_ROLES.has(String(enrollment.role ?? '').toUpperCase()),
    );
    if (!canManage) {
      throw new ForbiddenError(
        'You do not have permission to manage video for this course version.',
      );
    }
  }

  private async hasAnyEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<boolean> {
    const enrollments = await this.enrollments.getAllEnrollments(userId);
    return enrollments.some(
      enrollment =>
        enrollment.courseId?.toString() === courseId &&
        enrollment.courseVersionId?.toString() === courseVersionId,
    );
  }
}

/** True when this asset was probed too recently for another probe to be useful. */
function wasPolledRecently(asset: IVideoAsset): boolean {
  if (!asset.lastPolledAt) return false;
  return Date.now() - new Date(asset.lastPolledAt).getTime() < REFRESH_COOLDOWN_MS;
}

/** Human-readable size, so the limit is stated the way the file manager shows it. */
function formatGiB(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function requireUserId(user: IUser): string {
  const userId = user?._id?.toString();
  if (!userId) {
    throw new ForbiddenError('Unable to resolve authenticated user.');
  }
  return userId;
}

/**
 * `roles` on a user doc has been observed as both a scalar and an array, so
 * normalize defensively — the same posture as shared/functions/AbilityDecorator.
 */
function isAdmin(user: IUser): boolean {
  const values = Array.isArray(user?.roles) ? user.roles : [user?.roles];
  return values.some(
    role => typeof role === 'string' && role.toLowerCase() === 'admin',
  );
}
