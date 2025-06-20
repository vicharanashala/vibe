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
        // console.log("[GestureDetector] 🔄 Loading MediaPipe GestureRecognizer...");
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
          numHands: 2, // Detect up to 2 hands
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        setGestureRecognizer(recognizer);
        // console.log("[GestureDetector] ✅ GestureRecognizer Model Loaded!");
      } catch (error) {
        // console.error("[GestureDetector] ❌ Failed to load Gesture Recognizer:", error);
      }
    };

    loadModel();
  }, []);

  useEffect(() => {
    if (!gestureRecognizer || !videoRef.current || !trigger) {
      if (recognitionLoopRef.current) {
        clearInterval(recognitionLoopRef.current);
        recognitionLoopRef.current = null;
      }
      if (!trigger) {
        setGesture("No Gesture Detected");
      }
      return;
    }

    // console.log("[GestureDetector] 🎥 Starting gesture recognition...");
    
    // Wait for video to be properly ready before starting recognition
    const startRecognition = () => {
      recognitionLoopRef.current = setInterval(async () => {
        try {
          const video = videoRef.current;
          if (!video || video.readyState !== 4) return;

          // Ensure video has valid dimensions and is playing
          if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) return;

          const results = await gestureRecognizer.recognize(video);

          if (results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
            const detectedGesture = results.gestures[0][0];
            const gestureName = detectedGesture.categoryName;
            const confidence = detectedGesture.score;
            
            // console.log(`[GestureDetector] ✋ Gesture: ${gestureName} (confidence: ${confidence.toFixed(2)})`);
            
            // Only report gestures with reasonable confidence
            if (confidence > 0.6) {
              setGesture(gestureName);
            } else {
              setGesture("No Gesture Detected ❌");
            }
          } else {
            setGesture("No Gesture Detected ❌");
          }
        } catch (error) {
          console.error("[GestureDetector] ❌ Error during inference:", error);
          setGesture("Detection Error");
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
  }, [trigger, videoRef, gestureRecognizer, setGesture]);

  return null; // No JSX, only updates parent state
};

export default GestureDetector;