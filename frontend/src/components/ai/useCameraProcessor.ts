import { useEffect, useRef, useState } from "react";
import CameraProcessor from "./CameraProcessor";
import * as faceDetection from "@tensorflow-models/face-detection";

import type { MLProcessor } from "@/types/ai.types";
import { unRegisterStream } from "@/lib/MediaRegistry";

const useCameraProcessor = (frameRate = 3) => {
  useEffect(() => {
    return () => {
      unRegisterStream("CameraProcessor-stream");
    };
  }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageSrcs, setImageSrcs] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [faces, setFaces] = useState<faceDetection.Face[]>([]);
  const cameraProcessorRef = useRef<CameraProcessor | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false); // Add a ref to track model readiness without causing re-renders

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
      modelReadyRef.current = false;
      setFaces([]);
    }

    // Worker initialization
    workerRef.current = new Worker(new URL("./FaceDetectorWorker.ts", import.meta.url), { type: "module" });

    workerRef.current.onmessage = (event) => {
      if (event.data.type === "MODEL_READY") {
        // console.log("[useCameraProcessor] Face detection model ready");
        console.log("✅ MODEL_READY received, setting modelReady to true");
        setModelReady(true);
        modelReadyRef.current = true;
      } else if (event.data.type === "DETECTION_RESULT") {
        //   console.log("Face Detection Result:", event.data.faces);
        // console.log("✅ DETECTION_RESULT received, faces:", event.data.faces.length);
        setFaces(event.data.faces);
      } else if (event.data.type === "ERROR") {
        console.error("Worker Error:", event.data.message);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("[useCameraProcessor] Worker error:", error);
    };

    workerRef.current.postMessage({ type: "INIT" });

    // ML Processor function
    const processWithML: MLProcessor = (image) => {

      // console.log("📹 ML Processor called - modelReady:", modelReady, "modelReadyRef:", modelReadyRef.current, "worker exists:", !!workerRef.current);
  
      // Using ref instead of state
      if (!workerRef.current || !modelReadyRef.current) {
        // console.log("📹 Skipping frame - worker not ready");
        return;
      }
      
      try {
        // console.log("✅ Sending frame to worker - image size:", image.width, "x", image.height);
        workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
      } catch (error) {
        console.error("Error processing image:", error);
      }

      // console.log("📹 ML Processor called - modelReady:", modelReady, "worker exists:", !!workerRef.current);
      
      // // if (!workerRef.current || !modelReady) {
      // if (!workerRef.current || !modelReady) {
      //   console.log("📹 Skipping frame - worker not ready");
      //   return;
      // }
      
      // try {
      //   console.log("📹 Sending frame to worker, image size:", image.width, "x", image.height);
      //   workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
      // } catch (error) {
      //   console.error("Error processing image:", error);
      // }
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

  useEffect(() => {
    console.log("🔍 useCameraProcessor State:", {
      modelReady,
      facesCount: faces.length,
      hasWorker: !!workerRef.current,
      hasVideo: !!videoRef.current
    });
  }, [modelReady, faces.length]);

  //   const processWithML: MLProcessor = (image) => {
  //     // if (!workerRef.current || !modelReady) return;
  //     if (!workerRef.current || !modelReadyRef.current) return;
  //     try {
  //       workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
  //     } catch (error) {
  //       console.error("Error processing image:", error);
  //     }
  //   };

  //   cameraProcessorRef.current.addMLProcessor(processWithML);

  //   return () => {
  //     if (workerRef.current) {
  //       workerRef.current.terminate();
  //       workerRef.current = null;
  //     }
  //     modelReadyRef.current = false;
  //   };
  // }, []);
  // }, [modelReady]);

  return { videoRef, modelReady, faces, imageSrcs };

};

export default useCameraProcessor;
