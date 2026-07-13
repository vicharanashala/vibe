import { describe, it, expect } from 'vitest';
import type { Face } from '@tensorflow-models/face-detection';

// Re-declare the isLookingAway function exactly as defined in FaceDetectors.tsx to run in Node environment
const isLookingAway = (face: Face): boolean => {
  if (!face || face.keypoints.length < 6) return false;

  const rightEye = face.keypoints.find((p) => p.name === 'rightEye');
  const leftEye = face.keypoints.find((p) => p.name === 'leftEye');
  const noseTip = face.keypoints.find((p) => p.name === 'noseTip');
  const rightEar = face.keypoints.find((p) => p.name === 'rightEarTragion');
  const leftEar = face.keypoints.find((p) => p.name === 'leftEarTragion');

  if (!rightEye || !leftEye || !noseTip || !face.box) return false;

  const faceWidth = face.box.width;
  const faceHeight = face.box.height;
  const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth / Math.pow(faceHeight, 0.1) * 1.7;
  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
  const noseRatio = Math.min(noseToLeftEye, noseToRightEye) / Math.max(noseToLeftEye, noseToRightEye) * Math.pow(faceHeight, 0.2) / Math.pow(200, 0.2);
  
  let earVisibilityRatio = 0;
  if (!rightEar || !leftEar) earVisibilityRatio = 1;
  else {
    const rightEarDist = Math.abs(rightEar.x - rightEye.x);
    const leftEarDist = Math.abs(leftEar.x - leftEye.x);
    earVisibilityRatio = Math.min(rightEarDist, leftEarDist) / Math.max(rightEarDist, leftEarDist) * Math.pow(faceHeight, 0.3) / Math.pow(200, 0.3);
  }

  if (eyeDistance < 0.35) return true;
  if (noseRatio < 0.47) return true;
  if (earVisibilityRatio < 0.47) return true;

  return false;
};

// Re-declare stillness and blink check math as defined in LivenessDetector.tsx
const checkStillness = (trail: { x: number; y: number }[], faceWidth: number): boolean => {
  if (trail.length < 5) return false;
  let maxDeviation = 0;
  const originX = trail[0].x;
  const originY = trail[0].y;
  for (const sample of trail) {
    const dx = (sample.x - originX) / faceWidth;
    const dy = (sample.y - originY) / faceWidth;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDeviation) maxDeviation = dist;
  }
  return maxDeviation < 0.01; // stillness threshold
};

const checkFreezeFrame = (eyeCoords: number[]): boolean => {
  if (eyeCoords.length < 5) return false;
  const mean = eyeCoords.reduce((a, b) => a + b, 0) / eyeCoords.length;
  const variance = eyeCoords.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / eyeCoords.length;
  return variance < 0.000002; // freeze frame/photo threshold
};

describe('Liveness Detection & Head-turn Math Tests', () => {
  describe('isLookingAway Geometry Check', () => {
    const createBaseFace = (): Face => ({
      box: { xMin: 100, yMin: 100, width: 200, height: 200 },
      keypoints: [
        { x: 150, y: 150, name: 'leftEye' },
        { x: 250, y: 150, name: 'rightEye' },
        { x: 200, y: 200, name: 'noseTip' },
        { x: 200, y: 250, name: 'mouthCenter' },
        { x: 120, y: 150, name: 'leftEarTragion' },
        { x: 280, y: 150, name: 'rightEarTragion' },
      ],
    });

    it('should return false when student is looking straight at the camera', () => {
      const face = createBaseFace();
      expect(isLookingAway(face)).toBe(false);
    });

    it('should return true when eye distance is too narrow (turned sideways)', () => {
      const face = createBaseFace();
      // Move eyes closer to simulate sideways perspective
      face.keypoints[0].x = 180;
      face.keypoints[1].x = 220;
      expect(isLookingAway(face)).toBe(true);
    });

    it('should return true when nose is shifted off-center (horizontal head turn)', () => {
      const face = createBaseFace();
      // Shift nose towards the left eye
      face.keypoints[2].x = 160;
      expect(isLookingAway(face)).toBe(true);
    });

    it('should return true when one ear is hidden or visibility ratio is low', () => {
      const face = createBaseFace();
      // Move left ear extremely close to the left eye (simulating profiles where ear overlaps)
      face.keypoints[4].x = 148;
      expect(isLookingAway(face)).toBe(true);
    });
  });

  describe('Stillness Detection Math', () => {
    it('should flag stillness if coordinates have virtually zero deviation', () => {
      const trail = [
        { x: 200, y: 200 },
        { x: 200.5, y: 200.2 },
        { x: 200.2, y: 200.1 },
        { x: 200.1, y: 200.3 },
        { x: 200.3, y: 200.1 },
      ];
      expect(checkStillness(trail, 200)).toBe(true);
    });

    it('should NOT flag stillness if coordinates drift showing natural user movement', () => {
      const trail = [
        { x: 200, y: 200 },
        { x: 204, y: 203 },
        { x: 208, y: 206 },
        { x: 211, y: 210 },
        { x: 215, y: 212 },
      ];
      expect(checkStillness(trail, 200)).toBe(false);
    });
  });

  describe('Freeze-frame / Static Photo Detection Math', () => {
    it('should flag freeze-frame when coordinates do not change at all', () => {
      const eyeCoords = [0.25, 0.25, 0.25, 0.25, 0.25];
      expect(checkFreezeFrame(eyeCoords)).toBe(true);
    });

    it('should NOT flag freeze-frame when coordinates show minor variance/sensor noise', () => {
      const eyeCoords = [0.25, 0.252, 0.248, 0.253, 0.247, 0.251, 0.249];
      expect(checkFreezeFrame(eyeCoords)).toBe(false);
    });
  });
});
