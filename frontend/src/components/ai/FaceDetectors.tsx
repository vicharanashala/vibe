import React, { useEffect } from "react";
import { Face, Keypoint } from "@tensorflow-models/face-detection";
import FaceRecognitionComponent from "./FaceRecognitionComponent";

import type { FaceDetectorsProps, FaceRecognition, FaceRecognitionDebugInfo } from "@/types/ai.types";

const isLookingAway = (face: Face): boolean => {
  if (!face || !face.keypoints || face.keypoints.length < 6 || !face.box) return false;

  const rightEye = face.keypoints.find((p: Keypoint) => p.name === "rightEye");
  const leftEye = face.keypoints.find((p: Keypoint) => p.name === "leftEye");
  const noseTip = face.keypoints.find((p: Keypoint) => p.name === "noseTip");
  // const mouth = face.keypoints.find((p: Keypoint) => p.name === "mouthCenter");
  const rightEar = face.keypoints.find((p: Keypoint) => p.name === "rightEarTragion");
  const leftEar = face.keypoints.find((p: Keypoint) => p.name === "leftEarTragion");

  if (!rightEye || !leftEye || !noseTip) return false;

  const faceWidth = face.box.width;
  const faceHeight = face.box.height;
  const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth / Math.pow(faceHeight, 0.1)*1.7;
  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
  const noseRatio = Math.min(noseToLeftEye, noseToRightEye) / Math.max(noseToLeftEye, noseToRightEye) * Math.pow(faceHeight, 0.2)/Math.pow(200, 0.2);
  let earVisibilityRatio = 0;
  if (!rightEar || !leftEar) earVisibilityRatio = 1; 
  else {
    const rightEarDist = Math.abs(rightEar.x - rightEye.x);
    const leftEarDist = Math.abs(leftEar.x - leftEye.x);
    earVisibilityRatio = Math.min(rightEarDist, leftEarDist) / Math.max(rightEarDist, leftEarDist) * Math.pow(faceHeight, 0.3)/Math.pow(200, 0.3);
  }
  // const mouthEyeDistance = Math.abs(rightEye.y / 2 + leftEye.y / 2 - mouth.y) / faceHeight;
  // console.log("[trigger] eye dist", eyeDistance, "nose ratio", noseRatio, "ear visibility ratio", earVisibilityRatio, "face width", faceWidth);

  if (eyeDistance < 0.35) {
    return true;
  }
  if (noseRatio < 0.47) {
    return true;
  }
  if (earVisibilityRatio < 0.47){
    return true;
  }

  return false;
};

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces, videoRef, onRecognitionResult, onDebugInfoUpdate, onMismatchChange, onBehaviorResult, demoMode }) => {

  useEffect(() => {
    if (faces.length === 0) {
      setIsFocused(false);
      return;
    }

    const primaryFace = faces.reduce<Face | null>((largest, current) => {
      if (!current.box) {
        return largest;
      }

      const currentArea = current.box.width * current.box.height;
      const largestArea = largest?.box ? largest.box.width * largest.box.height : -1;
      return currentArea > largestArea ? current : largest;
    }, null);

    if (!primaryFace) {
      setIsFocused(false);
      return;
    }

    setIsFocused(!isLookingAway(primaryFace));
  }, [faces, setIsFocused]);

  // Debug log
  useEffect(() => {
    // console.log('🎭 [FaceDetectors] Component rendered with:', {
    //   facesCount: faces.length,
    //   hasVideoRef: !!videoRef.current,
    //   hasCallback: !!onRecognitionResult,
    //   hasDebugCallback: !!onDebugInfoUpdate,
    //   hasBehaviorCallback: !!onBehaviorResult
    // });
  }, [faces.length, videoRef, onRecognitionResult, onDebugInfoUpdate, onBehaviorResult]);

  return (
    <>
      {/* Face Recognition Component */}
      <FaceRecognitionComponent
        faces={faces}
        videoRef={videoRef}
        onRecognitionResult={onRecognitionResult}
        onDebugInfoUpdate={onDebugInfoUpdate}
        onMismatchChange={onMismatchChange}
        onBehaviorResult={onBehaviorResult}
        demoMode={demoMode}
      />
    </>
  );
};

export default FaceDetectors;
