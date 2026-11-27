import { useEffect, useRef, useState, type RefObject } from 'react';

import { gestureAssets } from '../proctoring/assets';
import { simdSupported } from '../proctoring/browser';
import { loadAssets } from '../proctoring/model-loader';
import { READY, useReadiness, type Readiness } from '../proctoring/readiness';

interface GestureWorkerMessage {
  type: 'INIT_SUCCESS' | 'INIT_ERROR' | 'GESTURE_RESULT' | 'ERROR';
  gesture?: string;
  confidence?: number;
  error?: string;
}

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Runs MediaPipe hand-gesture recognition against a live video element via a
 * plain (non-module) Worker at /workers/gestureWorker.js. MediaPipe's library,
 * runtime and model are downloaded here through the shared proctoring loader
 * and handed to the worker. Returns the current recognised gesture name (e.g.
 * "Thumb_Up"), or null when nothing is confidently detected.
 */
export function useGestureDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): { gesture: string | null; readiness: Readiness; retry: () => void } {
  const [gesture, setGesture] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const { readiness, attempt, retry, track } = useReadiness();

  useEffect(() => {
    if (!enabled) {
      setGesture(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    let worker: Worker | null = null;
    track.begin();
    (async () => {
      const assets = gestureAssets(simdSupported());
      const { files, fromCache, saved } = await loadAssets(assets, (progress) => {
        if (!cancelled) track.progress(progress);
      });
      if (cancelled) return;
      track.loaded({ fromCache, saved });
      worker = new Worker('/workers/gestureWorker.js');
      worker.onmessage = (e: MessageEvent<GestureWorkerMessage>) => {
        const { type, gesture: detected, confidence, error } = e.data;
        if (type === 'INIT_SUCCESS') {
          setReady(true);
          track.ready();
        } else if (type === 'INIT_ERROR') {
          setReady(false);
          track.fail(new Error(error ?? 'Hand gestures couldn’t start.'));
        } else if (type === 'GESTURE_RESULT') setGesture(detected && (confidence ?? 0) > CONFIDENCE_THRESHOLD ? detected : null);
      };
      worker.onerror = () => {
        setReady(false);
        track.fail(new Error('The hand gesture worker couldn’t start.'));
      };
      const transfer = {
        library: files.library.buffer,
        wasmLoader: files['wasm-loader'].buffer,
        wasmBinary: files['wasm-binary'].buffer,
        model: files.model.buffer,
      };
      const library = assets.find((a) => a.id === 'library')!.url;
      worker.postMessage({ type: 'INIT', files: transfer, urls: { library } }, Object.values(transfer));
      workerRef.current = worker;
    })().catch((error: unknown) => {
      if (!cancelled) track.fail(error);
    });
    return () => {
      cancelled = true;
      worker?.postMessage({ type: 'STOP' });
      worker?.terminate();
      workerRef.current = null;
      setReady(false);
      setGesture(null);
    };
  }, [enabled, attempt, track]);

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

  return { gesture, readiness: enabled ? readiness : READY, retry };
}
