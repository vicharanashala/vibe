import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as faceDetection from "@tensorflow-models/face-detection";

// Self-contained worker script
let detector: faceDetection.FaceDetector | null = null;

async function initializeModel() {
  await tf.setBackend("webgl"); 
  await tf.ready();
  const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
  const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = { runtime: "tfjs", maxFaces: 10 }; // TensorFlow.js backend
  detector = await faceDetection.createDetector(model, detectorConfig);
  self.postMessage({ type: "MODEL_READY" });
}

// Detect faces in received ImageBitmap
async function detectFaces(imageBitmap: ImageBitmap) {
  if (!detector) {
    self.postMessage({ type: "ERROR", message: "Model not initialized" });
    return;
  }

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    self.postMessage({ type: "ERROR", message: "Canvas context unavailable" });
    return;
  }

  ctx.drawImage(imageBitmap, 0, 0);
  const faces: faceDetection.Face[] = await detector.estimateFaces(canvas as unknown as HTMLCanvasElement);

  self.postMessage({ type: "DETECTION_RESULT", faces });
}

// Handle messages from the main thread
self.onmessage = async (event) => {
  if (event.data.type === "INIT") {
    await initializeModel();
  } else if (event.data.type === "DETECT_FACES" && event.data.image) {
    await detectFaces(event.data.image);
  }
};
