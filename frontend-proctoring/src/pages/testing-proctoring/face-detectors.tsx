import React from "react";
import useCameraProcessor from "./useCameraProcessor";

const FaceDetectors: React.FC = () => {
  const { videoRef, modelReady, faces } = useCameraProcessor(1);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold text-center mb-4">Webcam Capture</h1>
      <div className="flex flex-col items-center space-y-4">
        <video ref={videoRef} autoPlay playsInline className="rounded-lg shadow-lg border" />
        <div className="container mx-auto p-4">
          <h1 className="text-xl font-bold text-center mb-4">Face Detector with Worker</h1>
          {modelReady ? (
            <>
              <p className="text-green-600 text-center">Model is ready!</p>
              <p className="text-center">Number of faces detected: {faces.length}</p>
            </>
          ) : (
            <p className="text-red-600 text-center">Loading model...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceDetectors;

