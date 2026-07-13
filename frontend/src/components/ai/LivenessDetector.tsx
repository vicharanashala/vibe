import { useEffect, useRef } from "react";
import type { Face } from "@tensorflow-models/face-detection";
import type { ViolationMetadata } from "@/types/reportanomaly.types";
import { AnomalyType } from "@/types/reportanomaly.types";
import { isLookingAway } from "./FaceDetectors";

/**
 * LivenessDetector
 * -----------------
 * Consumes the `faces[]` array already produced by useCameraProcessor
 * (via FaceDetectorWorker, ~3fps by default) and derives two liveness
 * signals from it:
 *
 * 1. STILLNESS — tracks the noseTip keypoint's position over a rolling
 *    window. If it barely moves for a sustained period, that's consistent
 *    with a static image held up to the camera rather than a live person.
 *
 * 2. LOOKING_AWAY — reuses the existing (previously unused) isLookingAway()
 *    geometry check from FaceDetectors.tsx. If sustained, fires a
 *    LOOKING_AWAY violation.
 *
 * NOTE ON BLINK DETECTION: the model currently used
 * (faceDetection.SupportedModels.MediaPipeFaceDetector, tfjs runtime) only
 * returns 6 sparse keypoints (eyes, nose, mouth, ears) - it does NOT expose
 * eyelid/eye-contour landmarks, so a genuine eye-openness ratio cannot be
 * computed from this data. Implementing real blink detection would require
 * swapping to a face-mesh model (e.g. MediaPipeFaceMesh with
 * refineLandmarks) which is a heavier, separate change with its own
 * performance tradeoffs. Deliberately NOT faking this here - flagged as a
 * follow-up rather than shipped as a silently-broken signal.
 *
 * Philosophy: "trust, not surveillance" - a violation only fires after a
 * sustained number of consecutive bad frames, never on a single frame, and
 * every violation carries a plain-English `reason`.
 */

const STILLNESS_WINDOW_MS = 12_000; // must be still for this long to flag
const LOOKING_AWAY_WINDOW_MS = 5_000; // must look away for this long to flag
const STILLNESS_MOVEMENT_THRESHOLD = 0.01; // normalized (fraction of face width) movement considered "no movement"
const MIN_CONSECUTIVE_FRAMES = 8; // ~2.5s at the default 3fps frame rate
const VIOLATION_COOLDOWN_MS = 60_000; // don't refire the same type more than once/minute

interface LivenessDetectorProps {
  faces: Face[];
  enabled: boolean;
  onViolation: (
    type: AnomalyType.LIVENESS | AnomalyType.LOOKING_AWAY,
    metadata: ViolationMetadata,
  ) => void;
}

interface PositionSample {
  x: number;
  y: number;
  t: number;
}

const LivenessDetector: React.FC<LivenessDetectorProps> = ({
  faces,
  enabled,
  onViolation,
}) => {
  const noseTrailRef = useRef<PositionSample[]>([]);
  const lookingAwaySinceRef = useRef<number | null>(null);
  const lookingAwayFrameCountRef = useRef(0);
  const lastLivenessFireRef = useRef(0);
  const lastLookingAwayFireRef = useRef(0);
  const stillnessFiredAtStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const face = faces[0]; // liveness only evaluates the primary detected face

    if (!face) {
      // No face at all is already handled by the existing NO_FACE detector -
      // reset our local trackers so a re-appearing face starts clean.
      noseTrailRef.current = [];
      lookingAwaySinceRef.current = null;
      lookingAwayFrameCountRef.current = 0;
      return;
    }

    // ---- Signal 1: stillness (noseTip drift over a rolling window) ----
    const noseTip = face.keypoints.find((p) => p.name === "noseTip");
    if (noseTip && face.box) {
      const faceWidth = face.box.width || 1;
      const trail = noseTrailRef.current;
      trail.push({ x: noseTip.x, y: noseTip.y, t: now });

      // Drop samples older than the stillness window.
      while (trail.length && now - trail[0].t > STILLNESS_WINDOW_MS) {
        trail.shift();
      }

      // Only evaluate once we actually have a full window of samples.
      const windowSpanMs = trail.length ? now - trail[0].t : 0;
      if (windowSpanMs >= STILLNESS_WINDOW_MS) {
        let maxDeviation = 0;
        const originX = trail[0].x;
        const originY = trail[0].y;
        for (const sample of trail) {
          const dx = (sample.x - originX) / faceWidth;
          const dy = (sample.y - originY) / faceWidth;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxDeviation) maxDeviation = dist;
        }

        if (maxDeviation < STILLNESS_MOVEMENT_THRESHOLD) {
          if (stillnessFiredAtStartRef.current === null) {
            stillnessFiredAtStartRef.current = trail[0].t;
          }
          if (now - lastLivenessFireRef.current > VIOLATION_COOLDOWN_MS) {
            lastLivenessFireRef.current = now;
            onViolation(AnomalyType.LIVENESS, {
              reason: `No meaningful movement detected for ${Math.round(
                windowSpanMs / 1000,
              )} seconds`,
              durationMs: windowSpanMs,
              consecutiveFrames: trail.length,
              signalStrength: Math.max(
                0,
                Math.min(1, 1 - maxDeviation / STILLNESS_MOVEMENT_THRESHOLD),
              ),
              detectedAt: new Date(
                stillnessFiredAtStartRef.current ?? now,
              ).toISOString(),
            });
          }
        } else {
          stillnessFiredAtStartRef.current = null;
        }
      }
    }

    // ---- Signal 2: sustained looking-away ----
    const lookingAway = isLookingAway(face);
    if (lookingAway) {
      if (lookingAwaySinceRef.current === null) {
        lookingAwaySinceRef.current = now;
      }
      lookingAwayFrameCountRef.current += 1;

      const sustainedMs = now - lookingAwaySinceRef.current;
      if (
        sustainedMs >= LOOKING_AWAY_WINDOW_MS &&
        lookingAwayFrameCountRef.current >= MIN_CONSECUTIVE_FRAMES &&
        now - lastLookingAwayFireRef.current > VIOLATION_COOLDOWN_MS
      ) {
        lastLookingAwayFireRef.current = now;
        onViolation(AnomalyType.LOOKING_AWAY, {
          reason: `Face turned away from the camera for ${Math.round(
            sustainedMs / 1000,
          )} seconds`,
          durationMs: sustainedMs,
          consecutiveFrames: lookingAwayFrameCountRef.current,
          detectedAt: new Date(lookingAwaySinceRef.current).toISOString(),
        });
      }
    } else {
      lookingAwaySinceRef.current = null;
      lookingAwayFrameCountRef.current = 0;
    }
  }, [faces, enabled, onViolation]);

  // Purely a side-effect component - it emits violations via onViolation
  // rather than rendering anything.
  return null;
};

export default LivenessDetector;
