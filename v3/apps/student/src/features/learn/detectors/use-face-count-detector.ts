import { useEffect, useRef, useState, type RefObject } from 'react';

import { faceCountAssets } from '../proctoring/assets';
import { loadAssets } from '../proctoring/model-loader';
import { READY, useReadiness, type Readiness } from '../proctoring/readiness';

import type { FaceCountModelFiles } from './face-count-model';

const FRAMES_PER_SECOND = 3;

/**
 * Runs the TF.js face-count worker against a live video element, 3fps. The
 * model is downloaded here, through the shared proctoring loader, and handed
 * to the worker; frames are only sent once a video frame is available.
 */
export function useFaceCountDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): { faceCount: number | null; readiness: Readiness; retry: () => void } {
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const { readiness, attempt, retry, track } = useReadiness();

  useEffect(() => {
    if (!enabled) {
      setFaceCount(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    let worker: Worker | null = null;
    track.begin();
    (async () => {
      const { files, fromCache, saved } = await loadAssets(faceCountAssets(), (progress) => {
        if (!cancelled) track.progress(progress);
      });
      if (cancelled) return;
      track.loaded({ fromCache, saved });
      worker = new Worker(new URL('./face-count-worker.ts', import.meta.url), { type: 'module' });
      // Errors before MODEL_READY mean the check never started; after it, a frame failed.
      let started = false;
      worker.onmessage = (e: MessageEvent<{ type: string; faceCount?: number; message?: string }>) => {
        if (e.data.type === 'MODEL_READY') {
          started = true;
          setReady(true);
          track.ready();
        } else if (e.data.type === 'DETECTION_RESULT') setFaceCount(e.data.faceCount ?? null);
        else if (e.data.type === 'ERROR' && !started) track.fail(new Error(e.data.message));
      };
      worker.onerror = () => {
        setReady(false);
        if (!started) track.fail(new Error('The face detection worker couldn’t start.'));
      };
      const transfer: FaceCountModelFiles = { model: files.model.buffer, weights: files.weights.buffer };
      worker.postMessage({ type: 'INIT', files: transfer }, [transfer.model, transfer.weights]);
      workerRef.current = worker;
    })().catch((error: unknown) => {
      if (!cancelled) track.fail(error);
    });
    return () => {
      cancelled = true;
      worker?.terminate();
      workerRef.current = null;
      setReady(false);
      setFaceCount(null);
    };
  }, [enabled, attempt, track]);

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

  return { faceCount, readiness: enabled ? readiness : READY, retry };
}
