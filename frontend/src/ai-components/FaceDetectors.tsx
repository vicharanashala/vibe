import React, { useEffect } from "react";
import { Face, Keypoint } from "@tensorflow-models/face-detection";
import FaceRecognitionComponent, { FaceRecognition, FaceRecognitionDebugInfo } from "./FaceRecognitionComponentNoWorker";

interface FaceDetectorsProps {
  faces: Face[],
  setIsFocused: (focused: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRecognitionResult?: (recognitions: FaceRecognition[]) => void;
  onDebugInfoUpdate?: (debugInfo: FaceRecognitionDebugInfo) => void;
  settings:{
    isFaceCountDetectionEnabled:boolean, 
    isFaceRecognitionEnabled:boolean, 
    isFocusEnabled: boolean
  }
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

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces, videoRef, onRecognitionResult, onDebugInfoUpdate }) => {

  useEffect(() => {
    const isFocused = !isLookingAway(faces[0]);
    if(faces.length === 0) return setIsFocused(false);
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
