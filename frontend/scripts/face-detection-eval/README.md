# Face-Count Detection Accuracy Eval

Offline accuracy evaluation for the proctoring face-count detector
(`frontend/src/components/ai/FaceDetectorWorker.ts`). See
[REPORT.md](./REPORT.md) for results and the acceptance decision.

Not part of the app build — a standalone tool with its own `package.json`,
run manually.

The dataset (`frames/`, `labels.csv`, 211 frames) is real exam-webcam
footage plus two small non-webcam edge-case sources the primary source
(OEP) structurally can't supply: 171 frames hand-labeled from the MSU
Online Exam Proctoring dataset (via the Kaggle pipeline in
[kaggle/](./kaggle/README.md)) — the actual use case — 20 external
mask-condition frames, and 20 real OEP frames with a synthetic exposure
transform applied for the `lighting` condition. Full provenance in
REPORT.md's Methodology section. Dataset and Kaggle pipeline originally
built by [@tanvishdesai](https://github.com/tanvishdesai) on the same
issue — see REPORT.md's Acknowledgements.

## Layout

```
labels.csv                    frame_id, ground_truth_face_count, condition_tags, ...
frames/                       the 211 labeled test frames (171 OEP webcam + 20 mask + 20 synthetic lighting)
run-eval.mjs                  runs the production model config against labels.csv, in a real headless browser
threshold-sweep.mjs           supplementary: precision/recall vs. minDetectionConfidence cutoff
lib/                          shared helpers (CSV I/O, metrics, the local static server)
results.json                  eval output (metrics + per-frame predictions + per-face scores)
threshold-sweep.json          sweep output
REPORT.md                     write-up: methodology, results, decision

build-dataset-mask.mjs        regenerates the mask-condition frames (fetches from HF directly, no download needed)
mask-selection.json           provenance: exact source image per mask frame
kaggle/                       OEP dataset: extraction notebook + human-reviewed labels, see kaggle/README.md
                               (also kaggle/build-synthetic-lighting.mjs, the lighting-condition generator)
```

`frames/` and `labels.csv` are committed — you don't need to regenerate
anything to re-run the eval.

## Re-run the eval

```
cd frontend/scripts/face-detection-eval
npm install
npm run eval        # or: node run-eval.mjs
npm run sweep        # optional: threshold sensitivity analysis
```

Takes under a minute on CPU. Writes `results.json` (and `qc-review/`, frames
sorted by predicted bucket for manual eyeballing) and prints a summary
table.

## Why a headless browser instead of Node

`@mediapipe/tasks-vision`'s `FaceDetector.detect()` only accepts a
`TexImageSource` (`ImageBitmap`/`ImageData`/`HTMLImageElement`/...), none of
which exist natively in Node. Rather than approximate that with a
canvas/jsdom polyfill of unknown fidelity to real browser behavior,
`run-eval.mjs` starts a tiny local static server (`lib/server.mjs`) that
serves the app's actual self-hosted assets
(`frontend/public/mediapipe/wasm`, `frontend/public/mediapipe/models/...`)
and the installed `@mediapipe/tasks-vision` bundle, then drives real
headless Chromium (Playwright) against it — calling the *identical*
`FilesetResolver`/`FaceDetector` APIs, against the *identical* asset URLs,
that `FaceDetectorWorker.ts` calls in production. Zero polyfill gap.

(The eval harness this was adapted from used a pure Node + WASM pipeline,
since the detector in production at the time — `@tensorflow-models/face-
detection` — could run directly in Node without any DOM APIs. That stopped
being an option once the detector was swapped for real per-face confidence,
see #1222 and REPORT.md.)

## Regenerate the dataset from scratch

Only needed if you want to change the frame selection — not needed to just
re-run the eval.

- **Mask frames**: `node build-dataset-mask.mjs` — fetches directly from a
  public HuggingFace dataset, no download needed. Writes `mask-selection.json`
  and the `mask_*.jpg` frames, but does not merge into `labels.csv` itself
  (append manually, or follow the pattern in `kaggle/build-oep-labels.mjs`).
- **OEP frames**: see [kaggle/README.md](./kaggle/README.md) — requires
  re-running the Kaggle notebook (phone-verification-gated Kernels API, so
  it's a manual web-UI run, not `kaggle kernels push`) or, if the raw
  candidate frame dump (`kaggle/results/frames/`) is already available
  locally, re-running `node kaggle/build-oep-labels.mjs` directly against it.
- **Synthetic lighting frames**: `node kaggle/build-synthetic-lighting.mjs`
  (needs the `jpeg-js` package and `kaggle/results/frames/` locally, the
  same raw candidate dump as above). Picks previously-unused single-face
  candidates and writes underexposed/overexposed versions straight into
  `../frames/`, merging into `labels.csv` the same dedup-safe way
  `build-oep-labels.mjs` does.
