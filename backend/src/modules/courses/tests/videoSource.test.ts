// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {describe, expect, it} from 'vitest';
import {
  IVideoDetails,
  resolveVideoSource,
} from '#root/shared/interfaces/models.js';

/**
 * Guards the one rule that lets uploaded video ship without migrating content:
 * a video item with no `source` field is a YouTube item.
 *
 * Every video item created before uploads existed lacks the field. If this
 * default is ever "tidied up" — made required, made to throw, or flipped to GCS
 * — every existing course stops playing. That failure would appear in
 * production, not in a diff, so it is pinned here.
 */
describe('resolveVideoSource', () => {
  it('treats a legacy item with no source as YOUTUBE', () => {
    const legacy: IVideoDetails = {
      URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startTime: '00:00:00',
      endTime: '00:10:00',
      points: 10,
    };
    expect(resolveVideoSource(legacy)).toBe('YOUTUBE');
  });

  it('respects an explicit YOUTUBE source', () => {
    expect(resolveVideoSource({source: 'YOUTUBE'})).toBe('YOUTUBE');
  });

  it('respects an explicit GCS source', () => {
    expect(resolveVideoSource({source: 'GCS'})).toBe('GCS');
  });

  it('defaults to YOUTUBE for undefined details', () => {
    expect(resolveVideoSource(undefined)).toBe('YOUTUBE');
  });

  it('defaults to YOUTUBE for an empty object', () => {
    expect(resolveVideoSource({})).toBe('YOUTUBE');
  });

  it('never returns GCS unless it was explicitly asked for', () => {
    // The dangerous direction: a missing field must not become an upload, or a
    // legacy item would try to resolve an assetId it does not have.
    for (const details of [undefined, {}, {source: undefined}]) {
      expect(resolveVideoSource(details as never)).not.toBe('GCS');
    }
  });
});
