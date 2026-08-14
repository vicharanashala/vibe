import {inject, injectable} from 'inversify';
import {MEDIA_TYPES} from '../../types.js';
import {VideoStorageService} from './VideoStorageService.js';

/** A time-boxed grant that lets one learner stream one asset. */
export interface PlaybackGrant {
  /** URL the player loads. For HLS this is the master playlist. */
  url: string;
  /** When the grant stops working — the client should refresh before this. */
  expiresAt: Date;
  /**
   * Cookies the client must present on subsequent segment requests, when the
   * strategy is CDN signed cookies. Empty for per-object signed URLs.
   */
  cookies?: Array<{name: string; value: string; domain?: string; path?: string}>;
}

/**
 * How playback is authorized at the edge.
 *
 * Two strategies are viable and the deployment's choice was not settled when
 * this was written, so call sites depend on this interface and the concrete
 * strategy is a container binding:
 *
 * - `SignedUrlPlaybackProvider` (below) — one signed URL per object. Simple, but
 *   the signature covers only the master playlist, so the stream bucket has to
 *   permit segment reads by other means, and the TTL must outlast the session.
 * - A future `CdnCookiePlaybackProvider` — Cloud CDN signed cookies covering the
 *   whole path prefix. This is the correct fit for HLS, since a player re-requests
 *   segments continuously for the entire watch.
 *
 * Swapping strategies is a one-line change in `container.ts`.
 */
export interface PlaybackUrlProvider {
  createGrant(input: {
    playlistObjectKey: string;
    userId: string;
  }): Promise<PlaybackGrant>;
}

/**
 * Per-object V4 signed URL strategy.
 *
 * Caveat, stated plainly because it is a real limitation and not a TODO: this
 * signs the master playlist only. Variant playlists and media segments are
 * fetched by the player as separate requests that carry no signature, so this
 * strategy assumes the stream bucket/CDN grants those reads some other way.
 * Move to signed cookies to close that gap.
 */
@injectable()
export class SignedUrlPlaybackProvider implements PlaybackUrlProvider {
  constructor(
    @inject(MEDIA_TYPES.VideoStorageService)
    private readonly storage: VideoStorageService,
  ) {}

  async createGrant(input: {
    playlistObjectKey: string;
    userId: string;
  }): Promise<PlaybackGrant> {
    const {url, expiresAt} = await this.storage.createPlaybackUrl(
      input.playlistObjectKey,
    );
    return {url, expiresAt};
  }
}
