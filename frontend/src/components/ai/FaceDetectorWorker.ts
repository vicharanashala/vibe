import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm"
import "@tensorflow/tfjs";
import "@tensorflow/tfjs-core"; // Ensure WebGL backend is available

import * as faceDetection from "@tensorflow-models/face-detection";

// Self-contained worker script
let detector: faceDetection.FaceDetector | null = null;
let lastLogTime = 0;

console.log("Worker started successfully");

// Add error handling
self.onerror = (error) => {
  console.error("Worker global error:", error);
};

async function initializeModel() {
  try {
    
    // Wait for TensorFlow to be ready first
    await tf.ready();
    
    // Set backend explicitly
    await tf.setBackend('webgl');
    
    // Check available backends again
    const backends = tf.engine().registry;
    const availableBackends = Object.keys(backends);
    
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = { 
      runtime: "tfjs", 
      maxFaces: 10,
      modelType: 'full' // Try 'short' for faster detection, or 'full' for more accuracy
    };
    
    // console.log("🎯 Creating face detector...");
    detector = await faceDetection.createDetector(model, detectorConfig);
    // console.log("🎯 Face detector created successfully");
    
    self.postMessage({ type: "MODEL_READY" });
    // console.log("🎯 MODEL_READY message sent");
  } catch (error) {
    console.error("🎯 Error initializing model:", error);
    self.postMessage({ type: "ERROR", message: `Model initialization failed: ${error}` });
  }
}

// async function initializeModel() {
//   const backends = tf.engine().registry;
//   const availableBackends = Object.keys(backends);
//   console.log("Available TensorFlow.js backends:", availableBackends);
//   // if("webgl"in availableBackends) await tf.setBackend("webgl"); else if ("wasm" in availableBackends) await tf.setBackend("wasm"); else await tf.setBackend("cpu");
//   await tf.setBackend("webgl");
//   console.log("Using TensorFlow.js backend:", tf.getBackend());
//   await tf.ready();
//   const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
//   const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = { runtime: "tfjs", maxFaces: 10 }; // TensorFlow.js backend
//   detector = await faceDetection.createDetector(model, detectorConfig);
//   self.postMessage({ type: "MODEL_READY" });
// }

// Detect faces in received ImageBitmap
async function detectFaces(imageBitmap: ImageBitmap) {

  // console.log("🎯 FRAME RECEIVED - Image dimensions:", imageBitmap.width, "x", imageBitmap.height);
  
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
  // console.log("🎯 Image drawn to canvas, calling estimateFaces...");

  // Log received image data as JPEG every 10 seconds
  const currentTime = Date.now();
  if (currentTime - lastLogTime >= 10000) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    // console.log(`--- JPEG IMAGE DATA (copy and save as .jpg) ---`);
    // console.log(base64);
    // console.log(`--- END JPEG IMAGE DATA ---`);
    lastLogTime = currentTime;
  }

  const faces: faceDetection.Face[] = await detector.estimateFaces(canvas as unknown as HTMLCanvasElement);

   try {
    // console.log("🎯 Detection result - Faces found:", faces.length);
    self.postMessage({ type: "DETECTION_RESULT", faces });
  } catch (error) {
    console.error("🎯 Detection error:", error);
  }

  // Debug TensorFlow face detection
  // console.log('🎯 Worker processing frame:', {
  //   imageBitmapWidth: imageBitmap.width,
  //   imageBitmapHeight: imageBitmap.height,
  //   timestamp: Date.now()
  // });

  // console.log('🎯 Worker detection result:', {
  //   faceCount: faces.length,
  //   faces: faces.map(face => ({
  //     box: {
  //       x: face.box?.xMin,
  //       y: face.box?.yMin, 
  //       width: face.box?.width,
  //       height: face.box?.height
  //     },
  //     keypoints: face.keypoints?.length || 0
  //   }))
  // });

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