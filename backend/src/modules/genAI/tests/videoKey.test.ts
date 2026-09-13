import {describe, it, expect} from 'vitest';
import {extractVideoKey} from '../utils/videoKey.js';

const ID = 'dQw4w9WgXcQ';
const KEY = `yt:${ID}`;

describe('extractVideoKey', () => {
  it('reads the standard watch url', () => {
    expect(extractVideoKey(`https://www.youtube.com/watch?v=${ID}`)).toBe(KEY);
  });

  it('ignores the extra parameters that make raw-url matching fail', () => {
    // These are exactly the variants that defeat `jobs.find({url})` in
    // scripts/backfill-segment-transcripts.cjs, which is what this exists to fix.
    const variants = [
      `https://www.youtube.com/watch?v=${ID}&t=90s`,
      `https://www.youtube.com/watch?v=${ID}&list=PL123&index=4`,
      `https://youtube.com/watch?v=${ID}`,
      `http://www.youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `www.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}`,
      `  https://www.youtube.com/watch?v=${ID}  `,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ];
    for (const url of variants) {
      expect(extractVideoKey(url), url).toBe(KEY);
    }
  });

  it('reads short, embed, shorts and live forms', () => {
    expect(extractVideoKey(`https://youtu.be/${ID}`)).toBe(KEY);
    expect(extractVideoKey(`https://youtu.be/${ID}?si=abc123`)).toBe(KEY);
    expect(extractVideoKey(`https://www.youtube.com/embed/${ID}?rel=0`)).toBe(KEY);
    expect(extractVideoKey(`https://www.youtube.com/shorts/${ID}`)).toBe(KEY);
    expect(extractVideoKey(`https://www.youtube.com/live/${ID}`)).toBe(KEY);
    expect(extractVideoKey(`https://www.youtube.com/v/${ID}`)).toBe(KEY);
  });

  it('accepts a bare id, matching what the frontend already extracts', () => {
    expect(extractVideoKey(ID)).toBe(KEY);
  });

  it('is idempotent, so callers can normalise defensively', () => {
    expect(extractVideoKey(KEY)).toBe(KEY);
    expect(extractVideoKey(extractVideoKey(`https://youtu.be/${ID}`))).toBe(KEY);
  });

  it('returns null rather than guessing', () => {
    const unrecognised = [
      undefined,
      null,
      '',
      '   ',
      'not a url',
      'https://vimeo.com/123456',
      'https://storage.googleapis.com/bucket/video.mp4',
      // Right shape, wrong host.
      `https://example.com/watch?v=${ID}`,
      // A playlist carries no single video.
      'https://www.youtube.com/playlist?list=PL123',
      // Ids are exactly 11 chars; near-misses must not resolve.
      'https://www.youtube.com/watch?v=tooshort',
      `https://youtu.be/${ID}extra`,
    ];
    for (const url of unrecognised) {
      expect(extractVideoKey(url as string | null | undefined), String(url)).toBeNull();
    }
  });

  it('does not treat an id embedded in a longer path as a match', () => {
    expect(extractVideoKey('https://www.youtube.com/channel/UCabcdefghij')).toBeNull();
  });
});

describe('backfill script parity', () => {
  /*
   * scripts/backfill-genai-video-keys.cjs carries its own copy of the
   * normaliser because it is plain CJS and cannot import this ESM module. A
   * divergence between the two would write keys that the runtime lookup then
   * fails to match — silent and hard to trace — so pin them together here.
   */
  it('matches the copy in the backfill script on every case above', async () => {
    const script = await import(
      '../../../../scripts/backfill-genai-video-keys.cjs'
    );
    const scriptExtract = (script.default ?? script).extractVideoKey;

    const cases = [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/watch?v=${ID}&t=90s`,
      `https://www.youtube.com/watch?v=${ID}&list=PL123&index=4`,
      `https://youtube.com/watch?v=${ID}`,
      `http://www.youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `www.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}`,
      `  https://www.youtube.com/watch?v=${ID}  `,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc123`,
      `https://www.youtube.com/embed/${ID}?rel=0`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/v/${ID}`,
      ID,
      KEY,
      '',
      '   ',
      'not a url',
      'https://vimeo.com/123456',
      'https://storage.googleapis.com/bucket/video.mp4',
      `https://example.com/watch?v=${ID}`,
      'https://www.youtube.com/playlist?list=PL123',
      'https://www.youtube.com/watch?v=tooshort',
      `https://youtu.be/${ID}extra`,
      'https://www.youtube.com/channel/UCabcdefghij',
    ];

    for (const input of cases) {
      expect(scriptExtract(input), input).toBe(extractVideoKey(input));
    }
    expect(scriptExtract(undefined)).toBe(extractVideoKey(undefined));
    expect(scriptExtract(null)).toBe(extractVideoKey(null));
  });
});
