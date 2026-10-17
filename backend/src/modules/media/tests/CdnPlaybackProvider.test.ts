import 'reflect-metadata';
import crypto from 'crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {storageConfig} from '#root/config/storage.js';
import {CdnPlaybackProvider} from '../services/storage/CdnPlaybackProvider.js';

const PLAYLIST = 'uploads/abc123/source.mp4/manifest.m3u8';
// 16 random bytes, base64url — the shape `add-signed-url-key` produces.
const KEY = 'c2VjcmV0LWtleS0xNmJ5dA';

const original = {...storageConfig.video};

function configure(overrides: Partial<typeof storageConfig.video>) {
  Object.assign(storageConfig.video, overrides);
}

describe('CdnPlaybackProvider', () => {
  beforeEach(() => {
    configure({
      cdnHost: 'cdn.vibe.vicharanashala.ai',
      cdnScheme: 'http',
      cdnKeyName: undefined,
      cdnKeyValue: undefined,
      playbackUrlTtlMinutes: 360,
    });
  });

  afterEach(() => {
    Object.assign(storageConfig.video, original);
    vi.restoreAllMocks();
  });

  it('refuses to run without a CDN host', async () => {
    configure({cdnHost: undefined});
    await expect(
      new CdnPlaybackProvider().createGrant({
        playlistObjectKey: PLAYLIST,
        userId: 'u1',
      }),
    ).rejects.toThrow(/GOOGLE_VIDEO_CDN_HOST/);
  });

  it('serves an unsigned URL when no key is configured, and says so loudly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grant = await new CdnPlaybackProvider().createGrant({
      playlistObjectKey: PLAYLIST,
      userId: 'u1',
    });

    expect(grant.url).toBe(
      `http://cdn.vibe.vicharanashala.ai/${PLAYLIST}`,
    );
    expect(grant.url).not.toContain('Signature');
    // The unsigned path only works while the bucket is public, so it must never
    // pass silently.
    expect(warn).toHaveBeenCalledOnce();
  });

  it('signs with the documented URLPrefix scheme when a key is configured', async () => {
    configure({cdnKeyName: 'vibe-cdn-key', cdnKeyValue: KEY});

    const grant = await new CdnPlaybackProvider().createGrant({
      playlistObjectKey: PLAYLIST,
      userId: 'u1',
    });
    const url = new URL(grant.url);

    expect(url.searchParams.get('KeyName')).toBe('vibe-cdn-key');
    expect(url.searchParams.get('Signature')).toBeTruthy();

    // Recompute the signature exactly as Cloud CDN will, and require a match.
    const toSign =
      `URLPrefix=${url.searchParams.get('URLPrefix')}` +
      `&Expires=${url.searchParams.get('Expires')}` +
      `&KeyName=${url.searchParams.get('KeyName')}`;
    const expected = crypto
      .createHmac('sha1', Buffer.from(KEY, 'base64url'))
      .update(toSign)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(url.searchParams.get('Signature')).toBe(expected);
  });

  it('signs the asset directory so variant playlists and segments are covered', async () => {
    configure({cdnKeyName: 'vibe-cdn-key', cdnKeyValue: KEY});

    const grant = await new CdnPlaybackProvider().createGrant({
      playlistObjectKey: PLAYLIST,
      userId: 'u1',
    });
    const prefixParam = new URL(grant.url).searchParams.get('URLPrefix')!;
    const prefix = Buffer.from(prefixParam, 'base64url').toString('utf8');

    // This is the whole point of prefix signing: media-hd.m3u8 and every .ts
    // segment sit under the same prefix, so one grant covers the full ladder.
    expect(prefix).toBe(
      'http://cdn.vibe.vicharanashala.ai/uploads/abc123/source.mp4/',
    );
    for (const sibling of ['media-hd.m3u8', 'media-sd0000000000.ts']) {
      expect(
        `http://cdn.vibe.vicharanashala.ai/uploads/abc123/source.mp4/${sibling}`.startsWith(
          prefix,
        ),
      ).toBe(true);
    }
  });

  it('never signs a prefix broad enough to cover another asset', async () => {
    configure({cdnKeyName: 'vibe-cdn-key', cdnKeyValue: KEY});

    const grant = await new CdnPlaybackProvider().createGrant({
      playlistObjectKey: PLAYLIST,
      userId: 'u1',
    });
    const prefix = Buffer.from(
      new URL(grant.url).searchParams.get('URLPrefix')!,
      'base64url',
    ).toString('utf8');

    expect(
      'http://cdn.vibe.vicharanashala.ai/uploads/other999/source.mp4/manifest.m3u8'.startsWith(
        prefix,
      ),
    ).toBe(false);
  });

  it('expires according to the configured TTL', async () => {
    configure({
      cdnKeyName: 'vibe-cdn-key',
      cdnKeyValue: KEY,
      playbackUrlTtlMinutes: 10,
    });

    const before = Date.now();
    const grant = await new CdnPlaybackProvider().createGrant({
      playlistObjectKey: PLAYLIST,
      userId: 'u1',
    });
    const expires =
      Number(new URL(grant.url).searchParams.get('Expires')) * 1000;

    expect(expires).toBeGreaterThanOrEqual(before + 9 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(before + 11 * 60 * 1000);
  });
});
