import {describe, it, expect} from 'vitest';
import {
  parseAnyTranscript,
  TranscriptFormatError,
} from '../utils/TranscriptFormats.js';

const texts = (content: string) => parseAnyTranscript(content).map(c => c.text);
const times = (content: string) =>
  parseAnyTranscript(content).map(c => c.timestamp);

describe('parseAnyTranscript: formats instructors actually have', () => {
  it("YouTube's copied transcript panel (time on its own line, spoken-out time under it)", () => {
    const pasted = [
      '0:00',
      'hello everyone and welcome',
      '0:04',
      '4 seconds',
      'today we talk about arrays',
      '1:02',
      '1 minute, 2 seconds',
      'next come linked lists',
    ].join('\n');
    expect(texts(pasted)).toEqual([
      'hello everyone and welcome',
      'today we talk about arrays',
      'next come linked lists',
    ]);
    expect(times(pasted).slice(0, 2)).toEqual([
      [0, 4],
      [4, 62],
    ]);
  });

  it('one line per cue with the time first, ignoring times said mid-sentence', () => {
    const notes = [
      '0:00 Welcome to the course',
      '0:15 Read Genesis 3:16 before class at 10:30 am',
      '0:40 Now we start arrays',
    ].join('\n');
    expect(times(notes).map(t => t[0])).toEqual([0, 15, 40]);
    expect(texts(notes)[1]).toBe('Read Genesis 3:16 before class at 10:30 am');
  });

  it('bracketed hh:mm:ss markers with speaker names', () => {
    const doc =
      '[00:00:05] Teacher: Good morning.\n[00:01:10] Teacher: Let us begin with sorting.\n[01:02:03] Teacher: Summary.';
    expect(times(doc).map(t => t[0])).toEqual([5, 70, 3723]);
    expect(texts(doc)[0]).toBe('Teacher: Good morning.');
  });

  it('Otter-style: label and time on one line, speech on the next', () => {
    const otter =
      'Speaker 1  0:03\nGood morning class.\n\nSpeaker 2  0:10\nMorning!\n\nSpeaker 1  0:14\nOpen chapter two.';
    expect(texts(otter)).toEqual([
      'Good morning class.',
      'Morning!',
      'Open chapter two.',
    ]);
    expect(times(otter)[0]).toEqual([3, 10]);
  });

  it('SRT', () => {
    const srt =
      '1\n00:00:01,000 --> 00:00:04,000\nHello class.\n\n2\n00:00:04,500 --> 00:00:08,000\nToday: recursion.\n';
    expect(parseAnyTranscript(srt)).toEqual([
      {timestamp: [1, 4], text: 'Hello class.'},
      {timestamp: [4.5, 8], text: 'Today: recursion.'},
    ]);
  });

  it('Teams transcript copied out of Word (no blank lines between cues, single-digit fields)', () => {
    const teams = [
      '0:0:0.0 --> 0:0:3.320',
      'Meenakshi V',
      'Hello everyone.',
      '0:0:3.320 --> 0:0:6.100',
      'Meenakshi V',
      'Today we cover queues.',
    ].join('\n');
    expect(times(teams)).toEqual([
      [0, 3.32],
      [3.32, 6.1],
    ]);
    expect(texts(teams)[1]).toBe('Meenakshi V Today we cover queues.');
  });

  it('SBV (YouTube Studio legacy export)', () => {
    const sbv =
      '0:00:01.000,0:00:04.000\nHello there\n\n0:00:04.500,0:00:08.000\nSecond line';
    expect(times(sbv)).toEqual([
      [1, 4],
      [4.5, 8],
    ]);
  });

  it('CSV rows from a spreadsheet', () => {
    const csv =
      'start,end,text\n00:00:01,00:00:04,"Hello, class"\n00:00:04,00:00:09,"Arrays today"';
    expect(parseAnyTranscript(csv)).toEqual([
      {timestamp: [1, 4], text: 'Hello, class'},
      {timestamp: [4, 9], text: 'Arrays today'},
    ]);
  });

  it('Whisper JSON segments', () => {
    const json = JSON.stringify({
      segments: [
        {start: 0, end: 3.2, text: ' Hello'},
        {start: 3.2, end: 7, text: ' World'},
      ],
    });
    expect(parseAnyTranscript(json)).toEqual([
      {timestamp: [0, 3.2], text: 'Hello'},
      {timestamp: [3.2, 7], text: 'World'},
    ]);
  });

  it('JSON list with start + duration', () => {
    const json = JSON.stringify([
      {text: 'Hi', start: 1.5, duration: 2},
      {text: 'there', start: 3.5, duration: 1},
    ]);
    expect(times(json)).toEqual([
      [1.5, 3.5],
      [3.5, 4.5],
    ]);
  });

  it('JSON in milliseconds', () => {
    const json = JSON.stringify([
      {text: 'late', offset: 125000, duration: 3000},
      {text: 'later', offset: 128000, duration: 2000},
    ]);
    expect(times(json)).toEqual([
      [125, 128],
      [128, 130],
    ]);
  });

  it('the platform chunk format itself', () => {
    const json = JSON.stringify({
      chunks: [
        {timestamp: [0, 2], text: 'a'},
        {timestamp: [2, null], text: 'b'},
      ],
    });
    expect(parseAnyTranscript(json)[1].timestamp[1]).toBeGreaterThan(2);
  });

  it('explains the problem when there are no timestamps', () => {
    expect(() =>
      parseAnyTranscript('Just my lecture notes without any times.'),
    ).toThrow(TranscriptFormatError);
    expect(() => parseAnyTranscript('')).toThrow(TranscriptFormatError);
  });
});
