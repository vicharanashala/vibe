import {describe, expect, it} from 'vitest';
import {containsPhone, PhoneWindow} from './phoneAnalysis';

const det = (name: string, score: number) => ({categories: [{categoryName: name, score}]});

describe('containsPhone', () => {
  it('detects a confident cell phone', () => {
    expect(containsPhone([det('person', 0.9), det('cell phone', 0.7)])).toBe(true);
  });
  it('ignores low-confidence phones', () => {
    expect(containsPhone([det('cell phone', 0.2)])).toBe(false);
    // A dark phone held in a hand scored ~0.4 in a real camera frame.
    expect(containsPhone([det('cell phone', 0.4)])).toBe(true);
  });
  it('ignores other objects and empty input', () => {
    expect(containsPhone([det('book', 0.95)])).toBe(false);
    expect(containsPhone([])).toBe(false);
    expect(containsPhone(undefined)).toBe(false);
  });
});

describe('PhoneWindow', () => {
  it('needs 2 of the last 4 samples', () => {
    const w = new PhoneWindow(4, 2);
    expect(w.push(true)).toBe(false); // a single stray hit is ignored
    expect(w.push(false)).toBe(false);
    expect(w.push(true)).toBe(true);
  });
  it('tolerates a flickering held phone', () => {
    const w = new PhoneWindow(4, 2);
    w.push(true);
    w.push(true);
    expect(w.push(false)).toBe(true);
    expect(w.push(false)).toBe(true);
  });
  it('clears once the phone is gone', () => {
    const w = new PhoneWindow(4, 2);
    w.push(true);
    w.push(true);
    for (let i = 0; i < 4; i++) w.push(false);
    expect(w.push(false)).toBe(false);
  });
});
