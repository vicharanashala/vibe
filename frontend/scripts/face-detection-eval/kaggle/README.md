# Kaggle-based dataset build (the eval's dataset)

Why: an earlier pass of this eval also used WIDER FACE, general event
photography, not webcam footage of someone seated at a laptop — the actual
proctoring use case. WIDER FACE has since been dropped entirely (see
`../REPORT.md`); this is now the only dataset the eval runs against, aside
from the small external `mask` slice (`../build-dataset-mask.mjs`, not WIDER
and not OEP — see `../README.md`). It's the
**MSU Online Exam Proctoring (OEP) dataset**
([Kaggle](https://www.kaggle.com/datasets/raajanwankhade/oep-dataset),
Atoum et al., IEEE TMM 2017): real students and actors taking an exam on
camera, webcam mounted above the monitor, ~11.8GB of video across 24 subjects.
Too large to download wholesale and process locally, so this runs as a Kaggle
notebook against the dataset mounted directly in Kaggle's environment —
nothing large gets downloaded to a local machine.

The Kaggle account used here (`tanvishdesai`) has Dataset API access but not
Kernel API access (Kaggle gates the Kernels API behind phone verification),
so these notebooks are **pushed and run manually** through the Kaggle web UI
rather than via `kaggle kernels push`.

## Status: done (171 frames, 13/13 sampled subjects reviewed). Results are in `../REPORT.md`

Ground truth (how many faces are *actually* in a frame) can't come from the
detector we're testing — scoring a model against labels it produced itself is
circular. It also can't come from the OEP `gt.txt` files: those label
*cheating-behavior types* (gaze, text, phone, etc. — confirmed by decoding a
sample video locally), not face count. So this ran as two steps:

1. **`phase1_extract_candidates.ipynb`** (run manually on Kaggle, output in
   `results/`): mounted the OEP dataset directly in Kaggle's environment,
   decoded 13 subjects' webcam videos, sampled a frame every 2.5s, and ran a
   quick Python MediaPipe pass **only** to flag candidate rare frames
   (0-face / 2+-face) worth a human look — `detector_predicted_count` in
   `results/candidate_manifest.csv` was never used as a label, only to pick
   which of ~1955 candidates were worth reviewing. Output: 79 contact-sheet
   grids (`results/contact_sheets/`).
2. **Human review** (`build-oep-labels.mjs`): every 0-face and 2+-face
   candidate sheet was reviewed by hand, plus a spread of the 1-face pool,
   and each frame's actual face count was recorded from what's visible in
   the image (a person's back/shoulder at the frame edge doesn't count as a
   "face" — only clearly visible facial features do). Selection rationale
   for every included frame is a code comment in that script. All 13 sampled
   subjects are now reviewed (`subject1` was initially skipped in favor of
   the 9 "real exam" subjects, then added in a second pass).

`build-oep-labels.mjs`'s `rows` array is the full, authoritative OEP label
set on every run, not an incremental diff — re-running it replaces any prior
OEP rows in `../labels.csv` by `frame_id` rather than duplicating them.

`build-synthetic-lighting.mjs` (same directory) draws on this same raw
candidate pool to generate the eval's `lighting` condition: real OEP faces
that OEP itself has no genuine poor-lighting examples of (see `../REPORT.md`
Methodology/Limitations for why a real photo/webcam frame with a controlled
exposure transform was chosen over an external low-light dataset). It's not
part of the "real, human-labeled ground truth ambiguity" review process above
— the ground truth (1 face) is inherited unchanged from the source frame,
only pixel values are transformed.

Since the reviewed frames are small (171 JPEGs, not the 11.8GB source), the
eval itself runs locally via `../run-eval.mjs` against the merged
`../labels.csv` — no need for a separate Kaggle eval notebook once the
frames themselves are local. The selected frames now live in `../frames/`
(prefixed `oep_`); `results/` here normally only keeps the small provenance
CSVs (`candidate_manifest.csv` — every candidate the notebook flagged and
what it predicted; `sheet_manifest.csv` — which contact sheet/position each
candidate appeared at), since the raw candidate frame dump and contact-sheet
images (94MB, ~1955 mostly-unused images, `results/frames/` and
`results/contact_sheets/`) aren't worth committing once review is done — if
you've restored them locally for further review, they're gitignored-by-
convention (not committed); delete them again once you're done to avoid an
accidental large commit.

To regenerate from scratch: re-run phase 1 on Kaggle (steps below) into a
fresh `results/`, then `node build-oep-labels.mjs` (copies the selected
frames into `../frames/` and rebuilds `../labels.csv`'s OEP rows) and
`node ../run-eval.mjs`.

### Re-running phase 1

1. On kaggle.com: **New Notebook** → **File → Import Notebook** → upload
   `phase1_extract_candidates.ipynb`.
2. **Add Data** (right sidebar) → search `MSU Online Exam Proctoring Dataset`
   → add `raajanwankhade/oep-dataset`.
3. Settings → internet **on** (needed for `pip install mediapipe` if it isn't
   already in the base image).
4. **Run All**. Takes roughly 20–40 minutes (13 subjects, sampled every 2.5s,
   capped at 15 min/video) — CPU only, no GPU needed.
5. Download the **Output** tab's contents into `results/` here.
