import crypto from 'crypto';
import {injectable} from 'inversify';
import {storageConfig} from '#root/config/storage.js';
import {PlaybackGrant, PlaybackUrlProvider} from './PlaybackUrlProvider.js';

/**
 * Serves playback through Cloud CDN rather than the storage API.
 *
 * Two reasons this is the better strategy for HLS:
 *
 * 1. The CDN caches at the edge, so a learner streams from a nearby copy.
 * 2. Cloud CDN can sign a whole **path prefix**. A GCS signed URL covers exactly
 *    one object, which for HLS means only the master playlist — the variant
 *    playlists and every .ts segment travel unsigned. Prefix signing covers the
 *    entire ladder, which is what makes playback genuinely protected.
 *
 * Signing follows Google's signed-URL-prefix scheme: HMAC-SHA1 over
 * `URLPrefix=<b64>&Expires=<unix>&KeyName=<name>`, base64url-encoded, with the
 * same three parameters plus `Signature` appended to the request URL.
 */
@injectable()
export class CdnPlaybackProvider implements PlaybackUrlProvider {
  async createGrant(input: {
    playlistObjectKey: string;
    userId: string;
  }): Promise<PlaybackGrant> {
    const {cdnHost, cdnScheme, cdnKeyName, cdnKeyValue, playbackUrlTtlMinutes} =
      storageConfig.video;

    if (!cdnHost) {
      throw new Error(
        'CdnPlaybackProvider requires GOOGLE_VIDEO_CDN_HOST to be set.',
      );
    }

    const expiresAt = new Date(Date.now() + playbackUrlTtlMinutes * 60 * 1000);
    const base = `${cdnScheme}://${cdnHost}`;
    const url = `${base}/${encodePath(input.playlistObjectKey)}`;

    if (!cdnKeyName || !cdnKeyValue) {
      // Unsigned: only reachable because the bucket still allows public read.
      // Deliberately loud — this is a gap to close, not a supported mode.
      console.warn(
        '[CdnPlaybackProvider] Serving UNSIGNED playback URLs — ' +
          'GOOGLE_VIDEO_CDN_KEY_NAME/VALUE are not set. Playback is only ' +
          'working because the stream bucket permits public read.',
      );
      return {url, expiresAt};
    }

    // Sign the asset's whole directory so the variant playlists and segments the
    // player fetches next are covered by the same grant.
    const prefix = `${base}/${encodePath(parentPath(input.playlistObjectKey))}/`;
    const urlPrefix = base64Url(Buffer.from(prefix, 'utf8'));
    const expires = Math.floor(expiresAt.getTime() / 1000);

    const toSign = `URLPrefix=${urlPrefix}&Expires=${expires}&KeyName=${cdnKeyName}`;
    const signature = base64Url(
      crypto
        .createHmac('sha1', Buffer.from(cdnKeyValue, 'base64url'))
        .update(toSign)
        .digest(),
    );

    return {url: `${url}?${toSign}&Signature=${signature}`, expiresAt};
  }
}

/** Percent-encode each path segment while keeping the separators intact. */
function encodePath(objectKey: string): string {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

/** Everything before the final segment — the asset's own directory. */
function parentPath(objectKey: string): string {
  const parts = objectKey.split('/');
  parts.pop();
  return parts.join('/');
}

/** base64url: Cloud CDN expects '-' and '_' rather than '+' and '/'. */
function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
