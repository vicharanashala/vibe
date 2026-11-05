import {describe, it, expect} from 'vitest';
import {mixToMono, toTranscriptChunks} from './browser-transcriber';

describe('mixToMono', () => {
  it('returns a single channel unchanged', () => {
    const channel = new Float32Array([0.1, 0.2]);
    expect(mixToMono([channel])).toBe(channel);
  });

  it('averages stereo channels', () => {
    const mono = mixToMono([new Float32Array([1, 0, 0.5]), new Float32Array([0, 0, 0.5])]);
    expect(Array.from(mono)).toEqual([0.5, 0, 0.5]);
  });

  it('uses the shortest channel length', () => {
    expect(mixToMono([new Float32Array(3), new Float32Array(2)]).length).toBe(2);
  });

  it('handles no channels', () => {
    expect(mixToMono([]).length).toBe(0);
  });
});

describe('toTranscriptChunks', () => {
  it('trims text and keeps complete timestamps', () => {
    expect(toTranscriptChunks([{text: '  Hello there. ', timestamp: [0, 2.5]}], 10)).toEqual([
      {timestamp: [0, 2.5], text: 'Hello there.'},
    ]);
  });

  it('drops empty and whitespace-only chunks', () => {
    const chunks = toTranscriptChunks(
      [
        {text: ' ', timestamp: [0, 1]},
        {text: 'Kept', timestamp: [1, 2]},
        {text: '', timestamp: [2, 3]},
      ],
      10,
    );
    expect(chunks.map((c) => c.text)).toEqual(['Kept']);
  });

  it('ends an open chunk at the next start, or at the audio end for the last one', () => {
    // Whisper leaves the end as null when the audio stops mid-sentence.
    const chunks = toTranscriptChunks(
      [
        {text: 'First', timestamp: [0, null]},
        {text: 'Second', timestamp: [4, null]},
      ],
      9.5,
    );
    expect(chunks.map((c) => c.timestamp)).toEqual([
      [0, 4],
      [4, 9.5],
    ]);
  });

  it('never produces an end before its start', () => {
    const [chunk] = toTranscriptChunks([{text: 'Odd', timestamp: [5, 3]}], 10);
    expect(chunk.timestamp).toEqual([5, 5]);
  });

  it('clamps negative starts to zero', () => {
    const [chunk] = toTranscriptChunks([{text: 'Early', timestamp: [-0.2, 1]}], 10);
    expect(chunk.timestamp).toEqual([0, 1]);
  });
});
