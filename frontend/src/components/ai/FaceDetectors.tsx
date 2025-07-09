import React, { useEffect } from "react";
import { Face, Keypoint } from "@tensorflow-models/face-detection";
import FaceRecognitionComponent from "./FaceRecognitionComponent";

import type { FaceDetectorsProps, FaceRecognition, FaceRecognitionDebugInfo } from "@/types/ai.types";

const isLookingAway = (face: Face): boolean => {
  if (!face || face.keypoints.length < 6) return false;

  const rightEye = face.keypoints.find((p: Keypoint) => p.name === "rightEye");
  const leftEye = face.keypoints.find((p: Keypoint) => p.name === "leftEye");
  const noseTip = face.keypoints.find((p: Keypoint) => p.name === "noseTip");
  const mouth = face.keypoints.find((p: Keypoint) => p.name === "mouthCenter");
  const rightEar = face.keypoints.find((p: Keypoint) => p.name === "rightEarTragion");
  const leftEar = face.keypoints.find((p: Keypoint) => p.name === "leftEarTragion");

  if (!rightEye || !leftEye || !noseTip || !rightEar || !leftEar || !face.box) return false;

  const faceWidth = face.box.width;
  const faceHeight = face.box.height;
  const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth / Math.pow(faceHeight, 0.1)*1.7;
  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
  const noseRatio = noseToLeftEye / (noseToLeftEye + noseToRightEye);
  const rightEarDist = Math.abs(rightEar.x - rightEye.x);
  const leftEarDist = Math.abs(leftEar.x - leftEye.x);
  const earVisibilityRatio = rightEarDist / (rightEarDist + leftEarDist);
  // const mouthEyeDistance = Math.abs(rightEye.y / 2 + leftEye.y / 2 - mouth.y) / faceHeight;
  console.log("[param] height:", faceHeight);

  if (eyeDistance < 0.35) {
    console.log('[Trigger] Eye distance is too small:', eyeDistance);
    return true;
  }
  if (noseRatio < 0.35 || noseRatio > 0.65) {
    console.log('[Trigger] Nose ratio is out of bounds:', noseRatio);
    return true;
  }
  if (earVisibilityRatio < 0.4 || earVisibilityRatio > 0.6){
    console.log('[Trigger] Ear visibility ratio is out of bounds:', earVisibilityRatio);
    return true;
  }

  return false;
};

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces, videoRef, onRecognitionResult, onDebugInfoUpdate }) => {

  useEffect(() => {
    const isFocused = !isLookingAway(faces[0]);
    if (faces.length === 0) return setIsFocused(false);
    setIsFocused(isFocused);
  }, [faces, setIsFocused]);

  // Debug log
  useEffect(() => {
    // console.log('🎭 [FaceDetectors] Component rendered with:', {
    //   facesCount: faces.length,
    //   hasVideoRef: !!videoRef.current,
    //   hasCallback: !!onRecognitionResult,
    //   hasDebugCallback: !!onDebugInfoUpdate
    // });
  }, [faces.length, videoRef, onRecognitionResult, onDebugInfoUpdate]);

  return (
    <>
      {/* Face Recognition Component */}
      <FaceRecognitionComponent
        faces={faces}
        videoRef={videoRef}
        onRecognitionResult={onRecognitionResult}
        onDebugInfoUpdate={onDebugInfoUpdate}
      />
    </>
  );
};

export default FaceDetectors;
