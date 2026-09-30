import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { analyzeGaze, GazeDebouncer } from "./gazeAnalysis";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const CHECK_INTERVAL_MS = 200;

/**
 * Tracks whether the student's eyes/head point beyond the screen.
 * `gazeViolation` turns true after sustained look-away (5s) and false after
 * they look back (0.5s). Does nothing while `enabled` is false.
 */
export default function useGazeDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [gazeViolation, setGazeViolation] = useState(false);
  const [gazeReady, setGazeReady] = useState(false);
  const debouncerRef = useRef(new GazeDebouncer());

  useEffect(() => {
    if (!enabled) {
      debouncerRef.current.reset();
      setGazeViolation(false);
      return;
    }

    let cancelled = false;
    let landmarker: FaceLandmarker | null = null;
    let timer: number | null = null;
    let lastVideoTime = -1;

    (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        if (cancelled) {
          lm.close();
          return;
        }
        landmarker = lm;
        setGazeReady(true);

        timer = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;

          const res = lm.detectForVideo(video, performance.now());
          const shapes = res.faceBlendshapes?.[0]?.categories;
          if (!shapes) {
            // No face counts as away: same 5s to come back before restart.
            setGazeViolation(debouncerRef.current.update(true, Date.now()));
            return;
          }
          const scores: Record<string, number> = {};
          for (const c of shapes) scores[c.categoryName] = c.score;
          const matrix = res.facialTransformationMatrixes?.[0]?.data ?? null;
          const reading = analyzeGaze(scores, matrix);
          setGazeViolation(debouncerRef.current.update(reading.lookingAway, Date.now()));
        }, CHECK_INTERVAL_MS);
      } catch (err) {
        console.error("[useGazeDetector] init failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
      landmarker?.close();
      debouncerRef.current.reset();
      setGazeReady(false);
      setGazeViolation(false);
    };
  }, [enabled, videoRef]);

  return { gazeViolation, gazeReady };
}
