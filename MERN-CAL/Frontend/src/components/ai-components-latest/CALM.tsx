import React, { useEffect, useState } from "react";
import GestureDetector from "./GestureDetector";
import BlurDetection from "./BlurDetector";
import SpeechDetector from "./SpeechDetector";
import useCameraProcessor from "./useCameraProcessor";
import FaceDetectors from "./FaceDetectors";

const CALM: React.FC = () => {
  const [gestureTrigger, setGestureTrigger] = useState(false);
  const [isBlur, setIsBlur] = useState("No");
  const [isSpeaking, setIsSpeaking] = useState("No");
  const [gesture, setGesture] = useState("No Gesture Detected ❌");
  const [isFocused, setIsFocused] = useState(false);
  const [facesCount, setFacesCount] = useState(0);
  const { videoRef, modelReady, faces } = useCameraProcessor(1);

  useEffect(() => {
    if (!modelReady) return;

    setFacesCount(faces.length);

  }, [faces, modelReady]);


  return (
    <div>
      <h1>Welcome to CALM Proctoring</h1>
      <p>This is a simple React component.</p>
      <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-lg border"
        />
      <button
          onClick={() => setGestureTrigger((prev) => !prev)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          {gestureTrigger
            ? "Stop Gesture Detection"
            : "Start Gesture Detection"}
        </button>
        <FaceDetectors faces={faces} setIsFocused={setIsFocused}/>
        <GestureDetector videoRef={videoRef} trigger={gestureTrigger} setGesture={setGesture}/>
        <BlurDetection videoRef={videoRef} setIsBlur={setIsBlur} />
        <SpeechDetector setIsSpeaking={setIsSpeaking} ></SpeechDetector>

        <h2>Results</h2>
        <p>Blur: {isBlur}</p>
        <p>Speaking: {isSpeaking}</p>
        <p>Gesture: {gesture}</p>
        <p>Focus: {isFocused ? "Focused" : "Not Focused"}</p>
        <p>Face Count: {facesCount}</p>

    </div>
  );
};

export default CALM;