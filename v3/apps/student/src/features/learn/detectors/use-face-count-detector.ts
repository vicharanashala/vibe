import { useEffect, useRef, useState, type RefObject } from 'react';

const FRAMES_PER_SECOND = 3;

/** Runs the TF.js face-count worker against a live video element, 3fps. */
export function useFaceCountDetector(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): number | null {
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFaceCount(null);
      setReady(false);
      return;
    }
    const worker = new Worker(new URL('./face-count-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ type: string; faceCount?: number }>) => {
      if (e.data.type === 'MODEL_READY') setReady(true);
      else if (e.data.type === 'DETECTION_RESULT') setFaceCount(e.data.faceCount ?? null);
      else if (e.data.type === 'ERROR') setReady(false);
    };
    worker.onerror = () => setReady(false);
    worker.postMessage({ type: 'INIT' });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      setReady(false);
      setFaceCount(null);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!video || !worker || !ctx || video.readyState !== 4 || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const bitmap = await createImageBitmap(canvas);
        worker.postMessage({ type: 'DETECT_FACES', image: bitmap }, [bitmap]);
      } catch {
        // Frame not ready this tick — try again next interval.
      }
    }, 1000 / FRAMES_PER_SECOND);
    return () => window.clearInterval(interval);
  }, [enabled, ready, videoRef]);

  return faceCount;
}
