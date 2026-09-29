import {describe, it, expect} from 'vitest';
import {
  evenSegmentMap,
  json3ToChunks,
  normalizeSegmentMap,
  parseCueTime,
  parseTimedTextFile,
  textInWindow,
  transcriptEndTime,
} from '../utils/Transcript.js';

describe('parseCueTime', () => {
  it('reads SRT, VTT and short forms', () => {
    expect(parseCueTime('00:01:02,500')).toBe(62.5);
    expect(parseCueTime('01:00:00.000')).toBe(3600);
    expect(parseCueTime('02:03.250')).toBe(123.25);
    expect(parseCueTime('nonsense')).toBeNull();
  });
});

describe('parseTimedTextFile', () => {
  it('parses SRT', () => {
    const srt =
      '1\r\n00:00:01,000 --> 00:00:04,000\r\nHello <i>class</i>.\r\n\r\n2\r\n00:00:04,500 --> 00:00:08,000\r\nToday: recursion.\r\n';
    expect(parseTimedTextFile(srt)).toEqual([
      {timestamp: [1, 4], text: 'Hello class.'},
      {timestamp: [4.5, 8], text: 'Today: recursion.'},
    ]);
  });

  it('parses WebVTT, skipping header, NOTE and cue settings', () => {
    const vtt = [
      'WEBVTT',
      'Kind: captions',
      '',
      'NOTE produced by a tool',
      '',
      '00:00:01.000 --> 00:00:03.000 align:start position:0%',
      '<v Speaker>First line</v>',
      '',
      'cue-2',
      '00:00:03.000 --> 00:00:05.500',
      'Second &amp; last',
    ].join('\n');
    expect(parseTimedTextFile(vtt)).toEqual([
      {timestamp: [1, 3], text: 'First line'},
      {timestamp: [3, 5.5], text: 'Second & last'},
    ]);
  });

  it('collapses rolling auto-caption repeats', () => {
    const vtt =
      'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nwe start with arrays\n\n00:00:03.000 --> 00:00:03.010\narrays\n\n00:00:03.010 --> 00:00:06.000\nthen linked lists\n';
    expect(parseTimedTextFile(vtt).map(chunk => chunk.text)).toEqual([
      'we start with arrays',
      'then linked lists',
    ]);
  });

  it('returns nothing for plain text without timings', () => {
    expect(parseTimedTextFile('Just a paragraph of lecture notes.')).toEqual(
      [],
    );
  });
});

describe('json3ToChunks', () => {
  it('converts YouTube json3 events and skips empty ones', () => {
    const json3 = {
      events: [
        {tStartMs: 0, dDurationMs: 500},
        {
          tStartMs: 1360,
          dDurationMs: 1680,
          segs: [{utf8: 'Hello '}, {utf8: 'world'}],
        },
        {tStartMs: 3000, dDurationMs: 1000, segs: [{utf8: '\n'}]},
      ],
    };
    expect(json3ToChunks(json3)).toEqual([
      {timestamp: [1.36, 3.04], text: 'Hello world'},
    ]);
  });
});

describe('segment maps', () => {
  it('keeps valid boundaries, drops short ones, and ends at the video end', () => {
    // 100 is under the 120 s minimum from the start; 590 would leave a 10 s tail.
    expect(
      normalizeSegmentMap([300, 150, 100, 450, 590, 'x'], 600, 120),
    ).toEqual([150, 300, 450, 600]);
  });

  it('returns one segment for a short video', () => {
    expect(normalizeSegmentMap([], 90, 120)).toEqual([90]);
  });

  it('splits evenly as a fallback', () => {
    expect(evenSegmentMap(1800, 360)).toEqual([360, 720, 1080, 1440, 1800]);
    expect(evenSegmentMap(100, 360)).toEqual([100]);
  });

  it('selects segment text by chunk start time', () => {
    const chunks = [
      {timestamp: [0, 5] as [number, number], text: 'a'},
      {timestamp: [5, 10] as [number, number], text: 'b'},
      {timestamp: [10, 15] as [number, number], text: 'c'},
    ];
    expect(textInWindow(chunks, 5, 15)).toBe('b c');
    expect(transcriptEndTime(chunks)).toBe(15);
  });
});
