import React, { useEffect, useState } from "react";
import GestureDetector from "./GestureDetector";
import BlurDetection from "./BlurDetector";
import SpeechDetector from "./SpeechDetector";
import useCameraProcessor from "./useCameraProcessor";
import FaceDetectors from "./FaceDetectors";
import { set } from "date-fns";

const CALM: React.FC = () => {
  const [gestureTrigger, setGestureTrigger] = useState(false);
  const [isBlur, setIsBlur] = useState("No");
  const [isSpeaking, setIsSpeaking] = useState("No");
  const [gesture, setGesture] = useState("No Gesture Detected ❌");
  const [isFocused, setIsFocused] = useState(false);
  const [facesCount, setFacesCount] = useState(0);
  const [penaltyPoints, setPenaltyPoints] = useState(0); // Track cumulative penalty points
  const [penaltyType, setPenaltyType ] = useState("");
  // Load penalty points from local storage on component mount
  useEffect(() => {
    const storedPenaltyPoints = localStorage.getItem("penaltyPoints");
    if (storedPenaltyPoints) {
      setPenaltyPoints(parseInt(storedPenaltyPoints, 10));
      setPenaltyType(localStorage.getItem("penaltyType") || "");
    }
  }, []);

  // console.log("Hello g",localStorage.getItem("penaltyPoints"))

  // Store penalty points in local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("penaltyPoints", penaltyPoints.toString());
    localStorage.setItem("penaltyType", penaltyType.toString());
  }, [penaltyPoints]);

  // Get our videoRef and face data from the custom hook
  const { videoRef, modelReady, faces } = useCameraProcessor(1);

  useEffect(() => {
    if (!modelReady) return;
    setFacesCount(faces.length);
  }, [faces, modelReady]);

  // Check and update the penalty points when any anomaly occurs
  useEffect(() => {
    let newPenaltyPoints = 0;
    let newPenaltyType = "";

    // Condition 1: If speaking is detected
    if (isSpeaking === "Yes") {
      newPenaltyType = "Speaking";
      newPenaltyPoints += 1;
    }

    // Condition 2: If faces count is not exactly 1
    if (facesCount !== 1) {
      newPenaltyType = "Faces Count";
      newPenaltyPoints += 1;
    }

    // Condition 3: If the screen is blurred
    if (isBlur === "Yes") {
      newPenaltyType = "Blur";
      newPenaltyPoints += 1;
    }

    // Condition 4: If not focused
    if (!isFocused) {
      newPenaltyType = "Focus";
      newPenaltyPoints += 1;
    }

    // If there are any new penalty points, increment the cumulative score
    if (newPenaltyPoints > 0) {
      setPenaltyPoints((prevPoints) => prevPoints + newPenaltyPoints);
      setPenaltyType(newPenaltyType);
    }
  }, [isSpeaking, facesCount, isBlur, isFocused]); // Watch for changes to these variables

  // Check if any anomalies are detected
  const isAnomaliesDetected = isSpeaking === "Yes" || facesCount !== 1 || isBlur === "Yes" || !isFocused;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-center mb-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-lg border max-w-full h-auto"
        />
      </div>

      <div className="flex justify-center mb-4">
        <button
          onClick={() => setGestureTrigger((prev) => !prev)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          {gestureTrigger ? "Stop Gesture Detection" : "Start Gesture Detection"}
        </button>
      </div>

      <div className="space-y-4 mb-4">
        <FaceDetectors faces={faces} setIsFocused={setIsFocused} />
        <GestureDetector
          videoRef={videoRef}
          trigger={gestureTrigger}
          setGesture={setGesture}
        />
        <BlurDetection videoRef={videoRef} setIsBlur={setIsBlur} />
        <SpeechDetector setIsSpeaking={setIsSpeaking} />
      </div>

      {/* Flashing text indicating anomalies */}
      {isAnomaliesDetected && (
        <div className="text-center text-2xl font-bold text-red-600 animate-pulse">
          Detected Anomalies! 🚨
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xl font-bold">Results</h2>
        <div className="text-lg">
          <p>Blur (): {isBlur}</p>
          <p>Speaking: {isSpeaking}</p>
          <p>Gesture: {gesture}</p>
          <p>Focus: {isFocused ? "Focused" : "Not Focused"}</p>
          <p>Face Count: {facesCount}</p>
        </div>

        {/* Display cumulative penalty points */}
        <div className="text-lg mt-4">
          <p className="font-bold">Penalty Score: {penaltyPoints}</p>
        </div>
      </div>
    </div>
  );
};

export default CALM;
