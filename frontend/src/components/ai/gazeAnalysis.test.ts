import { describe, expect, it } from "vitest";
import { analyzeGaze, GazeDebouncer } from "./gazeAnalysis";

// Identity rotation (frontal face), column-major 4x4.
const frontal = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function yawMatrix(deg: number) {
  const r = (deg * Math.PI) / 180;
  // Rotation about Y, column-major: R[0][2] = sin, R[2][2] = cos
  return [Math.cos(r), 0, -Math.sin(r), 0, 0, 1, 0, 0, Math.sin(r), 0, Math.cos(r), 0, 0, 0, 0, 1];
}

describe("analyzeGaze", () => {
  it("frontal, centered eyes is not looking away", () => {
    expect(analyzeGaze({}, frontal).lookingAway).toBe(false);
  });

  it("flags a large head turn", () => {
    const r = analyzeGaze({}, yawMatrix(50));
    expect(r.lookingAway).toBe(true);
    expect(r.reason).toBe("yaw");
  });

  it("flags eyes pointing sideways with a frontal head", () => {
    const r = analyzeGaze(
      { eyeLookOutLeft: 0.9, eyeLookInRight: 0.9 },
      frontal,
    );
    expect(r.reason).toBe("eyes-horizontal");
  });
});

describe("GazeDebouncer", () => {
  it("only violates after sustained look-away and clears after looking back", () => {
    const d = new GazeDebouncer(2000, 500);
    expect(d.update(true, 0)).toBe(false);
    expect(d.update(true, 1999)).toBe(false);
    expect(d.update(true, 2000)).toBe(true);
    expect(d.update(false, 2100)).toBe(true);
    expect(d.update(false, 2600)).toBe(false);
  });

  it("a brief glance resets the timer", () => {
    const d = new GazeDebouncer(2000, 500);
    d.update(true, 0);
    d.update(false, 1000);
    expect(d.update(true, 1500)).toBe(false);
    expect(d.update(true, 3000)).toBe(false);
  });
});
