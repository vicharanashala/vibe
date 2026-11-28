import { useCallback, useEffect, useRef, useState } from "react";
import CameraProcessor from "./CameraProcessor";
import * as faceDetection from "@tensorflow-models/face-detection";

import type { MLProcessor } from "@/types/ai.types";
import { unRegisterStream } from "@/lib/MediaRegistry";

const useCameraProcessor = (frameRate = 3, includeAudio = false) => {
  useEffect(() => {
    return () => {
      unRegisterStream("CameraProcessor-stream");
    };
  }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [imageSrcs] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [faces, setFaces] = useState<faceDetection.Face[]>([]);
  const cameraProcessorRef = useRef<CameraProcessor | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false); // track model readiness without causing re-renders
  // Set once the worker is ready, replayed on (re)init so a toggle made
  // before/during a worker recreation isn't lost.
  const recognitionEnabledRef = useRef(false);

  useEffect(() => {
    const initializeCamera = async () => {
      // Clean up previous processor
      if (cameraProcessorRef.current) {
        cameraProcessorRef.current.stopCapturing();
      }

      cameraProcessorRef.current = new CameraProcessor(frameRate, includeAudio);

      if (!videoRef.current || !cameraProcessorRef.current) return;

      // Initialize processor directly as React useEffect runs after the DOM element is mounted
      await cameraProcessorRef.current.initialize(videoRef.current);

      // Small delay before starting capture to ensure everything is ready
      setTimeout(() => {
        cameraProcessorRef.current?.startCapturing();
      }, 200);
    };

    initializeCamera();

    return () => {
      cameraProcessorRef.current?.stopCapturing();
    };
  }, [frameRate, includeAudio]);

  useEffect(() => {
    if (!cameraProcessorRef.current) return;

    // Clean up previous worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setModelReady(false);
      modelReadyRef.current = false;
      setFaces([]);
    }

    // Worker initialization. Classic (non-module) worker served as a static
    // asset, not Vite-bundled - see public/workers/humanFaceWorker.js for why
    // (module workers can't run libraries that call importScripts()
    // internally, and @vladmandic/human's own "script" build uses it).
    workerRef.current = new Worker("/workers/humanFaceWorker.js");

    workerRef.current.onmessage = (event) => {
      if (event.data.type === "MODEL_READY") {
        console.log("✅ MODEL_READY received, setting modelReady to true");
        setModelReady(true);
        modelReadyRef.current = true;
        workerRef.current?.postMessage({
          type: "SET_RECOGNITION_ENABLED",
          enabled: recognitionEnabledRef.current,
        });
      } else if (event.data.type === "DETECTION_RESULT") {
        setFaces(event.data.faces);
      } else if (event.data.type === "ERROR") {
        console.error("Worker Error:", event.data.message);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("[useCameraProcessor] Worker error:", error);
    };

    // isTesting is resolved here (build-time env, available in Vite-processed
    // code) and passed in the message, since the static worker script isn't
    // processed by Vite and has no import.meta.env of its own.
    workerRef.current.postMessage({
      type: "INIT",
      isTesting: import.meta.env.VITE_E2E_TESTING === "true",
    });

    const processWithML: MLProcessor = (image) => {
      if (!workerRef.current || !modelReadyRef.current) {
        return;
      }

      try {
        workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
      } catch (error) {
        console.error("Error processing image:", error);
      }
    };

    cameraProcessorRef.current.addMLProcessor(processWithML);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      modelReadyRef.current = false;
    };
  }, []);

  // Face recognition is part of the same one-pass detect() call the face-count
  // signal comes from (see humanFaceWorker.js) - toggle it independently so
  // the worker only pays for embedding extraction while it's actually needed.
  const setRecognitionEnabled = useCallback((enabled: boolean) => {
    recognitionEnabledRef.current = enabled;
    workerRef.current?.postMessage({ type: "SET_RECOGNITION_ENABLED", enabled });
  }, []);

  return { videoRef, modelReady, faces, imageSrcs, setRecognitionEnabled };
};

export default useCameraProcessor;
