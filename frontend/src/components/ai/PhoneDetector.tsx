import React, { useEffect, useRef } from "react";

import type { PhoneDetection, PhoneDetectorProps } from "@/types/ai.types";

// How often (ms) a frame is grabbed from the video and sent to the worker.
// Object detection is heavier than the pixel-based blur check, so this runs
// less frequently than BlurDetection's 500ms loop.
const CAPTURE_INTERVAL_MS = 800;

// Require this many consecutive positive frames before flagging an anomaly,
// so a single misclassified frame doesn't trigger a warning.
const CONSECUTIVE_HITS_TO_FLAG = 2;

const PhoneDetector: React.FC<PhoneDetectorProps> = ({ videoRef, setIsPhoneDetected, onDetection }) => {
  const workerRef = useRef<Worker | null>(null);
  const isModelReadyRef = useRef(false);
  const consecutiveHitsRef = useRef(0);
  const canvasRef = useRef<OffscreenCanvas | HTMLCanvasElement | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./PhoneDetectorWorker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent) => {
      const { type, isPhoneDetected, detection } = event.data as {
        type: string;
        isPhoneDetected?: boolean;
        detection?: PhoneDetection | null;
        message?: string;
      };

      if (type === "MODEL_READY") {
        isModelReadyRef.current = true;
      } else if (type === "DETECTION_RESULT") {
        if (isPhoneDetected) {
          consecutiveHitsRef.current += 1;
        } else {
          consecutiveHitsRef.current = 0;
        }

        const flagged = consecutiveHitsRef.current >= CONSECUTIVE_HITS_TO_FLAG;
        setIsPhoneDetected(flagged ? "Yes" : "No");
        onDetection?.(flagged ? detection ?? null : null);
      } else if (type === "ERROR") {
        console.warn("[PhoneDetector] Worker error:", event.data.message);
      }
    };

    worker.onerror = (error) => {
      console.error("[PhoneDetector] Worker error:", error);
    };

    worker.postMessage({ type: "INIT" });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      isModelReadyRef.current = false;
      consecutiveHitsRef.current = 0;
    };
  }, [setIsPhoneDetected, onDetection]);

  useEffect(() => {
    const captureFrame = async () => {
      const video = videoRef.current;
      const worker = workerRef.current;

      if (!worker || !isModelReadyRef.current) return;
      if (!video || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      try {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }
        const canvas = canvasRef.current as HTMLCanvasElement;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const bitmap = await createImageBitmap(canvas);
        worker.postMessage({ type: "DETECT_PHONE", image: bitmap }, [bitmap]);
      } catch (error) {
        console.warn("[PhoneDetector] Failed to capture frame:", error);
      }
    };

    const interval = setInterval(captureFrame, CAPTURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [videoRef]);

  return null; // No UI of its own — reports state up via setIsPhoneDetected
};

export default PhoneDetector;
