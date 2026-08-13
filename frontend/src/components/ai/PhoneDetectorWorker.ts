/* eslint-disable no-restricted-globals */

import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

// COCO-SSD is a general-purpose object detector; we only care about the
// "cell phone" class for proctoring purposes.
const PHONE_CLASS = "cell phone";
const MIN_SCORE = 0.6;

let model: cocoSsd.ObjectDetection | null = null;
const isTesting = import.meta.env.VITE_E2E_TESTING === "true";

console.log("✅ Phone Detection Worker started");

self.onerror = (err) => {
  console.error("❌ Worker error:", err);
};

async function initializeModel() {
  try {
    await tf.ready();

    let backendSet = false;

    if (isTesting) {
      await tf.setBackend("cpu");
      backendSet = true;
      console.log("🧪 Testing mode → CPU backend");
    } else {
      try {
        const ok = await tf.setBackend("webgl");
        if (ok) {
          backendSet = true;
          console.log("⚡ WebGL backend enabled");
        }
      } catch (err) {
        console.warn("⚠️ WebGL failed, falling back to CPU:", err);
      }

      if (!backendSet) {
        const ok = await tf.setBackend("cpu");
        if (!ok) {
          throw new Error("Neither WebGL nor CPU backend is supported");
        }
        console.log("🐢 CPU backend enabled (fallback)");
      }
    }

    await tf.ready();

    // "lite_mobilenet_v2" keeps the model small/fast enough to run
    // continuously in a worker without competing with the other detectors.
    model = await cocoSsd.load({base: "lite_mobilenet_v2"});

    self.postMessage({type: "MODEL_READY", backend: tf.getBackend()});
    console.log("✅ Phone detector ready");
  } catch (err) {
    console.error("❌ Model init failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Model initialization failed: ${String(err)}`,
    });
  }
}

async function detectPhone(imageBitmap: ImageBitmap) {
  if (!model) {
    self.postMessage({type: "ERROR", message: "Model not initialized"});
    return;
  }

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    self.postMessage({type: "ERROR", message: "Canvas context unavailable"});
    return;
  }

  ctx.drawImage(imageBitmap, 0, 0);

  try {
    const predictions = await model.detect(
      canvas as unknown as HTMLCanvasElement,
    );

    const phone = predictions
      .filter(p => p.class === PHONE_CLASS && p.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)[0];

    self.postMessage({
      type: "DETECTION_RESULT",
      isPhoneDetected: !!phone,
      detection: phone
        ? {bbox: phone.bbox, score: phone.score}
        : null,
    });
  } catch (err) {
    console.error("❌ Phone detection failed:", err);
    self.postMessage({
      type: "ERROR",
      message: `Detection failed: ${String(err)}`,
    });
  }
}

self.onmessage = async (event) => {
  const {type, image} = event.data;

  if (type === "INIT") {
    await initializeModel();
  }

  if (type === "DETECT_PHONE" && image) {
    await detectPhone(image);
  }
};
