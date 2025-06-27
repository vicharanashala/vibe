// GestureWorker - Handles MediaPipe gesture recognition in a web worker
class GestureWorkerHandler {
  constructor() {
    this.gestureRecognizer = null;
    this.isInitialized = false;
    this.isProcessing = false;
  }

  async initialize() {
    try {
      console.log("[GestureWorker] 🔄 Loading MediaPipe GestureRecognizer...");
      
      // Import MediaPipe dynamically
      const { GestureRecognizer, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm');

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isInitialized = true;
      console.log("[GestureWorker] ✅ GestureRecognizer Model Loaded!");
      
      this.postMessage({
        type: 'INIT_SUCCESS'
      });
    } catch (error) {
      console.error("[GestureWorker] ❌ Failed to load Gesture Recognizer:", error);
      this.postMessage({
        type: 'INIT_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async processFrame(imageData, timestamp) {
    if (!this.gestureRecognizer || !this.isInitialized || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Create a temporary canvas to convert ImageData to HTMLImageElement
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.putImageData(imageData, 0, 0);
      
      // Convert canvas to ImageBitmap for MediaPipe
      const imageBitmap = await createImageBitmap(canvas);
      
      const results = await this.gestureRecognizer.recognize(imageBitmap);

      let gesture = "No Gesture Detected ❌";
      let confidence = 0;

      if (results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
        const detectedGesture = results.gestures[0][0];
        const gestureName = detectedGesture.categoryName;
        const gestureConfidence = detectedGesture.score;
        
        // Only report gestures with reasonable confidence
        if (gestureConfidence > 0.6) {
          gesture = gestureName;
          confidence = gestureConfidence;
        }
      }

      this.postMessage({
        type: 'GESTURE_RESULT',
        gesture,
        confidence,
        timestamp
      });

      // Clean up
      imageBitmap.close();
    } catch (error) {
      console.error("[GestureWorker] ❌ Error during inference:", error);
      this.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Processing error',
        timestamp
      });
    } finally {
      this.isProcessing = false;
    }
  }

  postMessage(message) {
    self.postMessage(message);
  }
}

// Initialize worker handler
const workerHandler = new GestureWorkerHandler();

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, imageData, timestamp } = event.data;

  switch (type) {
    case 'INIT':
      await workerHandler.initialize();
      break;
    
    case 'PROCESS_FRAME':
      if (imageData && timestamp !== undefined) {
        await workerHandler.processFrame(imageData, timestamp);
      }
      break;
    
    case 'STOP':
      // Cleanup if needed
      break;
    
    default:
      console.warn('[GestureWorker] Unknown message type:', type);
  }
};
