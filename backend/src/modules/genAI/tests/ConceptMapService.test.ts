import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConceptMapService,
  TranscriptChunk,
} from '../services/ConceptMapService.js';
import { TaskStatus } from '../classes/transformers/GenAI.js';
import { aiConfig } from '#root/config/ai.js';

const SEGMENT_MAP = [60, 120, 180, 240, 300];

const chunks: TranscriptChunk[] = SEGMENT_MAP.map((end, i) => ({
  text: `Chunk ${i + 1} explains topic number ${i + 1} in detail. It also gives an example.`,
  timestamp: [i === 0 ? 0 : SEGMENT_MAP[i - 1], end],
}));

describe('ConceptMapService', () => {
  let service: ConceptMapService;

  beforeEach(() => {
    service = new ConceptMapService();
    // Force the no-key path so tests are deterministic regardless of the
    // machine's env.
    aiConfig.ANTHROPIC_CRED = null;
    aiConfig.ANTHROPIC_MODEL = null;
  });

  describe('generate (no key → fallback)', () => {
    it('produces a COMPLETED fallback map, one concept per segment', async () => {
      const result = await service.generate(chunks, SEGMENT_MAP);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.fallback).toBe(true);
      expect(result.nodes).toHaveLength(SEGMENT_MAP.length);
      expect(result.edges!.length).toBeGreaterThanOrEqual(
        SEGMENT_MAP.length - 1,
      );
      for (const node of result.nodes!) {
        expect(SEGMENT_MAP).toContain(node.segmentEnd);
        expect(node.label.length).toBeGreaterThan(0);
      }
    });

    it('is deterministic: same input, same map', async () => {
      const a = await service.generate(chunks, SEGMENT_MAP);
      const b = await service.generate(chunks, SEGMENT_MAP);
      expect(a).toEqual(b);
    });

    it('labels every edge with a Novak linking phrase', async () => {
      const result = await service.generate(chunks, SEGMENT_MAP);
      for (const edge of result.edges!) {
        expect(edge.label).toMatch(/^(leads to|supports)$/);
      }
    });

    it('fails cleanly (no throw) when the segment map is empty', async () => {
      const result = await service.generate(chunks, []);
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeTruthy();
    });
  });

  describe('validateGraph', () => {
    const node = (id: string, segmentEnd = 60) => ({
      id,
      label: id,
      segmentEnd,
    });

    it('accepts a valid anchored DAG', () => {
      const errors = service.validateGraph(
        [node('a'), node('b', 120), node('c', 180)],
        [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
          { from: 'b', to: 'c' },
        ],
        SEGMENT_MAP,
      );
      expect(errors).toEqual([]);
    });

    it('rejects cycles', () => {
      const errors = service.validateGraph(
        [node('a'), node('b', 120)],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
        SEGMENT_MAP,
      );
      expect(errors.some(e => e.includes('cycle'))).toBe(true);
    });

    it('rejects anchors that reference no real segment', () => {
      const errors = service.validateGraph([node('a', 999)], [], SEGMENT_MAP);
      expect(errors.some(e => e.includes('unknown segment'))).toBe(true);
    });

    it('rejects edges to missing concepts and self-loops', () => {
      const errors = service.validateGraph(
        [node('a')],
        [
          { from: 'a', to: 'ghost' },
          { from: 'a', to: 'a' },
        ],
        SEGMENT_MAP,
      );
      expect(errors.some(e => e.includes('missing concept'))).toBe(true);
      expect(errors.some(e => e.includes('self-loop'))).toBe(true);
    });

    it('rejects empty maps and maps above the node cap', () => {
      expect(
        service.validateGraph([], [], SEGMENT_MAP).some(e =>
          e.includes('no concepts'),
        ),
      ).toBe(true);
      const tooMany = Array.from({ length: 26 }, (_, i) => node(`n${i}`));
      expect(
        service.validateGraph(tooMany, [], SEGMENT_MAP).some(e =>
          e.includes('above the cap'),
        ),
      ).toBe(true);
    });
  });

  describe('parseAndValidateLlmOutput', () => {
    it('parses fenced JSON with trailing commas and maps chunkIndex to a segment', () => {
      const raw = [
        '```json',
        '{"concepts":[{"id":"c1","label":"HTTP basics","description":"d","chunkIndex":0},',
        '{"id":"c2","label":"Routing","chunkIndex":2},],',
        '"prerequisites":[{"from":"c1","to":"c2"},]}',
        '```',
      ].join('\n');
      const result = service.parseAndValidateLlmOutput(
        raw,
        chunks,
        SEGMENT_MAP,
        20,
      );
      expect(result.errors).toEqual([]);
      expect(result.nodes.map(n => n.segmentEnd)).toEqual([60, 180]);
      expect(result.edges).toEqual([{ from: 'c1', to: 'c2' }]);
    });

    it('reports unparseable output instead of throwing', () => {
      const result = service.parseAndValidateLlmOutput(
        'sorry, here is prose',
        chunks,
        SEGMENT_MAP,
        20,
      );
      expect(result.errors.some(e => e.includes('parseable'))).toBe(true);
    });

    it('rejects out-of-range chunkIndex', () => {
      const raw =
        '{"concepts":[{"id":"c1","label":"X","chunkIndex":99}],"prerequisites":[]}';
      const result = service.parseAndValidateLlmOutput(
        raw,
        chunks,
        SEGMENT_MAP,
        20,
      );
      expect(result.errors.some(e => e.includes('invalid chunkIndex'))).toBe(
        true,
      );
    });

    it('keeps short linking phrases and drops unusable ones', () => {
      const raw = JSON.stringify({
        concepts: [
          { id: 'c1', label: 'A', chunkIndex: 0 },
          { id: 'c2', label: 'B', chunkIndex: 2 },
          { id: 'c3', label: 'C', chunkIndex: 4 },
        ],
        prerequisites: [
          { from: 'c1', to: 'c2', label: '  leads to  ' },
          { from: 'c2', to: 'c3', label: 'x'.repeat(31) }, // too long
          { from: 'c1', to: 'c3', label: 42 }, // not a string
        ],
      });
      const result = service.parseAndValidateLlmOutput(
        raw,
        chunks,
        SEGMENT_MAP,
        20,
      );
      expect(result.errors).toEqual([]);
      expect(result.edges[0].label).toBe('leads to');
      expect(result.edges[1].label).toBeUndefined();
      expect(result.edges[2].label).toBeUndefined();
    });
  });
});
