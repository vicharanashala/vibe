import React, { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

interface GestureDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trigger: boolean;
  setGesture: (gesture: string) => void;
}

const GestureDetector: React.FC<GestureDetectorProps> = ({ videoRef, trigger, setGesture }) => {
  const [gestureRecognizer, setGestureRecognizer] = useState<GestureRecognizer | null>(null);
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("[GestureDetector] 🔄 Loading MediaPipe GestureRecognizer...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
        });

        setGestureRecognizer(recognizer);
        console.log("[GestureDetector] ✅ GestureRecognizer Model Loaded!");
      } catch (error) {
        console.error("[GestureDetector] ❌ Failed to load Gesture Recognizer:", error);
      }
    };

    loadModel();
  }, []);

  useEffect(() => {
    if (!gestureRecognizer || !videoRef.current) return;

    if (trigger) {
      console.log("[GestureDetector] 🎥 Starting gesture recognition...");
      recognitionLoopRef.current = setInterval(async () => {
        try {
          const video = videoRef.current;
          if (!video) return;
          const results = await gestureRecognizer.recognize(video);

          if (results.gestures.length > 0) {
            const detectedGesture = results.gestures[0][0].categoryName;
            setGesture(detectedGesture);
            console.log(`[GestureDetector] ✋ Gesture Detected: ${detectedGesture}`);
          } else {
            setGesture("No Gesture Detected ❌");
          }
        } catch (error) {
          console.error("[GestureDetector] ❌ Error during inference:", error);
        }
      }, 500);
    } else {
      console.log("[GestureDetector] 🛑 Stopping gesture detection.");
      if (recognitionLoopRef.current) {
        clearInterval(recognitionLoopRef.current);
        recognitionLoopRef.current = null;
      }
      setGesture("No Gesture Detected");
    }

    return () => {
      if (recognitionLoopRef.current) {
        clearInterval(recognitionLoopRef.current);
        recognitionLoopRef.current = null;
      }
    };
  }, [trigger, videoRef, gestureRecognizer, setGesture]);

  return null; // No JSX, only updates parent state
};

export default GestureDetector;