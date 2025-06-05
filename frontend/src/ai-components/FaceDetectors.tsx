import React, { useEffect } from "react";
import { Face, Keypoint } from "@tensorflow-models/face-detection";

interface FaceDetectorsProps {
  faces: Face[],
  setIsFocused: (focused: boolean) => void;
}

const isLookingAway = (face: Face): boolean => {
  if (!face || face.keypoints.length < 6) return false;

  const rightEye = face.keypoints.find((p: Keypoint) => p.name === "rightEye");
  const leftEye = face.keypoints.find((p: Keypoint) => p.name === "leftEye");
  const noseTip = face.keypoints.find((p: Keypoint) => p.name === "noseTip");
  const rightEar = face.keypoints.find((p: Keypoint) => p.name === "rightEarTragion");
  const leftEar = face.keypoints.find((p: Keypoint) => p.name === "leftEarTragion");

  if (!rightEye || !leftEye || !noseTip || !rightEar || !leftEar || !face.box) return false;

  const faceWidth = face.box.width;
  const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth;
  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
  const noseRatio = noseToLeftEye / (noseToLeftEye + noseToRightEye);
  const rightEarDist = Math.abs(rightEar.x - rightEye.x);
  const leftEarDist = Math.abs(leftEar.x - leftEye.x);
  const earVisibilityRatio = Math.min(rightEarDist, leftEarDist) / Math.max(rightEarDist, leftEarDist);

  if (eyeDistance < 0.25) return true;
  if (noseRatio < 0.4 || noseRatio > 0.6) return true;
  if (earVisibilityRatio < 0.5) return true;

  return false;
};

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces }) => {

  useEffect(() => {

    const isFocused = !isLookingAway(faces[0]);
    if(faces.length === 0) return setIsFocused(false);
    setIsFocused(isFocused);
  }, [faces, setIsFocused]);

  return null; // No HTML rendering
};

export default FaceDetectors;
