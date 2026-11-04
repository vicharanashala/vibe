/**
 * Filters short-lived face-detector dropouts before they become proctoring
 * anomalies. Camera/model inference can occasionally miss a face for a few
 * samples even when the learner has not actually left the frame.
 */
export type FacePresenceState =
  | "present"
  | "temporarily-missing"
  | "confirmed-missing";

export interface FacePresenceStabilizerOptions {
  /** Number of consecutive zero-face samples required to confirm absence. */
  missingSamplesThreshold?: number;
}

export class FacePresenceStabilizer {
  private readonly missingSamplesThreshold: number;
  private consecutiveMissingSamples = 0;

  constructor(options: FacePresenceStabilizerOptions = {}) {
    const threshold = options.missingSamplesThreshold ?? 5;

    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error("missingSamplesThreshold must be a positive integer");
    }

    this.missingSamplesThreshold = threshold;
  }

  update(faceCount: number): FacePresenceState {
    if (faceCount > 0) {
      this.consecutiveMissingSamples = 0;
      return "present";
    }

    this.consecutiveMissingSamples += 1;

    if (this.consecutiveMissingSamples >= this.missingSamplesThreshold) {
      return "confirmed-missing";
    }

    return "temporarily-missing";
  }

  reset(): void {
    this.consecutiveMissingSamples = 0;
  }

  get missingSamples(): number {
    return this.consecutiveMissingSamples;
  }
}
