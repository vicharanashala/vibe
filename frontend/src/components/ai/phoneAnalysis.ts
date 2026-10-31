export interface DetectionLike {
  categories: {categoryName: string; score: number}[];
}

// COCO label used by the MediaPipe EfficientDet model.
export const PHONE_LABEL = 'cell phone';
// A phone held in a hand (dark, seen edge-on or from the back) often scores
// only 0.4-0.6, so the bar is deliberately low; the PhoneWindow below filters
// one-off false positives instead.
export const PHONE_MIN_SCORE = 0.35;

/** True if any detection looks like a mobile phone with enough confidence. */
export function containsPhone(
  detections: DetectionLike[] | undefined,
  minScore: number = PHONE_MIN_SCORE,
): boolean {
  if (!detections) return false;
  return detections.some(d =>
    d.categories?.some(c => c.categoryName === PHONE_LABEL && c.score >= minScore),
  );
}

/**
 * Smooths per-sample results: a phone counts as present when it was seen in at
 * least `needed` of the last `size` samples. Tolerates detector flicker (a held
 * phone often drops below the threshold for a frame or two) without letting a
 * single stray detection through.
 */
export class PhoneWindow {
  private samples: boolean[] = [];

  constructor(
    private readonly size = 4,
    private readonly needed = 2,
  ) {}

  push(seen: boolean): boolean {
    this.samples.push(seen);
    if (this.samples.length > this.size) this.samples.shift();
    return this.samples.filter(Boolean).length >= this.needed;
  }

  reset() {
    this.samples = [];
  }
}
