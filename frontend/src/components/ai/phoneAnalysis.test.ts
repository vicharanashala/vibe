import {describe, expect, it} from 'vitest';
import {containsPhone} from './phoneAnalysis';

const det = (name: string, score: number) => ({categories: [{categoryName: name, score}]});

describe('containsPhone', () => {
  it('detects a confident cell phone', () => {
    expect(containsPhone([det('person', 0.9), det('cell phone', 0.7)])).toBe(true);
  });
  it('ignores low-confidence phones', () => {
    expect(containsPhone([det('cell phone', 0.2)])).toBe(false);
  });
  it('ignores other objects and empty input', () => {
    expect(containsPhone([det('book', 0.95)])).toBe(false);
    expect(containsPhone([])).toBe(false);
    expect(containsPhone(undefined)).toBe(false);
  });
});
