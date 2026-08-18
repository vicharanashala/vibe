import {describe, it, expect} from 'vitest';
import {SegmentContextProvider} from '../services/context/SegmentContextProvider.js';

/**
 * Unit tests for the layered lesson-context provider used by the screening
 * on-topic + answer-correctness checks. Only `repository` (Layer 1 transcript)
 * and `itemRepo` (title/description) are exercised; graded stems (Layer 2) are
 * passed in by the caller.
 */

const SEGMENT_ID = '64b000000000000000000001';

function makeProvider(opts: {
  transcript?: string | null;
  item?: {name?: string; description?: string} | null;
}): SegmentContextProvider {
  const repository: any = {
    getSegmentContextText: async () => opts.transcript ?? null,
  };
  const itemRepo: any = {
    readItemById: async () => opts.item ?? null,
  };
  return new SegmentContextProvider(repository, itemRepo);
}

describe('SegmentContextProvider', () => {
  it('uses the precomputed transcript (Layer 1) when present', async () => {
    const provider = makeProvider({
      transcript: 'The mitochondria is the powerhouse of the cell.',
      item: {name: 'Cell Biology', description: 'Intro to organelles'},
    });
    const ctx = await provider.getContext({
      segmentId: SEGMENT_ID,
      gradedStems: ['What is ATP?'],
    });
    expect(ctx).toContain('Lesson: Cell Biology');
    expect(ctx).toContain('Lesson transcript:');
    expect(ctx).toContain('powerhouse of the cell');
    // Transcript wins over the proxy — graded stems are not appended.
    expect(ctx).not.toContain('Topics covered in this lesson');
  });

  it('falls back to the graded-stem proxy (Layer 2) when no transcript', async () => {
    const provider = makeProvider({
      transcript: null,
      item: {name: 'Startups', description: 'Fundraising basics'},
    });
    const ctx = await provider.getContext({
      segmentId: SEGMENT_ID,
      gradedStems: ['Why do most startups fail?', 'What is a seed round?'],
    });
    expect(ctx).toContain('Lesson: Startups');
    expect(ctx).toContain('Topics covered in this lesson');
    expect(ctx).toContain('Why do most startups fail?');
    expect(ctx).not.toContain('Lesson transcript:');
  });

  it('returns null when there is no transcript, no stems, and no item', async () => {
    const provider = makeProvider({transcript: null, item: null});
    const ctx = await provider.getContext({segmentId: SEGMENT_ID});
    expect(ctx).toBeNull();
  });

  it('fails open (returns title-only) when the item read throws', async () => {
    const repository: any = {getSegmentContextText: async () => null};
    const itemRepo: any = {
      readItemById: async () => {
        throw new Error('db down');
      },
    };
    const provider = new SegmentContextProvider(repository, itemRepo);
    const ctx = await provider.getContext({
      segmentId: SEGMENT_ID,
      gradedStems: ['A stem'],
    });
    // Item read failed but the proxy still yields context — never throws.
    expect(ctx).toContain('Topics covered in this lesson');
  });
});
