# Face-Count Detection Accuracy — Test Report

Issue: [#1222 — Test & measure accuracy of face count detection](https://github.com/vicharanashala/vibe/issues/1222)

## Decision

**Current accuracy is not acceptable for proctoring as a single-frame automatic
trigger, at any fixed confidence threshold.** On 211 frames of real
exam-webcam footage, the production config (`minDetectionConfidence: 0.5`)
gets an overall bucket accuracy of **59.2%**. `NO_FACE` precision is
**0.093** — 90.7% of frames the model would flag as "student left the frame"
are actually a student who was present but undetected (looking down, glasses
glare, an occluding hand). `MULTIPLE_FACES` precision is **0.279** — most
multi-face flags are actually a single real face plus one spurious
low-confidence phantom detection elsewhere in the frame.

| Metric | Value |
| --- | --- |
| n | 211 |
| Bucket accuracy (NO_FACE / OK / MULTIPLE_FACES) | 59.2% |
| `NO_FACE` precision / recall / F1 | 0.093 / 1.000 / 0.170 |
| `MULTIPLE_FACES` precision / recall / F1 | 0.279 / 0.850 / 0.420 |

A [threshold sweep](#threshold-sweep) shows `MULTIPLE_FACES` precision can be
pushed to 0.92 by raising `minDetectionConfidence` to 0.7, but that trades
away `NO_FACE` further (already the worse of the two failure modes) and
still leaves `NO_FACE` precision at 0.06. There is no single threshold where
both anomaly types are simultaneously trustworthy as a single-frame trigger.
See [Recommendations](#recommendations).

## Methodology

### Model under test

`@mediapipe/tasks-vision`'s `FaceDetector`, the detector actually shipped in
production as of this branch (see
`frontend/src/components/ai/FaceDetectorWorker.ts`, #1222's confidence-field
work) — a real swap from the detector family this dataset and harness were
originally built against (`@tensorflow-models/face-detection`), which had no
confidence score on any runtime. Config, identical to production:

- Model: `blaze_face_short_range.tflite`
- `runningMode`: `"IMAGE"`
- `minDetectionConfidence`: `0.5`
- `delegate`: `"CPU"` (no WebGL/GPU context in headless mode — the same
  fallback path production takes under `VITE_E2E_TESTING`)

### Why a real browser instead of Node

`FaceDetector.detect()` only accepts a `TexImageSource`
(`ImageBitmap`/`ImageData`/`HTMLImageElement`/...), none of which exist
natively in Node — unlike the previous detector, which ran on a pure-WASM
tfjs backend directly in Node. Rather than approximate that with a
canvas/jsdom polyfill of unknown fidelity, `run-eval.mjs` drives real
headless Chromium (Playwright) against a tiny local static server that
serves the app's *actual self-hosted* assets
(`frontend/public/mediapipe/wasm`, `frontend/public/mediapipe/models/...`)
and the installed `@mediapipe/tasks-vision` bundle — the same
`FilesetResolver`/`FaceDetector` calls, same asset URLs, same code path
`FaceDetectorWorker.ts` uses in production. Zero polyfill gap.

### Anomaly bucketing

The frontend maps raw face count to proctoring anomalies as:

```
0 faces  -> NO_FACE
1 face   -> OK (no anomaly)
2+ faces -> MULTIPLE_FACES
```

(see `frontend/src/components/floating-video.tsx`'s `handleImageAnomaly`).
`run-eval.mjs` reproduces the same bucketing so these metrics mean the same
thing the production anomaly flags mean.

### Test set — 211 labeled frames (`labels.csv`)

Dataset and provenance are unchanged from the eval harness this was adapted
from — real ground truth, not synthetic faces:

- **171 frames** hand-labeled from the MSU Online Exam Proctoring (OEP)
  dataset — real exam-webcam footage, the actual use case — extracted via
  the two-phase Kaggle pipeline in [kaggle/](./kaggle/README.md) (the raw
  source is ~11.8GB).
- **20 frames** with mask-wearing subjects, from a public HuggingFace
  face-mask dataset (OEP predates mask-wearing as routine exam attire).
- **20 frames** with a synthetic exposure transform applied to real OEP
  frames, for the `lighting` condition (OEP's webcam auto-exposure means it
  has no genuine poor-lighting frames).

Condition tag breakdown:

| condition_tags | n |
| --- | --- |
| glasses | 50 |
| normal | 43 |
| mask | 20 |
| peer_present | 20 |
| lighting | 20 |
| occlusion;angle | 19 |
| angle | 20 |
| occlusion | 15 |
| absent | 4 |

## Results

### Overall (n=211)

| Metric | Value |
| --- | --- |
| Bucket accuracy | 59.2% |
| `NO_FACE` precision | 0.093 |
| `NO_FACE` recall | 1.000 |
| `NO_FACE` F1 | 0.170 |
| `MULTIPLE_FACES` precision | 0.279 |
| `MULTIPLE_FACES` recall | 0.850 |
| `MULTIPLE_FACES` F1 | 0.420 |

Confusion matrix (rows = ground truth, cols = predicted):

| | NO_FACE | OK | MULTIPLE_FACES |
| --- | --- | --- | --- |
| **NO_FACE** (n=4) | 4 | 0 | 0 |
| **OK** (n=187) | 39 | 104 | 44 |
| **MULTIPLE_FACES** (n=20) | 0 | 3 | 17 |

Both false-positive columns are large relative to their true-positive rows:
39 real single-face frames get flagged `NO_FACE`, and 44 get flagged
`MULTIPLE_FACES` — 83 of 187 real "OK" frames (44%) would generate a false
proctoring anomaly at the production threshold.

### By condition

| condition_tags | n | accuracy | NO_FACE F1 | MULTIPLE_FACES F1 |
| --- | --- | --- | --- | --- |
| normal | 43 | 100.0% | n/a | n/a |
| absent | 4 | 100.0% | 1.000 | n/a |
| lighting | 20 | 95.0% | n/a | n/a |
| peer_present | 20 | 85.0% | n/a | 0.919 |
| mask | 20 | 80.0% | n/a | n/a |
| angle | 20 | 60.0% | n/a | n/a |
| occlusion | 15 | 33.3% | n/a | n/a |
| occlusion;angle | 19 | 15.8% | n/a | n/a |
| glasses | 50 | 12.0% | n/a | n/a |

`glasses` (the largest single condition, 50 frames) and `occlusion` /
`occlusion;angle` are by far the worst-performing conditions — the same
categories that broke the previous detector, for what looks like a
different underlying reason this time (see [Root cause](#root-cause)).
`peer_present` — the condition `MULTIPLE_FACES` actually exists to catch —
is the best-performing multi-face condition (F1 0.919), which is
encouraging for the anomaly type's core purpose.

## Root cause

Inspecting raw per-detection output (not just bucket counts) on misclassified
`glasses`-condition frames shows a consistent pattern: a correct, high-score
detection of the real face, plus a second, non-overlapping, lower-score
detection elsewhere in the frame. Example (`oep_subject12_00714s.jpg`,
ground truth 1 face, predicted 2):

```json
[
  { "box": { "originX": 298, "originY": 200, "width": 140, "height": 140 }, "score": 0.898 },
  { "box": { "originX": 406, "originY": 0,   "width": 245, "height": 245 }, "score": 0.523 }
]
```

Two non-overlapping boxes with clearly different scores rules out a
duplicate-detection/missing-NMS artifact (those would overlap heavily with
similar scores) — this is the model genuinely finding a second,
lower-confidence face-like region. Since the previous detector exposed no
score at all, there was no way to tell "confident face" from "barely-over-
threshold guess" short of a hard reject/accept; this detector's real
confidence field means that distinction is now usable — see the sweep below.

## Threshold sweep

Explored whether raising `minDetectionConfidence` above the production
default (0.5) filters out these low-confidence phantom detections without
sacrificing too much recall. Captured every frame's raw detections once at
threshold 0.1, then re-bucketed each frame at higher cutoffs in Node
(equivalent to running the model natively at each cutoff, modulo NMS
interacting slightly differently at very different thresholds — good enough
for a tuning recommendation, not used for the headline numbers above).

| cutoff | accuracy | NO_FACE P/R/F1 | MULTIPLE_FACES P/R/F1 |
| --- | --- | --- | --- |
| 0.1 | 11.4% | n/a / 0.000 / n/a | 0.097 / 1.000 / 0.176 |
| 0.3 | 46.9% | 0.000 / 0.000 / n/a | 0.167 / 1.000 / 0.286 |
| **0.5 (production)** | **59.2%** | **0.093 / 1.000 / 0.170** | **0.279 / 0.850 / 0.420** |
| 0.6 | 69.2% | 0.073 / 1.000 / 0.136 | 0.632 / 0.600 / 0.615 |
| 0.7 | 68.2% | 0.063 / 1.000 / 0.118 | 0.923 / 0.600 / 0.727 |
| 0.8 | 55.5% | 0.043 / 1.000 / 0.082 | 1.000 / 0.500 / 0.667 |
| 0.9 | 34.6% | 0.029 / 1.000 / 0.056 | 1.000 / 0.450 / 0.621 |

Raising the threshold genuinely fixes `MULTIPLE_FACES` precision (0.279 →
0.923 at cutoff 0.7) by filtering out the phantom low-confidence second
detections. It does **not** fix `NO_FACE` — precision stays in the
0.03–0.09 range across the entire sweep, because a higher threshold only
ever *removes* detections, which can only make a real face more likely to
drop below threshold and read as "no face," never less. There is no cutoff
in this sweep where both anomaly types are simultaneously reliable.

Raw sweep data: [`threshold-sweep.json`](./threshold-sweep.json)
(`npm run sweep` to regenerate).

## Recommendations

1. **Do not use `NO_FACE` as a single-frame automatic trigger, at any
   threshold.** Precision never exceeds 0.093 across the full 0.1–0.9 sweep.
   Require N-of-M consecutive frames (e.g. 3 consecutive positive
   detections, already sampled roughly every ~1s per
   `floating-video.tsx`'s throttle) before treating it as a real anomaly.
2. **Consider raising `minDetectionConfidence` from 0.5 to ~0.7 for
   `MULTIPLE_FACES` specifically** — precision goes from 0.279 to 0.923 with
   recall dropping from 0.850 to 0.600. Worth it if `MULTIPLE_FACES` is used
   for logging/review rather than an automatic pause; combine with an N-of-M
   confirmation window if it drives an automatic action, since recall drops
   meaningfully at that cutoff.
3. **A single well-detected `MULTIPLE_FACES` frame is still decent evidence
   for logging** at the production threshold (precision 0.279 is far from
   great, but `peer_present` — the condition this anomaly exists to catch —
   scores much better in isolation, F1 0.919), just not for an automatic
   pause/rewind action.
4. **`glasses` and `occlusion` conditions need dedicated attention** if this
   detector stays in production — they're the two largest failure
   categories (50 and 15+19 frames respectively) and neither is fixed by
   threshold tuning alone.
5. **If evaluating a different detector/runtime, re-run the full eval** —
   `npm run eval` against `labels.csv` for a like-for-like comparison; don't
   assume accuracy transfers across detector implementations (this report
   is itself an example: the same dataset produces very different failure
   modes on the old vs. new detector).

## Limitations

- Small `NO_FACE` and `MULTIPLE_FACES` ground-truth counts (4 and 20 frames
  respectively, vs. 187 `OK`) — wide confidence intervals on those two
  metrics specifically; the qualitative conclusion (both need multi-frame
  confirmation) is unlikely to flip with more data, but the exact precision
  values could move.
- `glasses` (50 frames) and `normal` (43 frames) dominate the `OK` class;
  other conditions have 15–20 frames each.
- The threshold sweep is a post-hoc re-bucketing of a single low-threshold
  capture pass, not independent native runs at each cutoff — see
  [Threshold sweep](#threshold-sweep) for why that's an accepted
  approximation for a tuning recommendation, not for the headline numbers.
- CPU/WASM delegate only, matching production's E2E-testing fallback path;
  GPU delegate (used in real browsers when available) was not evaluated
  separately and could plausibly produce different numeric results from the
  same model weights.

## Acknowledgements

Dataset construction (`labels.csv`, the Kaggle OEP extraction pipeline, mask
and synthetic-lighting frame generation) and the original evaluation
harness this was adapted from are the work of
[@tanvishdesai](https://github.com/tanvishdesai) on this same issue. This
report re-runs that dataset against the detector now in production here
(`@mediapipe/tasks-vision` in place of `@tensorflow-models/face-detection`)
via a new Playwright-based harness, since the original Node+WASM harness
was built for a detector that no longer matches what ships.
