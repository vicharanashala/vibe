// Supplementary analysis for #1222's "recommendations for threshold tuning"
// acceptance criterion. Unlike the previous detector (no confidence score
// at all - see git history), @mediapipe/tasks-vision genuinely exposes a
// per-face score, so raising minDetectionConfidence is an actual lever now.
//
// Runs detection ONCE with a low model-internal threshold (0.1, so weak
// candidate boxes survive into the results) and then re-buckets each frame
// at a range of higher cutoffs by filtering its detections' scores in
// Node - the standard way to build a precision/recall-vs-threshold curve
// without re-running the model once per candidate cutoff. This is an
// approximation of running the model natively at each higher threshold
// (NMS could in principle behave slightly differently) - good enough to
// tell whether the failure mode in run-eval.mjs's results.json (spurious
// low-score second detections) is fixable by threshold alone. The headline
// numbers in REPORT.md/results.json come from run-eval.mjs's real,
// unapproximated run at the actual production threshold (0.5).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { readCsv } from "./lib/csv.mjs";
import { startEvalServer } from "./lib/server.mjs";
import { bucketOf, computeBinaryMetrics, fmt } from "./lib/metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, "frames");
const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const MEDIAPIPE_ASSETS_DIR = path.join(FRONTEND_ROOT, "public", "mediapipe");
const TASKS_VISION_BUNDLE = path.join(
  FRONTEND_ROOT,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "vision_bundle.mjs",
);

const CAPTURE_THRESHOLD = 0.1;
const CANDIDATE_CUTOFFS = [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9];

async function captureAllScoresInBrowser({ frameIds, minDetectionConfidence }) {
  const { FaceDetector, FilesetResolver } = await import("/tasks-vision/vision_bundle.mjs");
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    minDetectionConfidence,
  });

  const results = [];
  for (const frameId of frameIds) {
    try {
      const res = await fetch(`/frames/${encodeURIComponent(frameId)}`);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const detection = detector.detect(bitmap);
      results.push({
        frameId,
        scores: detection.detections.map((d) => d.categories[0]?.score ?? 0),
      });
      bitmap.close();
    } catch (err) {
      results.push({ frameId, error: String(err) });
    }
    if (results.length % 40 === 0) console.log(`  ${results.length}/${frameIds.length}`);
  }
  return results;
}

async function main() {
  const labels = readCsv(path.join(__dirname, "labels.csv"));
  console.log(`Capturing raw detections at threshold ${CAPTURE_THRESHOLD} for ${labels.length} frames...\n`);

  const server = await startEvalServer({
    framesDir: FRAMES_DIR,
    mediapipeAssetsDir: MEDIAPIPE_ASSETS_DIR,
    tasksVisionBundle: TASKS_VISION_BUNDLE,
  });
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "log") console.log(msg.text());
    });
    await page.goto(`http://127.0.0.1:${port}/`);

    const frameIds = labels.map((l) => l.frame_id);
    const captured = await page.evaluate(captureAllScoresInBrowser, {
      frameIds,
      minDetectionConfidence: CAPTURE_THRESHOLD,
    });
    const byFrameId = new Map(captured.map((c) => [c.frameId, c]));

    const sweep = {};
    for (const cutoff of CANDIDATE_CUTOFFS) {
      const rows = [];
      for (const label of labels) {
        const c = byFrameId.get(label.frame_id);
        if (!c || c.error) continue;
        const predictedCount = c.scores.filter((s) => s >= cutoff).length;
        rows.push({
          groundTruthBucket: bucketOf(Number(label.ground_truth_face_count)),
          predictedBucket: bucketOf(predictedCount),
        });
      }
      const overallAccuracy =
        rows.filter((r) => r.predictedBucket === r.groundTruthBucket).length / rows.length;
      sweep[cutoff] = {
        frameCount: rows.length,
        overallAccuracy,
        noFace: computeBinaryMetrics(rows, "NO_FACE", "predictedBucket"),
        multipleFaces: computeBinaryMetrics(rows, "MULTIPLE_FACES", "predictedBucket"),
      };
    }

    fs.writeFileSync(path.join(__dirname, "threshold-sweep.json"), JSON.stringify(sweep, null, 2));

    console.log("\n=== Threshold sweep (minDetectionConfidence cutoff) ===");
    console.log("cutoff  acc     NO_FACE(p/r/f1)              MULTIPLE_FACES(p/r/f1)");
    for (const cutoff of CANDIDATE_CUTOFFS) {
      const m = sweep[cutoff];
      console.log(
        `${String(cutoff).padEnd(7)} ${(m.overallAccuracy * 100).toFixed(1).padStart(5)}%  ` +
          `${fmt(m.noFace.precision)}/${fmt(m.noFace.recall)}/${fmt(m.noFace.f1)}` +
          `            ${fmt(m.multipleFaces.precision)}/${fmt(m.multipleFaces.recall)}/${fmt(m.multipleFaces.f1)}`,
      );
    }
    console.log("\n(production currently runs at 0.5 - see run-eval.mjs / results.json for the full breakdown at that cutoff)");
    console.log("\nFull sweep written to threshold-sweep.json");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
