// Builds the "lighting" condition from real OEP frames instead of an
// external dataset. OEP's webcam corpus has consistent auto-exposure and
// contains no genuine poor-lighting frames (confirmed by a Laplacian-
// variance/luminance scan over the full unreviewed candidate pool -- see
// REPORT.md). A real external low-light dataset (DARK FACE, CVPR 2019) was
// evaluated and rejected: it's outdoor nighttime crowd/surveillance photos
// (~8.4 faces/image, license unlisted), a worse match to "webcam under poor
// lighting" than a synthetically degraded real webcam frame is.
//
// So: take real, previously-unused single-face OEP frames and apply a
// controlled exposure transform (heavy underexposure or overexposure). The
// face is genuinely there -- ground truth is still 1 -- only the lighting is
// synthetic. Clearly labeled as such in source_dataset/condition so it's
// never confused with a naturally-occurring case.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { readCsv, writeCsv } from "../lib/csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATE_FRAMES_DIR = path.join(__dirname, "results", "frames");
const DEST_FRAMES_DIR = path.join(__dirname, "..", "frames");
const LABELS_CSV = path.join(__dirname, "..", "labels.csv");
const PER_SUBJECT = 2; // dark + bright per subject, across all 13 sampled subjects = 26 candidates, trimmed to 20

const SOURCE_DATASET =
  "MSU_OEP (Atoum et al., IEEE TMM 2017) + synthetic exposure adjustment";
const LICENSE = "research-use (Kaggle: raajanwankhade/oep-dataset)";
const TARGET_COUNT = 20;

function darken(data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i] * 0.2;
    out[i + 1] = data[i + 1] * 0.2;
    out[i + 2] = data[i + 2] * 0.2;
    out[i + 3] = 255;
  }
  return out;
}

function overexpose(data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = Math.min(255, data[i] * 1.9 + 60);
    out[i + 1] = Math.min(255, data[i + 1] * 1.9 + 60);
    out[i + 2] = Math.min(255, data[i + 2] * 1.9 + 60);
    out[i + 3] = 255;
  }
  return out;
}

const labeled = new Set(readCsv(LABELS_CSV).map((r) => r.frame_id));
const manifest = readCsv(path.join(__dirname, "results", "candidate_manifest.csv"));
const bySubject = new Map();
for (const row of manifest) {
  if (row.detector_predicted_count !== "1" || labeled.has(row.frame_id)) continue;
  if (!fs.existsSync(path.join(CANDIDATE_FRAMES_DIR, row.frame_id))) continue;
  if (!bySubject.has(row.subject)) bySubject.set(row.subject, []);
  bySubject.get(row.subject).push(row.frame_id);
}

const picks = [];
for (const [, frames] of bySubject) {
  frames.sort();
  for (let i = 0; i < PER_SUBJECT && i < frames.length; i++) picks.push(frames[i]);
  if (picks.length >= TARGET_COUNT + 6) break;
}
picks.length = Math.min(picks.length, TARGET_COUNT);

fs.mkdirSync(DEST_FRAMES_DIR, { recursive: true });
const rows = [];
picks.forEach((frameId, i) => {
  const raw = jpeg.decode(fs.readFileSync(path.join(CANDIDATE_FRAMES_DIR, frameId)), {
    useTArray: true,
  });
  const transform = i % 2 === 0 ? darken : overexpose;
  const label = i % 2 === 0 ? "dark" : "bright";
  const transformed = transform(raw.data);
  const encoded = jpeg.encode(
    { data: transformed, width: raw.width, height: raw.height },
    85,
  );
  const outId = `synthlight_${label}_${String(i).padStart(3, "0")}.jpg`;
  fs.writeFileSync(path.join(DEST_FRAMES_DIR, outId), encoded.data);
  rows.push({
    frame_id: outId,
    ground_truth_face_count: 1,
    condition_tags: "lighting",
    source_dataset: SOURCE_DATASET,
    source_image: frameId,
    license: LICENSE,
  });
});

const newIds = new Set(rows.map((r) => r.frame_id));
const existing = readCsv(LABELS_CSV).filter((r) => !newIds.has(r.frame_id));
const merged = [...existing, ...rows];
writeCsv(
  LABELS_CSV,
  ["frame_id", "ground_truth_face_count", "condition_tags", "source_dataset", "source_image", "license"],
  merged,
);

console.log(`Wrote ${rows.length} synthetic lighting frames from ${bySubject.size} subjects, appended to labels.csv`);
console.log(`labels.csv now has ${merged.length} total rows`);
