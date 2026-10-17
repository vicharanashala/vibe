import {describe, expect, it} from 'vitest';
import {
  buildUploadObjectKey,
  candidateStreamPrefixes,
  expectedMasterPlaylistKey,
  isAllowedSourceFileName,
  isMasterPlaylistBody,
  pickMasterPlaylist,
} from '../services/storage/videoStoragePaths.js';

/**
 * Real output captured from the live pipeline for input `sample.mp4`
 * (scripts/verify-video-storage.cjs). Kept verbatim so a change in the
 * externally-owned transcoder shows up here as a failing test rather than as
 * every upload silently going FAILED in production.
 */
const REAL_PIPELINE_OUTPUT = [
  'sample.mp4/audio-only0000000000.m4s',
  'sample.mp4/hd.mp4',
  'sample.mp4/manifest.m3u8',
  'sample.mp4/manifest.mpd',
  'sample.mp4/media-hd.m3u8',
  'sample.mp4/media-hd0000000000.ts',
  'sample.mp4/media-sd.m3u8',
  'sample.mp4/media-sd0000000000.ts',
  'sample.mp4/sd.mp4',
  'sample.mp4/video-only-hd0000000000.m4s',
  'sample.mp4/video-only-sd0000000000.m4s',
];

describe('real pipeline output', () => {
  it('picks manifest.m3u8, not one of the media-* variants', () => {
    expect(pickMasterPlaylist(REAL_PIPELINE_OUTPUT)).toBe(
      'sample.mp4/manifest.m3u8',
    );
  });

  it('ignores the DASH manifest', () => {
    expect(pickMasterPlaylist(REAL_PIPELINE_OUTPUT)).not.toMatch(/\.mpd$/);
  });

  it('derives the same key the pipeline actually wrote', () => {
    expect(expectedMasterPlaylistKey('sample.mp4')).toBe(
      'sample.mp4/manifest.m3u8',
    );
  });

  it('derives the key for a ViBe upload path', () => {
    const uploadKey = buildUploadObjectKey({
      assetId: 'abc123',
      originalFileName: 'lecture.mp4',
    });
    expect(expectedMasterPlaylistKey(uploadKey)).toBe(
      'uploads/abc123/source.mp4/manifest.m3u8',
    );
  });

  it('is still reachable by the fallback prefix scan', () => {
    // The output nests under the full input object name, so the asset's own
    // folder prefix must still match it if the fast path is ever missed.
    const uploadKey = buildUploadObjectKey({
      assetId: 'abc123',
      originalFileName: 'lecture.mp4',
    });
    const [ownFolder] = candidateStreamPrefixes('abc123', uploadKey);
    expect(expectedMasterPlaylistKey(uploadKey).startsWith(ownFolder)).toBe(true);
  });
});

/**
 * These cover the one piece of real branching in the media module: deciding
 * which object in a transcoder's output is the master playlist.
 *
 * It matters because picking a *variant* by mistake does not fail loudly — it
 * silently pins every learner to one bitrate. The transcoding pipeline is owned
 * outside ViBe and its layout was undocumented when this was written, so these
 * tests are also the check that a newly-confirmed layout still resolves.
 */
describe('pickMasterPlaylist', () => {
  it('returns null when the prefix is empty', () => {
    expect(pickMasterPlaylist([])).toBeNull();
  });

  it('returns null when transcoding has produced no playlist yet', () => {
    expect(
      pickMasterPlaylist(['asset1/source.mp4', 'asset1/thumb.jpg']),
    ).toBeNull();
  });

  it('returns the only playlist when there is exactly one', () => {
    expect(pickMasterPlaylist(['asset1/manifest.m3u8'])).toBe(
      'asset1/manifest.m3u8',
    );
  });

  it('prefers a root-level master over per-rendition variants in subdirs', () => {
    const keys = [
      'asset1/720p/index.m3u8',
      'asset1/1080p/index.m3u8',
      'asset1/master.m3u8',
      'asset1/480p/index.m3u8',
    ];
    expect(pickMasterPlaylist(keys)).toBe('asset1/master.m3u8');
  });

  it('prefers a conventional master name among equal-depth playlists', () => {
    const keys = [
      'asset1/720p.m3u8',
      'asset1/manifest.m3u8',
      'asset1/1080p.m3u8',
    ];
    expect(pickMasterPlaylist(keys)).toBe('asset1/manifest.m3u8');
  });

  it('falls back to the shortest key when no name is conventional', () => {
    const keys = ['asset1/video-1080p-high.m3u8', 'asset1/video-720p.m3u8'];
    expect(pickMasterPlaylist(keys)).toBe('asset1/video-720p.m3u8');
  });

  it('ignores non-playlist objects entirely', () => {
    const keys = [
      'asset1/master.m3u8',
      'asset1/seg-00001.ts',
      'asset1/poster.png',
    ];
    expect(pickMasterPlaylist(keys)).toBe('asset1/master.m3u8');
  });

  it('handles an hls/ subdirectory layout', () => {
    const keys = ['asset1/hls/master.m3u8', 'asset1/hls/720p/index.m3u8'];
    expect(pickMasterPlaylist(keys)).toBe('asset1/hls/master.m3u8');
  });
});

describe('isMasterPlaylistBody', () => {
  it('recognizes a multivariant playlist', () => {
    const body = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
      '480p/index.m3u8',
    ].join('\n');
    expect(isMasterPlaylistBody(body)).toBe(true);
  });

  it('rejects a media (variant) playlist', () => {
    const body = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:6',
      '#EXTINF:6.0,',
      'seg-00001.ts',
    ].join('\n');
    expect(isMasterPlaylistBody(body)).toBe(false);
  });
});

describe('buildUploadObjectKey', () => {
  it('keys by assetId under a flat uploads/ prefix', () => {
    expect(
      buildUploadObjectKey({
        assetId: 'abc123',
        originalFileName: 'lecture 01.mp4',
      }),
    ).toBe('uploads/abc123/source.mp4');
  });

  it('keys by assetId, not filename, so two uploads cannot collide', () => {
    const a = buildUploadObjectKey({
      assetId: 'aaa',
      originalFileName: 'lecture.mp4',
    });
    const b = buildUploadObjectKey({
      assetId: 'bbb',
      originalFileName: 'lecture.mp4',
    });
    expect(a).not.toBe(b);
  });

  it('normalises extension casing', () => {
    expect(
      buildUploadObjectKey({assetId: 'abc123', originalFileName: 'Lecture.MP4'}),
    ).toBe('uploads/abc123/source.mp4');
  });

  it('rejects a non-video extension', () => {
    expect(() =>
      buildUploadObjectKey({assetId: 'abc123', originalFileName: 'notes.txt'}),
    ).toThrow(/Unsupported video file type/);
  });

  it('rejects a file with no extension', () => {
    expect(() =>
      buildUploadObjectKey({assetId: 'abc123', originalFileName: 'lecture'}),
    ).toThrow(/Unsupported video file type/);
  });
});

describe('isAllowedSourceFileName', () => {
  it.each(['a.mp4', 'A.MP4', 'lecture 01.mp4'])('accepts %s', name => {
    expect(isAllowedSourceFileName(name)).toBe(true);
  });

  /**
   * MP4 only for now. The other containers are rejected deliberately rather than
   * incidentally: the transcoding pipeline is owned outside this repo and has only
   * been verified with MP4, so accepting one it cannot handle would leave an upload
   * sitting in the bucket that never becomes playable.
   */
  it.each(['a.mov', 'a.mkv', 'a.webm', 'a.avi', 'a.m4v'])(
    'rejects %s until that format is verified end to end',
    name => {
      expect(isAllowedSourceFileName(name)).toBe(false);
    },
  );

  it.each(['a.txt', 'a.pdf', 'a.mp3', 'a', ''])('rejects %s', name => {
    expect(isAllowedSourceFileName(name)).toBe(false);
  });
});

/**
 * Transcoding is triggered by a Cloud Function watching the raw bucket, so the
 * output path is chosen by code ViBe does not own. These assert we search every
 * plausible layout, and — critically — that every prefix stays scoped to the one
 * asset, so a probe can never read another asset's output.
 */
describe('candidateStreamPrefixes', () => {
  it('derives from the stored upload key rather than a fixed layout', () => {
    const prefixes = candidateStreamPrefixes(
      'abc123',
      'uploads/abc123/source.mp4',
    );
    expect(prefixes).toEqual([
      'uploads/abc123/',
      'uploads/abc123/source/',
      'abc123/',
    ]);
  });

  /**
   * The layout has changed more than once. Deriving fallbacks from each asset's
   * stored key — rather than assuming today's shape — is what lets objects written
   * under any previous layout keep resolving with no migration.
   */
  it.each([
    ['course1-ver1/abc123/source.mp4', 'course1-ver1/abc123/'],
    ['course1/ver1/abc123/source.mp4', 'course1/ver1/abc123/'],
  ])('still resolves an asset stored at %s', (storedKey, expectedPrefix) => {
    expect(candidateStreamPrefixes('abc123', storedKey)).toContain(
      expectedPrefix,
    );
  });

  it('falls back to the asset id alone without an upload key', () => {
    expect(candidateStreamPrefixes('abc123')).toEqual(['abc123/']);
  });

  it('never emits a prefix that escapes the asset', () => {
    for (const prefix of candidateStreamPrefixes(
      'abc123',
      'uploads/abc123/source.mp4',
    )) {
      expect(prefix).toContain('abc123');
      expect(prefix.endsWith('/')).toBe(true);
    }
  });
});
