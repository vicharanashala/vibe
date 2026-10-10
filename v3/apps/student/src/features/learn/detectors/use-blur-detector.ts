import { useEffect, useRef, useState, type RefObject } from 'react';

/** Runs the Laplacian-variance blur worker against a live video element. */
export function useBlurDetector(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): boolean {
  const [isBlurry, setIsBlurry] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsBlurry(false);
      return;
    }
    const worker = new Worker(new URL('./blur-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ isBlurry: boolean }>) => setIsBlurry(e.data.isBlurry);
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsBlurry(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!video || !worker || !ctx || video.readyState !== 4 || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        worker.postMessage(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch {
        // Frame not ready this tick — try again next interval.
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [enabled, videoRef]);

  return isBlurry;
}
