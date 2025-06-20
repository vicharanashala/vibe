import React, { useEffect, useRef } from "react";

interface BlurDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setIsBlur: (value: string) => void;
}

const BlurDetection: React.FC<BlurDetectionProps> = ({ videoRef, setIsBlur }) => {
  const workerRef = useRef<Worker | null>(null);
  const blurStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL("./BlurDetectorWorker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event) => {
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
  }, [setIsBlur]);

  useEffect(() => {
    if (!videoRef.current) return;

    const captureFrame = () => {
      const video = videoRef.current;
      if (video) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          workerRef.current?.postMessage(imageData);
        }
      }
    };

    const interval = setInterval(captureFrame, 500);
    return () => clearInterval(interval);
  }, [videoRef]);

  return null; // No need to return a video element
};

export default BlurDetection;