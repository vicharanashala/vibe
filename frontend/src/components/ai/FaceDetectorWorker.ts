/* eslint-disable no-restricted-globals */

import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs";
import * as faceDetection from "@tensorflow-models/face-detection";

let detector: faceDetection.FaceDetector | null = null;
const isTesting = import.meta.env.VITE_E2E_TESTING === 'true';


console.log("✅ Face Detection Worker started");

// Global error handler
self.onerror = (err) => {
  console.error("❌ Worker error:", err);
};

async function initializeModel() {
  try {
    await tf.ready();

    let backendSet = false;

    // If testing, directly use CPU
    if (isTesting) {
      await tf.setBackend("cpu");
      backendSet = true;
      console.log("🧪 Testing mode → CPU backend");
    } else {
      // Try WebGL first
      try {
        const ok = await tf.setBackend("webgl");
        if (ok) {
          backendSet = true;
          console.log("⚡ WebGL backend enabled");
        }
      } catch (err) {
        console.warn("⚠️ WebGL failed, falling back to CPU:", err);
      }

      // Fallback to CPU if WebGL not available
      if (!backendSet) {
        const ok = await tf.setBackend("cpu");
        if (!ok) {
          throw new Error("Neither WebGL nor CPU backend is supported");
        }
        console.log("🐢 CPU backend enabled (fallback)");
      }
    }

    await tf.ready();

    const activeBackend = tf.getBackend();
    console.log(`🎯 Active backend: ${activeBackend}`);

    // Create detector
    detector = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: "tfjs",
        maxFaces: 10,
        modelType: "full",
      }
    );

    self.postMessage({ type: "MODEL_READY", backend: activeBackend });
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

  const canvas = new OffscreenCanvas(
    imageBitmap.width,
    imageBitmap.height
  );
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    self.postMessage({ type: "ERROR", message: "Canvas context unavailable" });
    return;
  }

  ctx.drawImage(imageBitmap, 0, 0);

  try {
    const faces = await detector.estimateFaces(
      canvas as unknown as HTMLCanvasElement
    );

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
