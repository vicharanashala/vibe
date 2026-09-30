export interface DetectionLike {
  categories: {categoryName: string; score: number}[];
}

// COCO label used by the MediaPipe EfficientDet model.
export const PHONE_LABEL = 'cell phone';
export const PHONE_MIN_SCORE = 0.45;

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
