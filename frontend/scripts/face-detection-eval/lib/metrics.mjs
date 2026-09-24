// Shared by run-eval.mjs (measures the exact production threshold) and
// threshold-sweep.mjs (explores alternative thresholds) so both report the
// same NO_FACE/MULTIPLE_FACES bucketing the app itself uses
// (frontend/src/components/floating-video.tsx handleImageAnomaly).
export function bucketOf(count) {
  if (count === 0) return "NO_FACE";
  if (count === 1) return "OK";
  return "MULTIPLE_FACES";
}

export function computeBinaryMetrics(rows, positiveBucket, predKey) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const actual = r.groundTruthBucket === positiveBucket;
    const predicted = r[predKey] === positiveBucket;
    if (actual && predicted) tp++;
    else if (!actual && predicted) fp++;
    else if (actual && !predicted) fn++;
    else tn++;
  }
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, tn, precision, recall, f1 };
}

export function confusionMatrix(rows, predKey) {
  const buckets = ["NO_FACE", "OK", "MULTIPLE_FACES"];
  const matrix = Object.fromEntries(
    buckets.map((a) => [a, Object.fromEntries(buckets.map((p) => [p, 0]))]),
  );
  for (const r of rows) {
    matrix[r.groundTruthBucket][r[predKey]]++;
  }
  return matrix;
}

export function fmt(v) {
  return v === null ? "n/a" : v.toFixed(3);
}
