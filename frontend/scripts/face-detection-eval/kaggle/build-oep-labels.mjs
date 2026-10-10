// Merges the manually-reviewed OEP (MSU Online Exam Proctoring) frames into
// the main eval dataset. Ground truth below was assigned by hand after
// reviewing every 0-face and 2+-face candidate contact sheet (and a spread of
// the 1-face pool) produced by phase1_extract_candidates.ipynb — see
// kaggle/README.md. detector_predicted_count from that review pass is NOT
// used as ground truth (that would be circular); it only decided which
// frames were worth a human look.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCsv, readCsv } from "../lib/csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FRAMES = path.join(__dirname, "results", "frames");
const DEST_FRAMES = path.join(__dirname, "..", "frames");
const LABELS_CSV = path.join(__dirname, "..", "labels.csv");

const SOURCE_DATASET = "MSU_OEP (Atoum et al., IEEE TMM 2017)";
const LICENSE = "research-use (Kaggle: raajanwankhade/oep-dataset)";

function frames(prefix, timestamps) {
  return timestamps.map((t) => `oep_${prefix}_${String(t).padStart(5, "0")}s.jpg`);
}

const rows = [];

function add(frameIds, ground_truth_face_count, condition_tags) {
  for (const frame_id of frameIds) {
    rows.push({ frame_id, ground_truth_face_count, condition_tags, source_dataset: SOURCE_DATASET, source_image: frame_id.replace(/^oep_/, "").replace(/\.jpg$/, ""), license: LICENSE });
  }
}

// --- Category A: genuine 0 faces (person absent from desk) ---
add(frames("subject9", [443, 448, 451]), 0, "absent");
add(["oep_subject13_00605s.jpg"], 0, "absent");

// --- Category B: 1 face present but detector found nothing (occlusion / extreme angle) ---
add(frames("subject10", [54, 64, 76, 89, 99, 104, 146]), 1, "occlusion;angle"); // cap pulled low + chin-down
add(frames("subject11", [34, 99, 203, 312, 401, 513, 570, 657]), 1, "angle"); // extreme downward head pose, no cap
add(frames("subject12", [166, 188, 195, 213, 215, 305]), 1, "occlusion;angle"); // cap + headset + chin-down
add(frames("subject13", [188, 307, 317, 347, 518, 840]), 1, "occlusion"); // hand over mouth/chin
add(frames("subject15", [798, 843]), 1, "occlusion"); // hair over face
add(frames("subject18", [461, 766, 771, 808]), 1, "occlusion"); // hair over face
add(frames("subject19", [317, 404, 409, 429, 481, 734]), 1, "occlusion;angle"); // hair + downward angle

// --- Category C: genuine 2 faces (proctor/second person actually in frame) ---
add(frames("subject11", [0, 2, 4]), 2, "peer_present"); // session setup
add(frames("subject12", [0, 2, 4]), 2, "peer_present"); // session setup
add(frames("subject12", [734]), 2, "peer_present"); // second person walks through background
add(frames("subject15", [0, 4, 7]), 2, "peer_present"); // session setup
add(["oep_subject15_00002s.jpg"], 2, "peer_present"); // setup; detector over-counted this one as 3
add(frames("subject15", [855]), 2, "peer_present"); // proctor returns near end
add(frames("subject18", [166]), 2, "peer_present"); // second person's face clearly visible in background, detector said 1 (false negative)
add(frames("subject19", [208, 243, 292, 312, 352]), 2, "peer_present"); // proctor present mid-session

// --- Category D: 1 real face, single real face confirmed by manual review.
// Tagged "glasses" rather than "normal": every subject in this bucket wears glasses.
// The Python MediaPipe pass used on Kaggle to find candidates persistently
// double-counted these as 2 faces (subject15 alone: 222/~360 sampled frames) --
// that's *why* they were flagged for review in the first place. The production
// TFJS/WASM pipeline this repo actually evaluates (run-eval.mjs) does NOT
// reproduce that failure on these same frames; it instead misses ~30% of them
// entirely (NO_FACE). Two different runtimes of "the same" model, two
// different failure modes on the same input -- see REPORT.md. ---
add(frames("subject12", [252, 714, 788, 892]), 1, "glasses");
add(frames("subject13", [7, 213, 391, 468, 582, 689, 758, 825]), 1, "glasses");
add(frames("subject14", [14, 47, 121, 220, 337, 461, 491]), 1, "glasses");
add(frames("subject15", [101, 190, 312, 441, 548, 644]), 1, "glasses");
add(frames("subject16", [24, 104, 193, 312, 411, 508, 592, 716]), 1, "glasses");
add(frames("subject19", [34, 54, 86, 153, 362, 411, 486, 540, 627, 704]), 1, "glasses");
add(frames("subject20", [47, 121, 195, 372, 545, 674, 798]), 1, "glasses");

// --- Category E: correctly detected, single face, normal conditions ---
add(frames("subject10", [7, 131, 225, 307, 421, 580, 662, 744, 823]), 1, "normal");
add(frames("subject12", [12, 71, 205, 334, 453, 572, 691, 818]), 1, "normal");
add(frames("subject18", [0, 37, 101, 280, 339, 466, 587, 716, 793, 825]), 1, "normal");
add(frames("subject5", [2, 81, 240, 319, 399, 478, 637, 796]), 1, "angle"); // camera mounted off to the side
add(frames("subject20", [2, 267, 396, 473, 570, 624, 756, 890]), 1, "normal");

// --- Category F: subject1 ("acting" group; deprioritized vs. the 9 "real
// exam" subjects per the notebook's stated priority, so never reviewed in
// the original pass -- reviewed here via contact sheets 034/035/066-069).
// Single male subject, glasses. Clean single-face stretches throughout,
// several hand-over-mouth/chin moments, downward reading-angle moments, and
// one genuine peer-present event (~148-156s: a second person in a striped
// sweater, facial features clearly visible, not a glasses double-count
// artifact -- two visually distinct people in frame). ---
add(frames("subject1", [4, 34, 64, 124, 193, 223, 262, 758]), 1, "normal");
add(frames("subject1", [461, 471, 510, 520]), 1, "angle");
add(frames("subject1", [431, 441, 610]), 1, "occlusion"); // hand over mouth/chin
add(frames("subject1", [148, 156]), 2, "peer_present"); // second person (striped sweater) in background

// --- copy frames + append to labels.csv ---
fs.mkdirSync(DEST_FRAMES, { recursive: true });
let copied = 0;
let missing = [];
for (const row of rows) {
  const src = path.join(RESULTS_FRAMES, row.frame_id);
  if (!fs.existsSync(src)) {
    missing.push(row.frame_id);
    continue;
  }
  fs.copyFileSync(src, path.join(DEST_FRAMES, row.frame_id));
  copied++;
}

if (missing.length) {
  console.warn(`WARNING: ${missing.length} frame(s) not found in results/frames/:`);
  missing.forEach((m) => console.warn(`  ${m}`));
}

// `rows` is the full, authoritative OEP label set on every run (not just new
// additions), so re-running this script must replace any prior OEP rows in
// labels.csv rather than append alongside them -- otherwise every re-run
// duplicates the previous OEP rows.
const included = rows.filter((r) => !missing.includes(r.frame_id));
const newIds = new Set(included.map((r) => r.frame_id));
const existing = readCsv(LABELS_CSV).filter((r) => !newIds.has(r.frame_id));
const merged = [...existing, ...included];
writeCsv(LABELS_CSV, ["frame_id", "ground_truth_face_count", "condition_tags", "source_dataset", "source_image", "license"], merged);

console.log(`Copied ${copied} OEP frames, appended to labels.csv`);
console.log(`labels.csv now has ${merged.length} total rows`);

const byCount = {};
const byTag = {};
for (const r of rows) {
  byCount[r.ground_truth_face_count] = (byCount[r.ground_truth_face_count] || 0) + 1;
  byTag[r.condition_tags] = (byTag[r.condition_tags] || 0) + 1;
}
console.log("OEP additions by ground truth count:", byCount);
console.log("OEP additions by condition:", byTag);
