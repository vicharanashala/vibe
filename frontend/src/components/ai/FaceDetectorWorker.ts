/* eslint-disable no-restricted-globals */

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let detector: FaceDetector | null = null;
const isTesting = import.meta.env.VITE_E2E_TESTING === 'true';

console.log("✅ Face Detection Worker started");

// Global error handler
self.onerror = (err) => {
  console.error("❌ Worker error:", err);
};

async function initializeModel() {
  try {
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

    // Same "try GPU, fall back to CPU" shape as the previous WebGL/CPU
    // backend selection, since GPU delegate needs a WebGL context that can
    // fail in the same environments the old code guarded against (e.g. E2E
    // testing, headless browsers).
    const delegate: "CPU" | "GPU" = isTesting ? "CPU" : "GPU";

    async function createDetector(useDelegate: "CPU" | "GPU") {
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
          delegate: useDelegate,
        },
        runningMode: "IMAGE",
        // #1222: this is the actual model confidence, unlike
        // @tensorflow-models/face-detection's MediaPipeFaceDetector (either
        // runtime), whose Face output has no score field at all.
        minDetectionConfidence: 0.5,
      });
    }

    try {
      detector = await createDetector(delegate);
      console.log(`🎯 Active delegate: ${delegate}`);
    } catch (err) {
      if (delegate === "GPU") {
        console.warn("⚠️ GPU delegate failed, falling back to CPU:", err);
        detector = await createDetector("CPU");
        console.log("🐢 Active delegate: CPU (fallback)");
      } else {
        throw err;
      }
    }

    self.postMessage({ type: "MODEL_READY", backend: detector ? "mediapipe-tasks-vision" : "unknown" });
    console.log("✅ Face detector ready");
  } catch (err) {
    console.error("❌ Model init failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Model initialization failed: ${String(err)}`,
    });
  }
}

async function detectFaces(imageBitmap: ImageBitmap) {
  if (!detector) {
    self.postMessage({ type: "ERROR", message: "Model not initialized" });
    return;
  }

  try {
    const result = detector.detect(imageBitmap);

    // Reshape to the same { box, keypoints } shape the rest of the app
    // already expects from @tensorflow-models/face-detection, plus the new
    // `score` field (#1222) - a real per-face confidence this time.
    //
    // Two real format differences verified empirically (a standalone test
    // page detecting a real captured frame), not assumed from docs alone:
    // 1. `boundingBox` is pixel coordinates (matches the old library), but
    //    `keypoints[].{x,y}` are normalized 0-1 - converted to pixels below
    //    so keypoint consumers (e.g. FaceDetectors.tsx's isLookingAway,
    //    currently unused but fully implemented and reads keypoints by
    //    name) keep working in a single consistent coordinate space.
    // 2. `keypoints[].label` comes back empty for this model - BlazeFace's
    //    6 keypoints are always returned in this fixed order regardless of
    //    wrapper (same order the old @tensorflow-models/face-detection
    //    library used), so they're named positionally instead.
    const KEYPOINT_NAMES = [
      "rightEye",
      "leftEye",
      "noseTip",
      "mouthCenter",
      "rightEarTragion",
      "leftEarTragion",
    ];

    const faces = result.detections.map((detection) => ({
      box: detection.boundingBox
        ? {
            xMin: detection.boundingBox.originX,
            yMin: detection.boundingBox.originY,
            width: detection.boundingBox.width,
            height: detection.boundingBox.height,
            xMax: detection.boundingBox.originX + detection.boundingBox.width,
            yMax: detection.boundingBox.originY + detection.boundingBox.height,
          }
        : undefined,
      keypoints: detection.keypoints.map((kp, i) => ({
        x: kp.x * imageBitmap.width,
        y: kp.y * imageBitmap.height,
        name: KEYPOINT_NAMES[i],
      })),
      score: detection.categories[0]?.score,
    }));

    self.postMessage({
      type: "DETECTION_RESULT",
      faces,
    });
  } catch (err) {
    console.error("❌ Face detection failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Detection failed: ${String(err)}`,
    });
  }
}

self.onmessage = async (event) => {
  const { type, image } = event.data;

  if (type === "INIT") {
    await initializeModel();
  }

  if (type === "DETECT_FACES" && image) {
    await detectFaces(image);
  }
};
