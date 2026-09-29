import { describe, expect, it } from "vitest";
import { FacePresenceStabilizer } from "./facePresenceStabilizer";

describe("FacePresenceStabilizer", () => {
  it("ignores short face-detector dropouts", () => {
    const stabilizer = new FacePresenceStabilizer({
      missingSamplesThreshold: 3,
    });

    expect(stabilizer.update(1)).toBe("present");
    expect(stabilizer.update(0)).toBe("temporarily-missing");
    expect(stabilizer.update(0)).toBe("temporarily-missing");
    expect(stabilizer.update(1)).toBe("present");
  });

  it("confirms a persistent absence after the threshold", () => {
    const stabilizer = new FacePresenceStabilizer({
      missingSamplesThreshold: 3,
    });

    expect(stabilizer.update(0)).toBe("temporarily-missing");
    expect(stabilizer.update(0)).toBe("temporarily-missing");
    expect(stabilizer.update(0)).toBe("confirmed-missing");
    expect(stabilizer.missingSamples).toBe(3);
  });

  it("resets the missing streak as soon as a face is detected", () => {
    const stabilizer = new FacePresenceStabilizer({
      missingSamplesThreshold: 3,
    });

    stabilizer.update(0);
    stabilizer.update(0);
    expect(stabilizer.missingSamples).toBe(2);

    expect(stabilizer.update(1)).toBe("present");
    expect(stabilizer.missingSamples).toBe(0);
    expect(stabilizer.update(0)).toBe("temporarily-missing");
  });

  it("treats multiple faces as face-present for this filter", () => {
    const stabilizer = new FacePresenceStabilizer({
      missingSamplesThreshold: 2,
    });

    expect(stabilizer.update(2)).toBe("present");
    expect(stabilizer.missingSamples).toBe(0);
  });

  it("rejects an invalid threshold", () => {
    expect(
      () => new FacePresenceStabilizer({ missingSamplesThreshold: 0 }),
    ).toThrow("missingSamplesThreshold must be a positive integer");
  });
});
