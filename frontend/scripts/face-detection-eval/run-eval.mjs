// Offline accuracy evaluation for the proctoring face-count detector
// (issue #1222). Runs the *exact* model configuration used in production
// (frontend/src/components/ai/FaceDetectorWorker.ts: @mediapipe/tasks-vision
// FaceDetector, model blaze_face_short_range.tflite, runningMode "IMAGE",
// minDetectionConfidence 0.5) against every frame in labels.csv and computes
// precision/recall/F1 + a confusion matrix, overall and broken down by
// condition tag.
//
// The frontend maps raw face count to proctoring anomalies as:
//   0 faces  -> NO_FACE
//   1 face   -> OK (no anomaly)
//   2+ faces -> MULTIPLE_FACES
// (see frontend/src/components/floating-video.tsx handleImageAnomaly). This
// script reproduces that same bucketing so the metrics mean the same thing
// the production anomaly flags mean.
//
// Why a real headless browser instead of a Node + polyfill pipeline: unlike
// the previous detector (a pure-WASM tfjs backend, runnable directly in
// Node - see git history), @mediapipe/tasks-vision's FaceDetector.detect()
// only accepts a TexImageSource (ImageBitmap/ImageData/HTMLImageElement/...),
// none of which exist natively in Node. A canvas/jsdom polyfill would be an
// approximation of unknown fidelity to what actually runs in users'
// browsers. Driving real headless Chromium instead means this script calls
// the *identical* FilesetResolver/FaceDetector APIs, against the *identical*
// self-hosted asset paths (/mediapipe/wasm, /mediapipe/models/...), that
// FaceDetectorWorker.ts calls in production - zero polyfill gap.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { readCsv } from "./lib/csv.mjs";
import { startEvalServer } from "./lib/server.mjs";
import { bucketOf, computeBinaryMetrics, confusionMatrix, fmt } from "./lib/metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, "frames");
const QC_DIR = path.join(__dirname, "qc-review");
const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const MEDIAPIPE_ASSETS_DIR = path.join(FRONTEND_ROOT, "public", "mediapipe");
const TASKS_VISION_BUNDLE = path.join(
  FRONTEND_ROOT,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "vision_bundle.mjs",
);

const MIN_DETECTION_CONFIDENCE = 0.5;

// Runs inside the page. Loads the *exact* production detector config and
// classifies every frame; returns plain, structured-clone-safe data.
async function runDetectionInBrowser({ frameIds, minDetectionConfidence }) {
  const { FaceDetector, FilesetResolver } = await import("/tasks-vision/vision_bundle.mjs");
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
      delegate: "CPU", // no WebGL/GPU in headless mode - same fallback path production takes under VITE_E2E_TESTING
    },
    runningMode: "IMAGE",
    minDetectionConfidence,
  });

  const results = [];
  for (const frameId of frameIds) {
    try {
      const res = await fetch(`/frames/${encodeURIComponent(frameId)}`);
      if (!res.ok) {
        results.push({ frameId, error: `frame fetch failed: HTTP ${res.status}` });
        continue;
      }
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const detection = detector.detect(bitmap);
      results.push({
        frameId,
        predictedCount: detection.detections.length,
        scores: detection.detections.map((d) => d.categories[0]?.score ?? null),
      });
      bitmap.close();
    } catch (err) {
      results.push({ frameId, error: String(err) });
    }
    if (results.length % 40 === 0) {
      console.log(`  ${results.length}/${frameIds.length}`);
    }
  }
  return results;
}

async function main() {
  const labels = readCsv(path.join(__dirname, "labels.csv"));
  console.log(`Evaluating ${labels.length} frames...\n`);

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
    const detections = await page.evaluate(runDetectionInBrowser, {
      frameIds,
      minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
    });
    const byFrameId = new Map(detections.map((d) => [d.frameId, d]));

    const rows = [];
    for (const label of labels) {
      const framePath = path.join(FRAMES_DIR, label.frame_id);
      const detection = byFrameId.get(label.frame_id);
      if (!fs.existsSync(framePath)) {
        console.warn(`  missing frame, skipping: ${label.frame_id}`);
        continue;
      }
      if (!detection || detection.error !== undefined) {
        console.warn(`  detection failed on ${label.frame_id}: ${detection?.error ?? "no result"}`);
        continue;
      }
      const groundTruthCount = Number(label.ground_truth_face_count);
      const predictedBucket = bucketOf(detection.predictedCount);
      const groundTruthBucket = bucketOf(groundTruthCount);
      rows.push({
        frame_id: label.frame_id,
        condition_tags: label.condition_tags,
        groundTruthCount,
        groundTruthBucket,
        predictedCount: detection.predictedCount,
        predictedBucket,
        scores: detection.scores,
      });

      // Manual QC: sort each frame into a folder named after the model's
      // predicted bucket, with predicted+actual counts baked into the
      // filename, so mispredictions can be eyeballed without cross-referencing
      // labels.csv/results.json.
      const qcDir = path.join(QC_DIR, predictedBucket);
      fs.mkdirSync(qcDir, { recursive: true });
      const base = label.frame_id.replace(/\.jpg$/i, "");
      const qcName = `${base}__pred-${predictedBucket}(${detection.predictedCount})__actual-${groundTruthBucket}(${groundTruthCount}).jpg`;
      fs.copyFileSync(framePath, path.join(qcDir, qcName));
    }

    const overallAccuracy =
      rows.filter((r) => r.predictedBucket === r.groundTruthBucket).length / rows.length;

    const noFaceMetrics = computeBinaryMetrics(rows, "NO_FACE", "predictedBucket");
    const multiFaceMetrics = computeBinaryMetrics(rows, "MULTIPLE_FACES", "predictedBucket");
    const overallConfusion = confusionMatrix(rows, "predictedBucket");

    const conditionBreakdown = {};
    for (const tag of new Set(rows.map((r) => r.condition_tags))) {
      const subset = rows.filter((r) => r.condition_tags === tag);
      conditionBreakdown[tag] = {
        frameCount: subset.length,
        accuracy: subset.filter((r) => r.predictedBucket === r.groundTruthBucket).length / subset.length,
        noFace: computeBinaryMetrics(subset, "NO_FACE", "predictedBucket"),
        multipleFaces: computeBinaryMetrics(subset, "MULTIPLE_FACES", "predictedBucket"),
        confusion: confusionMatrix(subset, "predictedBucket"),
      };
    }

    const misclassified = rows
      .filter((r) => r.predictedBucket !== r.groundTruthBucket)
      .map((r) => ({
        frame_id: r.frame_id,
        condition_tags: r.condition_tags,
        groundTruth: `${r.groundTruthBucket} (${r.groundTruthCount})`,
        predicted: `${r.predictedBucket} (${r.predictedCount})`,
      }));

    const results = {
      modelConfig: {
        detector: "@mediapipe/tasks-vision FaceDetector",
        model: "blaze_face_short_range.tflite",
        runningMode: "IMAGE",
        minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
        delegate: "CPU",
      },
      frameCount: rows.length,
      overallAccuracy,
      overallConfusion,
      noFaceMetrics,
      multiFaceMetrics,
      conditionBreakdown,
      misclassified,
    };

    fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(results, null, 2));

    console.log("\n=== Overall ===");
    console.log(`Frames evaluated: ${rows.length}`);
    console.log(`Overall bucket accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    console.log(
      `NO_FACE        precision=${fmt(noFaceMetrics.precision)} recall=${fmt(noFaceMetrics.recall)} f1=${fmt(noFaceMetrics.f1)} (tp=${noFaceMetrics.tp} fp=${noFaceMetrics.fp} fn=${noFaceMetrics.fn})`,
    );
    console.log(
      `MULTIPLE_FACES precision=${fmt(multiFaceMetrics.precision)} recall=${fmt(multiFaceMetrics.recall)} f1=${fmt(multiFaceMetrics.f1)} (tp=${multiFaceMetrics.tp} fp=${multiFaceMetrics.fp} fn=${multiFaceMetrics.fn})`,
    );

    console.log("\n=== Confusion matrix (rows=ground truth, cols=predicted) ===");
    console.table(overallConfusion);

    console.log("\n=== By condition ===");
    for (const [tag, m] of Object.entries(conditionBreakdown)) {
      console.log(
        `${tag.padEnd(20)} n=${String(m.frameCount).padEnd(4)} acc=${(m.accuracy * 100).toFixed(1)}%  NO_FACE f1=${fmt(m.noFace.f1)}  MULTIPLE_FACES f1=${fmt(m.multipleFaces.f1)}`,
      );
    }

    console.log(`\nFull results written to results.json`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
