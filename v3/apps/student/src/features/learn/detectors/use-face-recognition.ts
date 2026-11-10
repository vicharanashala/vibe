import { useEffect, useRef, useState, type RefObject } from 'react';
import * as faceapi from '@vladmandic/face-api';

import { FACE_API_NETS, faceRecognitionAssets } from '../proctoring/assets';
import { loadAssets, type GroupProgress } from '../proctoring/model-loader';
import { READY, useReadiness, type Readiness } from '../proctoring/readiness';

export const FACE_EMBEDDING_LENGTH = 128;
// Used for BOTH the reference capture (face-enrollment.tsx) and every live check
// below — a different inputSize/threshold between the two would align face
// landmarks differently and itself widen the distance between otherwise-matching
// faces, on top of real lighting/angle differences between the two moments.
export const FACE_DETECTOR_OPTIONS = { inputSize: 512, scoreThreshold: 0.45 };
const VERIFY_INTERVAL_MS = 1000;
// 0.6 is the commonly-cited safe match threshold for face-api.js's recognition
// net; the stricter 0.55 flagged real matches as mismatches too readily once a
// live frame's lighting/angle drifted from the one-off reference photo.
const MATCH_THRESHOLD = 0.6;
const REQUIRED_MATCHES = 3;
// Generous on purpose: a transient bad frame (blink, motion blur, a lighting
// flicker) shouldn't block the lesson. 4 *consecutive* real mismatches (~4s)
// is still a fast, meaningful signal that it's genuinely a different person.
const REQUIRED_MISMATCHES = 4;

export type FaceRecognitionStatus = 'loading' | 'no-face' | 'matched' | 'mismatched';

interface FaceModelsLoaded {
  fromCache: boolean;
  saved: boolean;
}

// One load shared by live recognition and the reference-photo capture.
let modelsLoaded: Promise<FaceModelsLoaded> | null = null;
let lastProgress: GroupProgress | null = null;
const progressListeners = new Set<(progress: GroupProgress) => void>();

/**
 * Downloads (or reads from the device) face-api's three nets, pinned to the
 * installed library version, and loads them into face-api. A failed load is
 * forgotten so the next call tries again.
 */
export function loadFaceModels(onProgress?: (progress: GroupProgress) => void): Promise<FaceModelsLoaded> {
  if (onProgress) {
    progressListeners.add(onProgress);
    if (lastProgress) onProgress(lastProgress);
  }
  modelsLoaded ??= (async () => {
    const { files, fromCache, saved } = await loadAssets(faceRecognitionAssets(), (progress) => {
      lastProgress = progress;
      progressListeners.forEach((listener) => listener(progress));
    });
    for (const { net, file } of FACE_API_NETS) {
      const manifest = JSON.parse(new TextDecoder().decode(files[`${file}-manifest`])) as { weights: faceapi.tf.io.WeightsManifestEntry[] }[];
      const weightMap = faceapi.tf.io.decodeWeights(files[`${file}-weights`].buffer, manifest.flatMap((group) => group.weights));
      faceapi.nets[net].loadFromWeightMap(weightMap);
    }
    return { fromCache, saved };
  })().catch((error: unknown) => {
    modelsLoaded = null;
    lastProgress = null;
    throw error;
  });
  const loading = modelsLoaded;
  return onProgress ? loading.finally(() => progressListeners.delete(onProgress)) : loading;
}

/** Forget the loaded models, so the next load reads them again (after the saved copy is cleared). */
export function resetFaceModels() {
  modelsLoaded = null;
  lastProgress = null;
}

/**
 * Compares the live video feed against a reference face embedding (from
 * GET /users/me/face-reference) every second, via face-api.js. Requires
 * REQUIRED_MATCHES/REQUIRED_MISMATCHES consecutive results before flipping
 * status, so one bad frame doesn't flap the UI.
 *
 * Crucially, a tick where no face was confidently detected is NOT evidence of
 * a mismatch — glancing at the lesson content instead of the camera, a blink,
 * a moment of motion blur, all routinely drop below the detector's confidence
 * threshold for a frame or two. Once matched, only a face that's actually
 * *there* and doesn't match downgrades the status; absence just leaves it as
 * the student left it. (Whether someone is in frame at all is faceCountDetection's
 * job, not this hook's — see its own blocking notice in lesson-page.tsx.)
 */
export function useFaceRecognition(
  videoRef: RefObject<HTMLVideoElement | null>,
  referenceEmbedding: number[] | null | undefined,
  enabled: boolean,
): { status: FaceRecognitionStatus; readiness: Readiness; retry: () => void } {
  const [status, setStatus] = useState<FaceRecognitionStatus>('loading');
  const { readiness, attempt, retry, track } = useReadiness();
  const [modelsReady, setModelsReady] = useState(false);

  // The models load as soon as the check is on, even before a reference photo
  // exists: the reference-photo capture needs them too.
  useEffect(() => {
    if (!enabled) {
      setModelsReady(false);
      return;
    }
    let cancelled = false;
    track.begin();
    loadFaceModels((progress) => {
      if (!cancelled) track.progress(progress);
    })
      .then((loaded) => {
        if (cancelled) return;
        track.loaded(loaded);
        track.ready();
        setModelsReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) track.fail(error);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt, track]);
  const matchStreak = useRef(0);
  const mismatchStreak = useRef(0);
  const hasMatchedOnce = useRef(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !referenceEmbedding || !modelsReady) {
      setStatus('loading');
      matchStreak.current = 0;
      mismatchStreak.current = 0;
      hasMatchedOnce.current = false;
      return;
    }

    setStatus('no-face');

    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      if (processingRef.current || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
      processingRef.current = true;
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions(FACE_DETECTOR_OPTIONS))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection?.descriptor || detection.descriptor.length !== FACE_EMBEDDING_LENGTH) {
          // No confident detection this tick — not proof of anything. Only
          // surface it as "checking" before the very first real match; after
          // that, hold the last confirmed status.
          matchStreak.current = 0;
          if (!hasMatchedOnce.current) setStatus('no-face');
          return;
        }

        const distance = faceapi.euclideanDistance(referenceEmbedding, Array.from(detection.descriptor));
        if (distance < MATCH_THRESHOLD) {
          matchStreak.current += 1;
          mismatchStreak.current = 0;
          if (matchStreak.current >= REQUIRED_MATCHES) {
            hasMatchedOnce.current = true;
            setStatus('matched');
          }
        } else {
          mismatchStreak.current += 1;
          matchStreak.current = 0;
          if (mismatchStreak.current >= REQUIRED_MISMATCHES) setStatus('mismatched');
        }
      } catch {
        // Transient detection failure — try again next tick.
      } finally {
        processingRef.current = false;
      }
    }, VERIFY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [enabled, referenceEmbedding, videoRef, modelsReady]);

  return { status, readiness: enabled ? readiness : READY, retry };
}
