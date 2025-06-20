import { useEffect, useRef, useState } from "react";
import CameraProcessor, { MLProcessor } from "./CameraProcessor";
import * as faceDetection from "@tensorflow-models/face-detection";

const useCameraProcessor = (frameRate = 3) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageSrcs, setImageSrcs] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [faces, setFaces] = useState<faceDetection.Face[]>([]);
  const cameraProcessorRef = useRef<CameraProcessor | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const initializeCamera = async () => {
      // Clean up previous processor
      if (cameraProcessorRef.current) {
        cameraProcessorRef.current.stopCapturing();
      }

      cameraProcessorRef.current = new CameraProcessor(frameRate);

      if (!videoRef.current || !cameraProcessorRef.current) return;

      // Wait for video to be ready before initializing processor
      const video = videoRef.current;
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          const checkReady = () => {
            if (video.readyState >= 2) {
              resolve(null);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }

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
  }, [frameRate]);

  useEffect(() => {
    if (!cameraProcessorRef.current) return;

    // ✅ Clean up previous worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setModelReady(false);
      setFaces([]);
    }

    // ✅ Worker initialization
    workerRef.current = new Worker(new URL("./FaceDetectorWorker.ts", import.meta.url), { type: "module" });

    workerRef.current.onmessage = (event) => {
      if (event.data.type === "MODEL_READY") {
        // console.log("[useCameraProcessor] Face detection model ready");
        setModelReady(true);
      } else if (event.data.type === "DETECTION_RESULT") {
        //   console.log("Face Detection Result:", event.data.faces);
        setFaces(event.data.faces);
      } else if (event.data.type === "ERROR") {
        console.error("Worker Error:", event.data.message);
      }
    };

    workerRef.current.onerror = (error) => {
      // console.error("[useCameraProcessor] Worker error:", error);
    };

    workerRef.current.postMessage({ type: "INIT" });

    // ✅ ML Processor function
    const processWithML: MLProcessor = (image) => {
      if (!workerRef.current || !modelReady) return;
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
    };
  }, [modelReady]);

  return { videoRef, modelReady, faces, imageSrcs };
};

export default useCameraProcessor;