import {describe, it, expect} from 'vitest';
import {
  formatTime,
  parseTimeToSeconds,
  normalizeDigits,
  groupDigits,
  digitsToSeconds,
  parsePastedTime,
  formatWatchDuration,
} from './time';

describe('formatTime', () => {
  it('formats under an hour as MM:SS', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(8)).toBe('00:08');
    expect(formatTime(90)).toBe('01:30');
    expect(formatTime(520)).toBe('08:40');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('widens to H:MM:SS past an hour instead of dropping the hours', () => {
    // The previous implementation computed minutes as (total % 3600) / 60, so
    // this wrote "01:01" — a little over a minute — into the database.
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(7325)).toBe('2:02:05');
  });

  it('floors fractional seconds and refuses nonsense', () => {
    expect(formatTime(90.9)).toBe('01:30');
    expect(formatTime(-5)).toBe('00:00');
    expect(formatTime(Number.NaN)).toBe('00:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('parseTimeToSeconds', () => {
  it('reads the formats stored on video items', () => {
    expect(parseTimeToSeconds('00:00')).toBe(0);
    expect(parseTimeToSeconds('01:30')).toBe(90);
    expect(parseTimeToSeconds('1:30')).toBe(90);
    expect(parseTimeToSeconds('1:01:01')).toBe(3661);
    expect(parseTimeToSeconds('00:01:30')).toBe(90);
  });

  it('reads a bare number as seconds', () => {
    expect(parseTimeToSeconds('90')).toBe(90);
    expect(parseTimeToSeconds(90)).toBe(90);
  });

  it('does not clamp components, so 0:90 is ninety seconds', () => {
    // This is what lets someone thinking in raw seconds type 90 and land on
    // 1:30 rather than being silently clamped to 0:59.
    expect(parseTimeToSeconds('0:90')).toBe(90);
    expect(parseTimeToSeconds('0:84')).toBe(84);
  });

  it('returns 0 for anything it cannot read', () => {
    expect(parseTimeToSeconds('')).toBe(0);
    expect(parseTimeToSeconds('   ')).toBe(0);
    expect(parseTimeToSeconds(null)).toBe(0);
    expect(parseTimeToSeconds(undefined)).toBe(0);
    expect(parseTimeToSeconds('abc')).toBe(0);
    expect(parseTimeToSeconds('1:2:3:4')).toBe(0);
    expect(parseTimeToSeconds('-5')).toBe(0);
    expect(parseTimeToSeconds('1:-30')).toBe(0);
  });

  it('round-trips with formatTime', () => {
    for (const seconds of [0, 8, 90, 520, 3599, 3600, 3661, 7325]) {
      expect(parseTimeToSeconds(formatTime(seconds))).toBe(seconds);
    }
  });
});

describe('normalizeDigits', () => {
  it('keeps digits only, capped at six', () => {
    expect(normalizeDigits('1a2b3')).toBe('123');
    expect(normalizeDigits('12345678')).toBe('345678');
  });

  it('drops leading zeros but keeps a lone zero', () => {
    // Otherwise pressing 0 as the first keystroke blanks the field.
    expect(normalizeDigits('0')).toBe('0');
    expect(normalizeDigits('00840')).toBe('840');
    expect(normalizeDigits('000')).toBe('0');
  });
});

describe('groupDigits — right-to-left stopwatch entry', () => {
  it('fills from the right as the teacher types', () => {
    expect(groupDigits('')).toBe('');
    expect(groupDigits('8')).toBe('00:08');
    expect(groupDigits('84')).toBe('00:84');
    expect(groupDigits('840')).toBe('08:40');
    expect(groupDigits('1230')).toBe('12:30');
    expect(groupDigits('12345')).toBe('01:23:45');
    expect(groupDigits('123456')).toBe('12:34:56');
  });

  it('ignores separators the teacher may still type out of habit', () => {
    expect(groupDigits('8:40')).toBe('08:40');
    expect(groupDigits('1:23:45')).toBe('01:23:45');
  });
});

describe('digitsToSeconds', () => {
  it('reads the same grouping groupDigits displays', () => {
    expect(digitsToSeconds('')).toBe(0);
    expect(digitsToSeconds('8')).toBe(8);
    expect(digitsToSeconds('840')).toBe(520);
    expect(digitsToSeconds('1230')).toBe(750);
    expect(digitsToSeconds('12345')).toBe(5025);
  });

  it('carries instead of clamping, so raw seconds also work', () => {
    // 084 shows as 00:84 while typing and commits to 01:24.
    expect(digitsToSeconds('84')).toBe(84);
    expect(digitsToSeconds('90')).toBe(90);
    expect(formatTime(digitsToSeconds('90'))).toBe('01:30');
    expect(formatTime(digitsToSeconds('130'))).toBe('01:30');
  });

  it('agrees with what the field displays', () => {
    for (const digits of ['8', '84', '840', '1230', '12345', '123456']) {
      expect(parseTimeToSeconds(groupDigits(digits))).toBe(
        digitsToSeconds(digits),
      );
    }
  });
});

describe('parsePastedTime', () => {
  it('reads a YouTube link carrying a time offset', () => {
    expect(parsePastedTime('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90);
    expect(
      parsePastedTime('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125'),
    ).toBe(125);
    expect(parsePastedTime('?start=42')).toBe(42);
  });

  it('reads unit-suffixed durations', () => {
    expect(parsePastedTime('90s')).toBe(90);
    expect(parsePastedTime('1m30s')).toBe(90);
    expect(parsePastedTime('1h2m3s')).toBe(3723);
    expect(parsePastedTime('2m')).toBe(120);
  });

  it('reads plain timestamps and bare seconds', () => {
    expect(parsePastedTime('1:30')).toBe(90);
    expect(parsePastedTime('01:01:01')).toBe(3661);
    expect(parsePastedTime('90')).toBe(90);
    expect(parsePastedTime('  1:30  ')).toBe(90);
  });

  it('returns null when there is nothing to read, so entry falls back to digits', () => {
    expect(parsePastedTime('')).toBeNull();
    expect(parsePastedTime('lecture notes')).toBeNull();
    expect(parsePastedTime('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

describe('formatWatchDuration', () => {
  it('reads a total as hours and minutes, not as a position', () => {
    expect(formatWatchDuration(8100)).toBe('2h 15m');
    expect(formatWatchDuration(900)).toBe('15m');
    expect(formatWatchDuration(45)).toBe('45s');
  });

  it('drops a zero minutes component on a whole hour', () => {
    expect(formatWatchDuration(3600)).toBe('1h');
    expect(formatWatchDuration(7200)).toBe('2h');
  });

  it('shows nothing watched as 0m rather than a blank cell', () => {
    // Never opened is the answer a sharer most wants to see, so it has to read
    // as a real zero.
    expect(formatWatchDuration(0)).toBe('0m');
    expect(formatWatchDuration(-5)).toBe('0m');
    expect(formatWatchDuration(NaN)).toBe('0m');
  });
});
