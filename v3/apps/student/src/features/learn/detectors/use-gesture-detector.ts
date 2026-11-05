import { useEffect, useRef, useState, type RefObject } from 'react';

interface GestureWorkerMessage {
  type: 'INIT_SUCCESS' | 'INIT_ERROR' | 'GESTURE_RESULT' | 'ERROR';
  gesture?: string;
  confidence?: number;
}

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Runs MediaPipe hand-gesture recognition against a live video element via a
 * plain (non-module) Worker at /workers/gestureWorker.js, which loads the
 * recognizer and its model from MediaPipe's CDN at runtime — no ML package or
 * model weights are bundled with the app. Returns the current recognised
 * gesture name (e.g. "Thumb_Up"), or null when nothing is confidently detected.
 */
export function useGestureDetector(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): string | null {
  const [gesture, setGesture] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setGesture(null);
      setReady(false);
      return;
    }
    const worker = new Worker('/workers/gestureWorker.js');
    worker.onmessage = (e: MessageEvent<GestureWorkerMessage>) => {
      const { type, gesture: detected, confidence } = e.data;
      if (type === 'INIT_SUCCESS') setReady(true);
      else if (type === 'INIT_ERROR' || type === 'ERROR') setReady(false);
      else if (type === 'GESTURE_RESULT') setGesture(detected && (confidence ?? 0) > CONFIDENCE_THRESHOLD ? detected : null);
    };
    worker.onerror = () => setReady(false);
    worker.postMessage({ type: 'INIT' });
    workerRef.current = worker;
    return () => {
      worker.postMessage({ type: 'STOP' });
      worker.terminate();
      workerRef.current = null;
      setReady(false);
      setGesture(null);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!video || !worker || !ctx || video.readyState !== 4 || video.videoWidth === 0 || video.paused) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        worker.postMessage({ type: 'PROCESS_FRAME', imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), timestamp: Date.now() });
      } catch {
        // Frame not ready this tick — try again next interval.
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [enabled, ready, videoRef]);

  return gesture;
}
