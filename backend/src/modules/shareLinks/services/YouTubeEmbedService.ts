import 'reflect-metadata';
import {injectable} from 'inversify';

export enum YouTubeEmbedFailure {
  INVALID_URL = 'INVALID_URL',
  NOT_FOUND = 'NOT_FOUND',
  PRIVATE = 'PRIVATE',
  EMBEDDING_DISABLED = 'EMBEDDING_DISABLED',
  AGE_OR_REGION_RESTRICTED = 'AGE_OR_REGION_RESTRICTED',
  CHECK_FAILED = 'CHECK_FAILED',
}

export interface YouTubeEmbedCheck {
  embeddable: boolean;
  videoId?: string;
  title?: string;
  reason?: YouTubeEmbedFailure;
  message?: string;
}

const FAILURE_MESSAGES: Record<YouTubeEmbedFailure, string> = {
  [YouTubeEmbedFailure.INVALID_URL]:
    "That doesn't look like a YouTube video link. Paste a link of the form " +
    'https://www.youtube.com/watch?v=… or https://youtu.be/….',
  [YouTubeEmbedFailure.NOT_FOUND]:
    'This video no longer exists on YouTube, so it cannot be played or ' +
    'tracked inside ViBe. Use a different video.',
  [YouTubeEmbedFailure.PRIVATE]:
    'This video is private. Recipients would see an empty player and nothing ' +
    'would be tracked. Make it unlisted or public, or use a different video.',
  [YouTubeEmbedFailure.EMBEDDING_DISABLED]:
    "This video's owner has disabled embedding, so it cannot be played or " +
    'tracked inside ViBe. Use a different video, or upload it directly.',
  [YouTubeEmbedFailure.AGE_OR_REGION_RESTRICTED]:
    'This video is age- or region-restricted, so some recipients will not be ' +
    'able to play it and their watching will not be tracked.',
  [YouTubeEmbedFailure.CHECK_FAILED]:
    'ViBe could not reach YouTube to check this video. Try again before ' +
    'sending the links out.',
};

/**
 * Checks whether a pasted YouTube URL can actually be played inside ViBe.
 *
 * Playback goes through the YouTube embed, so a video YouTube refuses to embed
 * cannot be tracked either — and left unchecked, the failure surfaces to
 * recipients as a dead player *after* the links have been sent. Hence the
 * check runs at paste time and is surfaced to the instructor before any link
 * is generated.
 *
 * @category ShareLinks/Services
 */
@injectable()
export class YouTubeEmbedService {
  private static readonly OEMBED_ENDPOINT =
    'https://www.youtube.com/oembed?format=json&url=';

  /**
   * Pulls the 11-character video id out of any of the URL shapes YouTube hands
   * out (watch, youtu.be, embed, shorts, live).
   */
  extractVideoId(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return null;
    }

    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const isIdLike = (value: string) => /^[A-Za-z0-9_-]{11}$/.test(value);

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return isIdLike(id) ? id : null;
    }

    if (host !== 'youtube.com' && host !== 'm.youtube.com' &&
        host !== 'youtube-nocookie.com') {
      return null;
    }

    const queryId = parsed.searchParams.get('v');
    if (queryId && isIdLike(queryId)) {
      return queryId;
    }

    const [, prefix, candidate] = parsed.pathname.split('/');
    if (['embed', 'shorts', 'live', 'v'].includes(prefix) &&
        candidate && isIdLike(candidate)) {
      return candidate;
    }

    return null;
  }

  /**
   * Asks YouTube whether the video exists and may be embedded.
   *
   * oEmbed is the check that matches what the player will do: it 404s for
   * missing videos and 401s for private ones and ones whose owner turned
   * embedding off, which is exactly the set that would break playback.
   */
  async check(url: string): Promise<YouTubeEmbedCheck> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return this.failure(YouTubeEmbedFailure.INVALID_URL);
    }

    const target = `${YouTubeEmbedService.OEMBED_ENDPOINT}${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}`;

    let response: Response;
    try {
      response = await fetch(target, {signal: AbortSignal.timeout(8000)});
    } catch {
      return this.failure(YouTubeEmbedFailure.CHECK_FAILED, videoId);
    }

    if (response.status === 404) {
      return this.failure(YouTubeEmbedFailure.NOT_FOUND, videoId);
    }

    // 401 covers both "private" and "embedding disabled"; YouTube does not
    // distinguish them here, so the message names the likelier cause and the
    // reason code stays honest about what was observed.
    if (response.status === 401 || response.status === 403) {
      return this.failure(YouTubeEmbedFailure.EMBEDDING_DISABLED, videoId);
    }

    if (!response.ok) {
      return this.failure(YouTubeEmbedFailure.CHECK_FAILED, videoId);
    }

    let payload: {title?: string};
    try {
      payload = (await response.json()) as {title?: string};
    } catch {
      return this.failure(YouTubeEmbedFailure.CHECK_FAILED, videoId);
    }

    return {embeddable: true, videoId, title: payload?.title};
  }

  private failure(
    reason: YouTubeEmbedFailure,
    videoId?: string,
  ): YouTubeEmbedCheck {
    return {
      embeddable: false,
      reason,
      message: FAILURE_MESSAGES[reason],
      ...(videoId ? {videoId} : {}),
    };
  }
}
