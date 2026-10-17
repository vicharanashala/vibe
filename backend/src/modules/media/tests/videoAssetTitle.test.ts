import 'reflect-metadata';
import {describe, expect, it} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  VideoAsset,
  stripExtension,
} from '../classes/transformers/VideoAsset.js';

const base = {
  courseId: new ObjectId().toString(),
  courseVersionId: new ObjectId().toString(),
  createdBy: new ObjectId().toString(),
  contentType: 'video/mp4',
  uploadObjectKey: 'uploads/abc/source.mp4',
};

describe('stripExtension', () => {
  it.each([
    ['lecture-01.mp4', 'lecture-01'],
    ['Week 3 — Recursion.MOV', 'Week 3 — Recursion'],
    ['no-extension', 'no-extension'],
    ['many.dots.in.name.mkv', 'many.dots.in.name'],
  ])('%s -> %s', (input, expected) => {
    expect(stripExtension(input)).toBe(expected);
  });

  it('never returns an empty title for a dotfile-style name', () => {
    // Would otherwise produce '' and leave a blank row in the library.
    expect(stripExtension('.mp4')).toBe('.mp4');
  });
});

describe('VideoAsset title', () => {
  it('defaults the title to the filename without its extension', () => {
    const asset = new VideoAsset({...base, originalFileName: 'lecture-01.mp4'});
    expect(asset.title).toBe('lecture-01');
    // Provenance is kept even though the title is derived from it.
    expect(asset.originalFileName).toBe('lecture-01.mp4');
  });

  it('prefers an explicit title', () => {
    const asset = new VideoAsset({
      ...base,
      originalFileName: 'REC_0042.mp4',
      title: 'Week 3 — Recursion',
    });
    expect(asset.title).toBe('Week 3 — Recursion');
  });

  it('falls back when the supplied title is only whitespace', () => {
    const asset = new VideoAsset({
      ...base,
      originalFileName: 'lecture-01.mp4',
      title: '   ',
    });
    expect(asset.title).toBe('lecture-01');
  });

  it('stores an empty description as undefined rather than an empty string', () => {
    const asset = new VideoAsset({
      ...base,
      originalFileName: 'a.mp4',
      description: '  ',
    });
    expect(asset.description).toBeUndefined();
  });

  it('starts in UPLOADING with no playlist', () => {
    const asset = new VideoAsset({...base, originalFileName: 'a.mp4'});
    expect(asset.status).toBe('UPLOADING');
    expect(asset.playlistObjectKey).toBeUndefined();
  });
});
