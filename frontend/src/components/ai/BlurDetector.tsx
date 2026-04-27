import React, { useEffect, useRef } from "react";

import type { BlurDetectionProps } from "@/types/ai.types";

import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

/*const frameDiff = (prev: ImageData, curr: ImageData): number => {
  let diff = 0;
  for (let i = 0; i < prev.data.length; i += 4) {
    diff += Math.abs(prev.data[i] - curr.data[i]);
  }
  return diff / (prev.data.length / 4);
};*/


const BlurDetection: React.FC<BlurDetectionProps> = ({ videoRef, setIsBlur }) => {
  const workerRef = useRef<Worker | null>(null);
  const blurStartTimeRef = useRef<number | null>(null);
  const segmentationRef = useRef<SelfieSegmentation | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);


  useEffect(() => {
    workerRef.current = new Worker(new URL("./BlurDetectorWorker.ts", import.meta.url), {
      type: "module",
    });

    /*workerRef.current.onmessage = (event) => {
      const { isBlurry } = event.data;

      if (isBlurry) {
        if (!blurStartTimeRef.current) {
          blurStartTimeRef.current = Date.now();
        } else {
          const elapsedTime = Date.now() - blurStartTimeRef.current;
          if (elapsedTime >= 2000 && elapsedTime < 2200) {
            // console.log("[BlurDetection] ⚠️ Your image is blurry!");
          } else if (elapsedTime >= 5000 && elapsedTime < 5200) {
            // console.log("[BlurDetection] 🚨 Your image is still blurry, flag noted.");
            blurStartTimeRef.current = null; // Reset
          }
        }
        setIsBlur("Yes");
      } else {
        blurStartTimeRef.current = null;
        setIsBlur("No");
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [setIsBlur]);*/
  //Updated response handler
    workerRef.current.onmessage = (event) => {
      const { score } = event.data;

      const isSuspicious = score > 0.6;

      if (isSuspicious) {
        if (!blurStartTimeRef.current) {
          blurStartTimeRef.current = Date.now();
        } else {
          const elapsedTime = Date.now() - blurStartTimeRef.current;

          if (elapsedTime >= 2000 && elapsedTime < 2200) {
            // warning
          } else if (elapsedTime >= 5000 && elapsedTime < 5200) {
            // flag
            blurStartTimeRef.current = null;
          }
        }
        setIsBlur("Yes");
      } else {
        blurStartTimeRef.current = null;
        setIsBlur("No");
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [setIsBlur]);

  //Init Mediapipe
  useEffect(() => {
    const segmentation = new SelfieSegmentation({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    segmentation.setOptions({
      modelSelection: 1,
    });

    segmentation.onResults((results) => {
      processSegmentation(results);
    });

    segmentationRef.current = segmentation;
  }, []);

  //Process segmentation results
  const processSegmentation = (results: any) => {
    const video = videoRef.current;
    if (!video || !workerRef.current) return;

    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    if (!ctx) return;

    try {
      // Draw frame
      ctx.drawImage(video, 0, 0, width, height);
      const frame = ctx.getImageData(0, 0, width, height);

      // Flicker detection
      let flick = 0;
      if (prevFrameRef.current) {
        for (let i = 0; i < frame.data.length; i += 4) {
          flick += Math.abs(frame.data[i] - prevFrameRef.current.data[i]);
        }
        flick /= frame.data.length / 4;
      }

      prevFrameRef.current = frame;

      // Get segmentation mask
      const maskCanvas = document.createElement("canvas");
      const maskCtx = maskCanvas.getContext("2d");

      maskCanvas.width = width;
      maskCanvas.height = height;

      maskCtx?.drawImage(results.segmentationMask, 0, 0, width, height);
      const mask = maskCtx?.getImageData(0, 0, width, height);

      // Send to worker (UPDATED FORMAT)
      workerRef.current.postMessage({
        frame,
        mask,
        flick,
      });

    } catch (error) {
      console.warn("Segmentation failed:", error);
    }
  };

  //Frame loop (updated)

  useEffect(() => {
    if (!videoRef.current) return;

    const captureFrame = async() => {
      const video = videoRef.current;

      if (!video || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        return; // Skip processing if video isn't ready
      }

      /*const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (ctx) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          workerRef.current?.postMessage(imageData);
        } catch (error) {
          console.warn("Failed to capture frame:", error);
        }
      }
    };*/
    if (!segmentationRef.current) return;
    try {
      // Use MediaPipe instead of manual canvas extraction
      await segmentationRef.current?.send({ image: video });

    } catch (error) {
      console.warn("Segmentation send failed:", error);
    }
  };

  const interval = setInterval(captureFrame, 500); // ~2 FPS (optimized)

  return () => clearInterval(interval);
}, [videoRef]);

    //   if (video) {
    //     const canvas = document.createElement("canvas");
    //     const ctx = canvas.getContext("2d");
    //     canvas.width = video.videoWidth;
    //     canvas.height = video.videoHeight;
    //     if (ctx) {
    //       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    //       const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    //       workerRef.current?.postMessage(imageData);
    //     }
    //   }
    // };

    //const interval = setInterval(captureFrame, 500);
    //return () => clearInterval(interval);
  //}, [videoRef]);

  return null; // No need to return a video element
};

export default BlurDetection;