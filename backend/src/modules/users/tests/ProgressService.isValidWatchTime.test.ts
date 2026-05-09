import { describe, it, expect } from 'vitest';
import { isValidWatchTime } from '../utils/watchTimeValidation.js';
import { IWatchTime } from '#root/shared/interfaces/models.js';

const span = (seconds: number): IWatchTime => {
  const start = new Date('2025-01-01T00:00:00Z');
  return {
    startTime: start,
    endTime: new Date(start.getTime() + seconds * 1000),
  } as IWatchTime;
};

const video = (startStr: string, endStr: string) => ({
  type: 'VIDEO',
  details: { startTime: startStr, endTime: endStr } as any,
});

const blog = (minutes: number) => ({
  type: 'BLOG',
  details: { estimatedReadTimeInMinutes: minutes } as any,
});

describe('isValidWatchTime — VIDEO upper-bound cap', () => {
  // 60s video. cap = 60*3 + 60 = 240s.
  const v = video('00:00:00', '00:01:00');

  it('accepts a watch span just under the cap', () => {
    expect(isValidWatchTime(span(239), v)).toBe(true);
  });

  it('rejects a watch span just over the cap', () => {
    expect(isValidWatchTime(span(241), v)).toBe(false);
  });

  it('rejects multi-hour idle-tab inflation on a short video', () => {
    expect(isValidWatchTime(span(60 * 60 * 3), v)).toBe(false);
  });
});

describe('isValidWatchTime — BLOG upper-bound cap', () => {
  // 2-minute blog. cap = 120*5 + 60 = 660s.
  const b = blog(2);

  it('accepts a read span just under the cap', () => {
    expect(isValidWatchTime(span(659), b)).toBe(true);
  });

  it('rejects a read span just over the cap', () => {
    expect(isValidWatchTime(span(661), b)).toBe(false);
  });
});

describe('isValidWatchTime — lower-bound sanity (regression)', () => {
  it('rejects an instant click-through on a long video', () => {
    // 10-minute video, watched 1s. min required = min(600*0.15, 30) = 30.
    // adjusted = 6, < 30 → false.
    expect(isValidWatchTime(span(1), video('00:00:00', '00:10:00'))).toBe(false);
  });

  it('accepts a short watch on a very short video', () => {
    // 10s video. min required = min(10*0.15, 30) = 1.5. adjusted = 5+5 = 10.
    expect(isValidWatchTime(span(5), video('00:00:00', '00:00:10'))).toBe(true);
  });
});
