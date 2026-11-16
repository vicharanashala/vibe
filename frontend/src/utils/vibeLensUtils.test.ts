import { describe, it, expect } from 'vitest';
import {
  formatLensTime,
  isLensFeatureActive,
  parseSolverResponse,
} from './vibeLensUtils';

describe('vibeLensUtils', () => {
  describe('formatLensTime', () => {
    it('formats 0 seconds correctly', () => {
      expect(formatLensTime(0)).toBe('00:00');
    });

    it('formats seconds under one minute correctly', () => {
      expect(formatLensTime(9)).toBe('00:09');
      expect(formatLensTime(45)).toBe('00:45');
    });

    it('formats exact minutes and seconds', () => {
      expect(formatLensTime(65)).toBe('01:05');
      expect(formatLensTime(125)).toBe('02:05');
      expect(formatLensTime(3600)).toBe('60:00');
    });

    it('handles negative or invalid seconds gracefully', () => {
      expect(formatLensTime(-10)).toBe('00:00');
      expect(formatLensTime(NaN)).toBe('00:00');
      expect(formatLensTime(undefined as any)).toBe('00:00');
    });
  });

  describe('isLensFeatureActive', () => {
    it('returns true when both course and item are enabled or undefined', () => {
      expect(isLensFeatureActive(true, true)).toBe(true);
      expect(isLensFeatureActive(undefined, undefined)).toBe(true);
      expect(isLensFeatureActive(true, undefined)).toBe(true);
    });

    it('returns false when course toggle is explicitly disabled', () => {
      expect(isLensFeatureActive(false, true)).toBe(false);
      expect(isLensFeatureActive(false, false)).toBe(false);
      expect(isLensFeatureActive(false, undefined)).toBe(false);
    });

    it('returns false when item toggle is explicitly disabled', () => {
      expect(isLensFeatureActive(true, false)).toBe(false);
      expect(isLensFeatureActive(undefined, false)).toBe(false);
    });
  });

  describe('parseSolverResponse', () => {
    it('returns an empty array for empty or null text', () => {
      expect(parseSolverResponse('')).toEqual([]);
      expect(parseSolverResponse(null as any)).toEqual([]);
    });

    it('identifies headings and paragraphs', () => {
      const text = '# Overview\nThis is a conceptual explanation.';
      const result = parseSolverResponse(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'heading', content: 'Overview' });
      expect(result[1]).toEqual({ type: 'paragraph', content: 'This is a conceptual explanation.' });
    });

    it('identifies bullet points', () => {
      const text = '- First step\n* Second step';
      const result = parseSolverResponse(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'bullet', content: 'First step' });
      expect(result[1]).toEqual({ type: 'bullet', content: 'Second step' });
    });

    it('extracts multi-line code blocks and detects language', () => {
      const text = 'Here is the fix:\n```javascript\nfunction solve() {\n  return 42;\n}\n```\nDone!';
      const result = parseSolverResponse(text);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'paragraph', content: 'Here is the fix:' });
      expect(result[1]).toEqual({
        type: 'code',
        content: 'function solve() {\n  return 42;\n}',
        language: 'javascript',
      });
      expect(result[2]).toEqual({ type: 'paragraph', content: 'Done!' });
    });

    it('handles unclosed code blocks gracefully', () => {
      const text = '```typescript\nconst x = 10;';
      const result = parseSolverResponse(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: 'const x = 10;',
        language: 'typescript',
      });
    });
  });
});
