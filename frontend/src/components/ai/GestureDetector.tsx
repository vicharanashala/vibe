import React, { useEffect, useRef, useState } from "react";

interface GestureDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trigger: boolean;
  setGesture: (gesture: string) => void;
}

interface GestureWorkerResponse {
  type: 'INIT_SUCCESS' | 'INIT_ERROR' | 'GESTURE_RESULT' | 'ERROR';
  gesture?: string;
  confidence?: number;
  timestamp?: number;
  error?: string;
}

const GestureDetector: React.FC<GestureDetectorProps> = ({ videoRef, trigger, setGesture }) => {
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const initializeWorker = () => {
      try {
        // console.log("[GestureDetector] 🔄 Initializing Gesture Worker...");
        const worker = new Worker('/workers/gestureWorker.js');

        worker.onmessage = (event: MessageEvent) => {
          const { type, gesture, confidence, error } = event.data as GestureWorkerResponse;

          switch (type) {
            case 'INIT_SUCCESS':
              // console.log("[GestureDetector] ✅ Gesture Worker Initialized!");
              setIsWorkerReady(true);
              break;
            
            case 'INIT_ERROR':
              console.error("[GestureDetector] ❌ Worker initialization failed:", error);
              setIsWorkerReady(false);
              break;
            
            case 'GESTURE_RESULT':
              if (gesture) {
                if (confidence && confidence > 0.6) {
                  setGesture(gesture);
                } else {
                  setGesture("No Gesture Detected ❌");
                }
              }
              break;
            
            case 'ERROR':
              console.error("[GestureDetector] ❌ Worker error:", error);
              setGesture("Detection Error");
              break;
          }
        };

        worker.onerror = (error) => {
          console.error("[GestureDetector] ❌ Worker error:", error);
          setIsWorkerReady(false);
        };

        workerRef.current = worker;
        
        // Initialize the worker
        worker.postMessage({ type: 'INIT' });

      } catch (error) {
        console.error("[GestureDetector] ❌ Failed to create worker:", error);
      }
    };

    initializeWorker();

    // Cleanup worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [setGesture]);

  useEffect(() => {
    if (!isWorkerReady || !videoRef.current || !trigger || !workerRef.current) {
      if (recognitionLoopRef.current) {
        clearInterval(recognitionLoopRef.current);
        recognitionLoopRef.current = null;
      }
      if (!trigger) {
        setGesture("No Gesture Detected");
      }
      return;
    }

    // console.log("[GestureDetector] 🎥 Starting gesture recognition with worker...");
    
    // Create a canvas for capturing video frames
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    // Wait for video to be properly ready before starting recognition
    const startRecognition = () => {
      recognitionLoopRef.current = setInterval(() => {
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const worker = workerRef.current;
          
          if (!video || !canvas || !worker || video.readyState !== 4) return;

          // Ensure video has valid dimensions and is playing
          if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) return;

          // Set canvas dimensions to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data from canvas
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Send frame to worker for processing
          worker.postMessage({
            type: 'PROCESS_FRAME',
            imageData,
            timestamp: Date.now()
          });

        } catch (error) {
          console.error("[GestureDetector] ❌ Error capturing frame:", error);
        }
      }, 300); // Faster detection rate
    };

    // Small delay to ensure video is stable
    setTimeout(startRecognition, 100);

    return () => {
      if (recognitionLoopRef.current) {
        clearInterval(recognitionLoopRef.current);
        recognitionLoopRef.current = null;
      }
    };
  }, [trigger, videoRef, isWorkerReady, setGesture]);

  return null; // No JSX, only updates parent state
};

export default GestureDetector;