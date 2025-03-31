import React from "react";
import useCameraProcessor from "./useCameraProcessor";
import { Face, Keypoint } from "@tensorflow-models/face-detection";

const isLookingAway = (face: Face): boolean => {
  if (!face || face.keypoints.length < 6) return false;

  // ✅ Extract keypoints safely
  const rightEye = face.keypoints.find((p: Keypoint) => p.name === "rightEye");
  const leftEye = face.keypoints.find((p: Keypoint) => p.name === "leftEye");
  const noseTip = face.keypoints.find((p: Keypoint) => p.name === "noseTip");
  const rightEar = face.keypoints.find((p: Keypoint) => p.name === "rightEarTragion");
  const leftEar = face.keypoints.find((p: Keypoint) => p.name === "leftEarTragion");

  if (!rightEye || !leftEye || !noseTip || !rightEar || !leftEar || !face.box) return false;

  const faceWidth = face.box.width; // ✅ Normalize distances using face width

  // ✅ Normalized Eye Distance (distance between eyes relative to face width)
  const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth;

  // ✅ Nose Position Ratio: Nose should be centered between eyes
  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
  const noseRatio = noseToLeftEye / (noseToLeftEye + noseToRightEye); // ✅ Normalized nose position (0-1)

  // ✅ Ear Visibility Ratio: If one ear is much farther, head is turned
  const rightEarDist = Math.abs(rightEar.x - rightEye.x);
  const leftEarDist = Math.abs(leftEar.x - leftEye.x);
  const earVisibilityRatio = Math.min(rightEarDist, leftEarDist) / Math.max(rightEarDist, leftEarDist); // ✅ (0-1)

  // ✅ Debugging logs
  console.log({
    faceWidth,
    eyeDistance,
    noseRatio,
    rightEarDist,
    leftEarDist,
    earVisibilityRatio,
  });

  // ✅ Apply Thresholds:
  if (eyeDistance < 0.25) return true; // Eyes too close → Possible Side Look
  if (noseRatio < 0.4 || noseRatio > 0.6) return true; // Nose shifted → Possible Head Turn
  if (earVisibilityRatio < 0.5) return true; // One ear is much more visible than the other

  return false;
};


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
              <p></p>
              {/* ✅ Keypoints Table */}
              {faces.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table-auto border-collapse border border-gray-300 mx-auto">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-300 px-4 py-2">Face #</th>
                        <th className="border border-gray-300 px-4 py-2">Keypoint</th>
                        <th className="border border-gray-300 px-4 py-2">X</th>
                        <th className="border border-gray-300 px-4 py-2">Y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faces.map((face, faceIndex) => (
                        <React.Fragment key={faceIndex}>
                          {face.keypoints.map((point, index) => (
                            <tr key={`${faceIndex}-${index}`} className="border border-gray-300">
                              <td className="border border-gray-300 px-4 py-2 text-center">{faceIndex + 1}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{point.name}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{point.x.toFixed(2)}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{point.y.toFixed(2)}</td>
                            </tr>
                          ))}
                          {/* ✅ Row to indicate if the person is looking away */}
                          <tr className="bg-gray-100">
                            <td colSpan={4} className="text-center font-bold px-4 py-2">
                              {isLookingAway(face) ? "Looking Away ❌" : "Looking Straight ✅"}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

