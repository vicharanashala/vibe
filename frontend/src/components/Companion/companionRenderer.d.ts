/**
 * Type declaration for the companion canvas renderer.
 * The implementation is plain ES JavaScript (companionRenderer.js) — a
 * faithful port of the prototype's procedural drawing code. This file
 * gives TypeScript just enough shape to import it from CompanionWidget.tsx.
 */

export interface CompanionRendererOptions {
  animal?: 'panda' | 'fox' | 'penguin' | 'dog' | 'cat';
  mood?: string | null;
  prog?: number;
  idle?: number;
  quiz?: number;
}

export interface CompanionRenderer {
  setAnimal: (a: CompanionRendererOptions['animal']) => void;
  setMood: (m: string | null) => void;
  setProg: (p: number) => void;
  setIdle: (i: number) => void;
  setQuiz: (q: number) => void;
  start: () => void;
  stop: () => void;
}

export function createCompanionRenderer(
  canvas: HTMLCanvasElement,
  opts?: CompanionRendererOptions,
): CompanionRenderer;