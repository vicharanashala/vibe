export type Blendshapes = Record<string, number>;

export interface GazeThresholds {
  /** Head turn left/right, degrees. */
  maxYawDeg: number;
  /** Head tilt up/down, degrees. */
  maxPitchDeg: number;
  /** Eye-only sideways look (0..1 blendshape score). */
  maxEyeHorizontal: number;
  /** Eye-only vertical look (0..1 blendshape score). */
  maxEyeVertical: number;
}

export const DEFAULT_GAZE_THRESHOLDS: GazeThresholds = {
  maxYawDeg: 35,
  maxPitchDeg: 30,
  maxEyeHorizontal: 0.55,
  maxEyeVertical: 0.65,
};

export interface GazeReading {
  lookingAway: boolean;
  reason: "yaw" | "pitch" | "eyes-horizontal" | "eyes-vertical" | null;
  yawDeg: number;
  pitchDeg: number;
  eyeHorizontal: number;
  eyeVertical: number;
}

const avg = (a = 0, b = 0) => (a + b) / 2;

/**
 * Head yaw/pitch (degrees) from MediaPipe's column-major 4x4 facial
 * transformation matrix. Frontal face => both ~0.
 */
export function headPoseFromMatrix(data: ArrayLike<number>): {
  yawDeg: number;
  pitchDeg: number;
} {
  const toDeg = 180 / Math.PI;
  return {
    yawDeg: Math.atan2(data[8], data[10]) * toDeg,
    pitchDeg: Math.atan2(-data[9], data[10]) * toDeg,
  };
}

/**
 * Decides whether the student is looking beyond the screen, from face
 * blendshapes (iris direction) and head pose.
 */
export function analyzeGaze(
  blendshapes: Blendshapes,
  matrix: ArrayLike<number> | null,
  t: GazeThresholds = DEFAULT_GAZE_THRESHOLDS,
): GazeReading {
  const b = blendshapes;
  // Left eye: "out" = away from nose; right eye mirrored. Horizontal offset
  // of both irises in the same direction = (outL + inR) vs (inL + outR).
  const lookLeftRight = Math.abs(
    avg(b.eyeLookOutLeft, b.eyeLookInRight) -
      avg(b.eyeLookInLeft, b.eyeLookOutRight),
  );
  const up = avg(b.eyeLookUpLeft, b.eyeLookUpRight);
  const down = avg(b.eyeLookDownLeft, b.eyeLookDownRight);
  const eyeVertical = Math.max(up, down);

  const { yawDeg, pitchDeg } = matrix
    ? headPoseFromMatrix(matrix)
    : { yawDeg: 0, pitchDeg: 0 };

  let reason: GazeReading["reason"] = null;
  if (Math.abs(yawDeg) > t.maxYawDeg) reason = "yaw";
  else if (Math.abs(pitchDeg) > t.maxPitchDeg) reason = "pitch";
  else if (lookLeftRight > t.maxEyeHorizontal) reason = "eyes-horizontal";
  else if (eyeVertical > t.maxEyeVertical) reason = "eyes-vertical";

  return {
    lookingAway: reason !== null,
    reason,
    yawDeg,
    pitchDeg,
    eyeHorizontal: lookLeftRight,
    eyeVertical,
  };
}

/**
 * Debounces raw per-frame readings: a violation starts only after the
 * student has looked away continuously for `awayMs`, and clears only after
 * `backMs` of looking back. Avoids restarts from blinks/glances.
 */
export class GazeDebouncer {
  private awaySince: number | null = null;
  private backSince: number | null = null;
  private violating = false;

  constructor(
    private readonly awayMs = 5000,
    private readonly backMs = 500,
  ) {}

  /** Seconds left before the restart triggers (null when not looking away). */
  remainingMs(now: number): number | null {
    if (this.awaySince === null || this.violating) return null;
    return Math.max(0, this.awayMs - (now - this.awaySince));
  }

  update(lookingAway: boolean, now: number): boolean {
    if (lookingAway) {
      this.backSince = null;
      this.awaySince ??= now;
      if (now - this.awaySince >= this.awayMs) this.violating = true;
    } else {
      this.awaySince = null;
      this.backSince ??= now;
      if (now - this.backSince >= this.backMs) this.violating = false;
    }
    return this.violating;
  }

  reset() {
    this.awaySince = null;
    this.backSince = null;
    this.violating = false;
  }
}

// ---------------------------------------------------------------------------
// Per-student calibration
// ---------------------------------------------------------------------------
// Raw eye blendshapes are noisy: glasses, glare and webcam resolution can give a
// student who is looking straight at the screen an "eyes sideways" score of
// 0.5+. So instead of absolute thresholds we learn each student's neutral look
// from their first few readings and flag only a clear change from it.

export interface GazeSample {
  yawDeg: number;
  pitchDeg: number;
  eyeHorizontal: number;
  eyeVertical: number;
}

/** Allowed deviation from the student's own neutral look. */
export const DEFAULT_DEVIATION_THRESHOLDS: GazeThresholds = {
  maxYawDeg: 30,
  maxPitchDeg: 25,
  maxEyeHorizontal: 0.4,
  maxEyeVertical: 0.45,
};

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

export class GazeCalibrator {
  private samples: GazeSample[] = [];
  private baseline: GazeSample | null = null;

  /** `needed` readings (~3s at 5 readings/s) define the neutral look. */
  constructor(private readonly needed = 15) {}

  get ready(): boolean {
    return this.baseline !== null;
  }

  add(sample: GazeSample): void {
    if (this.baseline) return;
    this.samples.push(sample);
    if (this.samples.length >= this.needed) {
      const pick = (k: keyof GazeSample) => median(this.samples.map(s => s[k]));
      this.baseline = {
        yawDeg: pick('yawDeg'),
        pitchDeg: pick('pitchDeg'),
        eyeHorizontal: pick('eyeHorizontal'),
        eyeVertical: pick('eyeVertical'),
      };
    }
  }

  /** Reading relative to the neutral look (unchanged until calibrated). */
  adjust(s: GazeSample): GazeSample {
    const b = this.baseline;
    if (!b) return s;
    return {
      yawDeg: s.yawDeg - b.yawDeg,
      pitchDeg: s.pitchDeg - b.pitchDeg,
      eyeHorizontal: s.eyeHorizontal - b.eyeHorizontal,
      eyeVertical: s.eyeVertical - b.eyeVertical,
    };
  }

  reset(): void {
    this.samples = [];
    this.baseline = null;
  }
}

/**
 * Calibrated gaze decision. While the calibrator is still collecting its first
 * readings this never reports "away" (the student is assumed to be looking at
 * the screen at the start).
 */
export function analyzeGazeCalibrated(
  blendshapes: Blendshapes,
  matrix: ArrayLike<number> | null,
  calibrator: GazeCalibrator,
  t: GazeThresholds = DEFAULT_DEVIATION_THRESHOLDS,
): GazeReading {
  const raw = analyzeGaze(blendshapes, matrix, {
    maxYawDeg: Infinity,
    maxPitchDeg: Infinity,
    maxEyeHorizontal: Infinity,
    maxEyeVertical: Infinity,
  });
  if (!calibrator.ready) {
    calibrator.add(raw);
    return {...raw, lookingAway: false, reason: null};
  }
  const d = calibrator.adjust(raw);
  let reason: GazeReading['reason'] = null;
  if (Math.abs(d.yawDeg) > t.maxYawDeg) reason = 'yaw';
  else if (Math.abs(d.pitchDeg) > t.maxPitchDeg) reason = 'pitch';
  else if (Math.abs(d.eyeHorizontal) > t.maxEyeHorizontal) reason = 'eyes-horizontal';
  else if (Math.abs(d.eyeVertical) > t.maxEyeVertical) reason = 'eyes-vertical';
  return {...d, lookingAway: reason !== null, reason};
}
