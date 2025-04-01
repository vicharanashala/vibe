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
    cameraProcessorRef.current = new CameraProcessor(frameRate);

    const initializeCamera = async () => {
      if (!videoRef.current || !cameraProcessorRef.current) return;
      await cameraProcessorRef.current.initialize(videoRef.current);
      cameraProcessorRef.current.startCapturing();
    };

    initializeCamera();

    return () => {
      cameraProcessorRef.current?.stopCapturing();
    };
  }, [frameRate]);

  useEffect(() => {
    if (!cameraProcessorRef.current) return;

    // ✅ Worker initialization
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./face-detector-worker.ts", import.meta.url), { type: "module" });

      workerRef.current.onmessage = (event) => {
        if (event.data.type === "MODEL_READY") {
          setModelReady(true);
        } else if (event.data.type === "DETECTION_RESULT") {
          console.log("Face Detection Result:", event.data.faces);
          setFaces(event.data.faces);
        } else if (event.data.type === "ERROR") {
          console.error("Worker Error:", event.data.message);
        }
      };

      workerRef.current.postMessage({ type: "INIT" });
    }

    // ✅ ML Processor function
    const processWithML: MLProcessor = (image) => {
      if (!workerRef.current) return;
      try {
        workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
      } catch (error) {
        console.error("Error processing image:", error);
      }
    };

    cameraProcessorRef.current.addMLProcessor(processWithML);
  }, []);

  return { videoRef, modelReady, faces, imageSrcs };
};

export default useCameraProcessor;
