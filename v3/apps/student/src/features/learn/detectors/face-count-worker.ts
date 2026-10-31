/**
 * Face-count detection via TensorFlow.js's MediaPipeFaceDetector model (runtime
 * 'tfjs', weights fetched from TF Hub on first use - not bundled with the app).
 */
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';

let detector: faceDetection.FaceDetector | null = null;
// Without this, frames posted faster than inference completes queue up as
// overlapping estimateFaces() calls — results then arrive out of order and
// faceCount lags behind what's actually in frame (e.g. the camera being
// covered doesn't register as 0 faces until the backlog drains).
let isProcessing = false;

async function initializeModel() {
  try {
    await tf.ready();
    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();

    detector = await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector, {
      runtime: 'tfjs',
      maxFaces: 10,
      modelType: 'full',
    });
    self.postMessage({ type: 'MODEL_READY' });
  } catch (err) {
    self.postMessage({ type: 'ERROR', message: String(err) });
  }
}

async function detectFaces(imageBitmap: ImageBitmap) {
  if (!detector) {
    imageBitmap.close();
    self.postMessage({ type: 'ERROR', message: 'Model not initialized' });
    return;
  }
  isProcessing = true;
  try {
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      self.postMessage({ type: 'ERROR', message: 'Canvas context unavailable' });
      return;
    }
    ctx.drawImage(imageBitmap, 0, 0);
    const faces = await detector.estimateFaces(canvas as unknown as HTMLCanvasElement);
    self.postMessage({ type: 'DETECTION_RESULT', faceCount: faces.length });
  } catch (err) {
    self.postMessage({ type: 'ERROR', message: String(err) });
  } finally {
    imageBitmap.close();
    isProcessing = false;
  }
}

self.onmessage = async (event: MessageEvent<{ type: string; image?: ImageBitmap }>) => {
  const { type, image } = event.data;
  if (type === 'INIT') await initializeModel();
  if (type === 'DETECT_FACES' && image) {
    if (isProcessing) {
      // Drop this frame rather than queue it — the caller sends a fresh one shortly.
      image.close();
      return;
    }
    await detectFaces(image);
  }
};

export {};
