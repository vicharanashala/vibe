import React, { useEffect } from "react";
import FaceRecognitionComponent from "./FaceRecognitionComponent";

import type { FaceDetectorsProps } from "@/types/ai.types";

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces, videoRef, onRecognitionResult, onDebugInfoUpdate, onMismatchChange, settings }) => {

  useEffect(() => {
    const isFocused = true;
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
      {settings.isFaceRecognitionEnabled && (
        <FaceRecognitionComponent
          faces={faces}
          videoRef={videoRef}
          onRecognitionResult={onRecognitionResult}
          onDebugInfoUpdate={onDebugInfoUpdate}
          onMismatchChange={onMismatchChange}
        />
      )}
    </>
  );
};

export default FaceDetectors;
