import { useEffect, useRef } from "react";
import { Face } from "@tensorflow-models/face-detection";
import { AnomalyType, ViolationMetadata } from "@/types/reportanomaly.types";
import {
  BLINK_WINDOW_MS,
  CONSECUTIVE_FRAMES_REQUIRED,
  STILLNESS_WINDOW_MS,
  TimedSample,
  computeEyeOpennessRatio,
  getKeypoint,
  isBlinkMissingInWindow,
  isLookingAwaySustained,
  isStillInWindow,
  trimSamples,
} from "./livenessDetectionUtils";

interface LivenessDetectorProps {
  faces: Face[];
  isLookingAway: (face: Face) => boolean;
  onViolation: (
    type: AnomalyType.LIVENESS | AnomalyType.LOOKING_AWAY,
    metadata: ViolationMetadata,
  ) => void;
}

// How many consecutive no-face frames to tolerate before treating it as a
// real "subject left frame" event rather than a detector glitch.
const NO_FACE_TOLERANCE_FRAMES = 2;

const LivenessDetector: React.FC<LivenessDetectorProps> = ({
  faces,
  isLookingAway,
  onViolation,
}) => {
  const noseHistoryRef = useRef<TimedSample<{ x: number; y: number }>[]>([]);
  const eyeRatioHistoryRef = useRef<TimedSample<number>[]>([]);
  const stillnessFramesRef = useRef(0);
  const noBlinkFramesRef = useRef(0);
  const lookingAwayFramesRef = useRef(0);
  const lookingAwaySinceRef = useRef<number | null>(null);
  const onViolationRef = useRef(onViolation);
  const lastDebugLogRef = useRef(0);
  const noFaceStreakRef = useRef(0);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    const face = faces[0];
    if (!face) {
      noFaceStreakRef.current += 1;
      // Tolerate brief single/double-frame detection dropouts (motion blur,
      // a blink, a momentary bad frame) instead of nuking all progress on
      // the very first miss — only a *sustained* loss (a few frames running)
      // counts as "the subject actually left frame".
      if (noFaceStreakRef.current <= NO_FACE_TOLERANCE_FRAMES) {
        return;
      }
      if (stillnessFramesRef.current || noBlinkFramesRef.current || lookingAwayFramesRef.current) {
        console.log("🟣 [Liveness] face lost for", noFaceStreakRef.current, "frames — stillness/blink/looking-away progress reset to 0");
      }
      stillnessFramesRef.current = 0;
      noBlinkFramesRef.current = 0;
      lookingAwayFramesRef.current = 0;
      lookingAwaySinceRef.current = null;
      return;
    }
    noFaceStreakRef.current = 0;

    const now = Date.now();
    const noseTip = getKeypoint(face, "noseTip");
    if (noseTip) {
      noseHistoryRef.current = trimSamples(
        [
          ...noseHistoryRef.current,
          { value: { x: noseTip.x, y: noseTip.y }, timestamp: now },
        ],
        STILLNESS_WINDOW_MS,
        now,
      );
    }

    const eyeRatio = computeEyeOpennessRatio(face);
    if (eyeRatio !== null) {
      eyeRatioHistoryRef.current = trimSamples(
        [
          ...eyeRatioHistoryRef.current,
          { value: eyeRatio, timestamp: now },
        ],
        BLINK_WINDOW_MS,
        now,
      );
    }

    const still = isStillInWindow(noseHistoryRef.current);
    stillnessFramesRef.current = still
      ? stillnessFramesRef.current + 1
      : 0;

    const blinkMissing = isBlinkMissingInWindow(eyeRatioHistoryRef.current);
    noBlinkFramesRef.current = blinkMissing
      ? noBlinkFramesRef.current + 1
      : 0;

    const lookingAwayNow = isLookingAway(face);
    if (lookingAwayNow) {
      if (lookingAwaySinceRef.current === null) {
        lookingAwaySinceRef.current = now;
      }
    } else {
      lookingAwaySinceRef.current = null;
      lookingAwayFramesRef.current = 0;
    }

    const lookingAwaySustained =
      lookingAwayNow &&
      isLookingAwaySustained(lookingAwaySinceRef.current, now);
    lookingAwayFramesRef.current = lookingAwaySustained
      ? lookingAwayFramesRef.current + 1
      : 0;

    const detectedAt = new Date(now).toISOString();

    // Throttled progress heartbeat (~1/sec) so it's visible in the console
    // whether each check is inching toward its threshold or stuck at 0.
    if (now - lastDebugLogRef.current > 1000) {
      lastDebugLogRef.current = now;
      console.log(
        `🟣 [Liveness] still ${stillnessFramesRef.current}/${CONSECUTIVE_FRAMES_REQUIRED} (${noseHistoryRef.current.length} nose samples)` +
        ` | noBlink ${noBlinkFramesRef.current}/${CONSECUTIVE_FRAMES_REQUIRED} (${eyeRatioHistoryRef.current.length} eye samples)` +
        ` | lookingAway ${lookingAwayNow ? lookingAwayFramesRef.current + '/' + CONSECUTIVE_FRAMES_REQUIRED : 'no'}`,
      );
    }

    if (stillnessFramesRef.current >= CONSECUTIVE_FRAMES_REQUIRED) {
      const durationSec = Math.round(STILLNESS_WINDOW_MS / 1000);
      onViolationRef.current(AnomalyType.LIVENESS, {
        reason: `No movement detected for ${durationSec}s`,
        durationMs: STILLNESS_WINDOW_MS,
        consecutiveFrames: stillnessFramesRef.current,
        signalStrength: 0.8,
        detectedAt,
      });
      stillnessFramesRef.current = 0;
      noseHistoryRef.current = [];
    } else if (noBlinkFramesRef.current >= CONSECUTIVE_FRAMES_REQUIRED) {
      const durationSec = Math.round(BLINK_WINDOW_MS / 1000);
      onViolationRef.current(AnomalyType.LIVENESS, {
        reason: `No eye blink detected for ${durationSec} seconds`,
        durationMs: BLINK_WINDOW_MS,
        consecutiveFrames: noBlinkFramesRef.current,
        signalStrength: 0.75,
        detectedAt,
      });
      noBlinkFramesRef.current = 0;
      eyeRatioHistoryRef.current = [];
    } else if (lookingAwayFramesRef.current >= CONSECUTIVE_FRAMES_REQUIRED) {
      const durationMs = now - (lookingAwaySinceRef.current ?? now);
      onViolationRef.current(AnomalyType.LOOKING_AWAY, {
        reason: `Head turned away from camera for ${Math.round(durationMs / 1000)}s`,
        durationMs,
        consecutiveFrames: lookingAwayFramesRef.current,
        signalStrength: 0.85,
        detectedAt,
      });
      lookingAwayFramesRef.current = 0;
      lookingAwaySinceRef.current = null;
    }
  }, [faces, isLookingAway]);

  return null;
};

export default LivenessDetector;
