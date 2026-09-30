import {useEffect, useRef, useState} from 'react';
import type {ObjectDetector} from '@mediapipe/tasks-vision';
import {GazeDebouncer} from './gazeAnalysis';
import {containsPhone} from './phoneAnalysis';

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
const CHECK_INTERVAL_MS = 500;

/**
 * Detects a mobile phone (foreign object) in the camera frame.
 * `phoneViolation` turns true once a phone has been visible for 1.5s and
 * clears after it has been gone for 1s. Does nothing while `enabled` is false.
 */
export default function usePhoneDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [phoneViolation, setPhoneViolation] = useState(false);
  const debouncerRef = useRef(new GazeDebouncer(1500, 1000));

  useEffect(() => {
    if (!enabled) {
      debouncerRef.current.reset();
      setPhoneViolation(false);
      return;
    }

    let cancelled = false;
    let detector: ObjectDetector | null = null;
    let timer: number | null = null;
    let lastVideoTime = -1;

    (async () => {
      try {
        const {ObjectDetector, FilesetResolver} = await import(
          '@mediapipe/tasks-vision'
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const det = await ObjectDetector.createFromOptions(fileset, {
          baseOptions: {modelAssetPath: MODEL_PATH, delegate: 'GPU'},
          runningMode: 'VIDEO',
          scoreThreshold: 0.4,
          maxResults: 5,
        });
        if (cancelled) {
          det.close();
          return;
        }
        detector = det;

        timer = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;

          const res = det.detectForVideo(video, performance.now());
          setPhoneViolation(
            debouncerRef.current.update(containsPhone(res.detections), Date.now()),
          );
        }, CHECK_INTERVAL_MS);
      } catch (err) {
        console.error('[usePhoneDetector] init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
      detector?.close();
      debouncerRef.current.reset();
      setPhoneViolation(false);
    };
  }, [enabled, videoRef]);

  return {phoneViolation};
}
