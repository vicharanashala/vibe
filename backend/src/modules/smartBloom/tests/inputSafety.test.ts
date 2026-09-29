import {describe, it, expect} from 'vitest';
import {parseAnyTranscript} from '../utils/TranscriptFormats.js';
import {parseTimedTextFile, stripMarkup} from '../utils/Transcript.js';
import {parseModelJson} from '../utils/ModelJson.js';

/**
 * Transcript routes accept request bodies of up to 5 MB. These inputs made the
 * earlier regex-based cleanup quadratic (40 k characters already took ~2 s);
 * every one must now finish quickly at a much larger size.
 */
const SIZE = 1_000_000;
const LIMIT_MS = 1500;

function timed(fn: () => unknown): number {
  const start = Date.now();
  try {
    fn();
  } catch {
    // Rejecting bad input is fine; hanging on it is not.
  }
  return Date.now() - start;
}

describe('transcript parsing stays linear on hostile input', () => {
  it.each([
    ['spaces between two words', `0:01 a${' '.repeat(SIZE)}b\n0:02 c`],
    ['blank lines', `0:01 a${'\n'.repeat(SIZE)}b\n0:02 c`],
    ['separators', `0:01 a${',;| '.repeat(SIZE / 4)}b\n0:02 c`],
    ['unclosed angle brackets', `0:01 ${'<a'.repeat(SIZE / 2)}\n0:02 c`],
    ['digits that are not times', `0:01 ${'1:'.repeat(SIZE / 2)}\n0:02 c`],
  ])('%s', (_name, input) => {
    expect(timed(() => parseAnyTranscript(input))).toBeLessThan(LIMIT_MS);
  });

  it('SRT parser on a huge cue', () => {
    const srt = `1\n00:00:01,000 --> 00:00:02,000\n${'{\\'.repeat(SIZE / 2)}\n`;
    expect(timed(() => parseTimedTextFile(srt))).toBeLessThan(LIMIT_MS);
  });

  it('markup stripping keeps comparisons and removes tags', () => {
    expect(stripMarkup('if a < b and <i>c</i> > d').replace(/\s+/g, ' ')).toBe(
      'if a < b and c > d',
    );
    expect(timed(() => stripMarkup('<'.repeat(SIZE)))).toBeLessThan(LIMIT_MS);
  });

  it('model reply with many unclosed reasoning tags', () => {
    expect(
      timed(() => parseModelJson(`${'<think>'.repeat(SIZE / 7)}{"a":1}`)),
    ).toBeLessThan(LIMIT_MS);
  });
});
