import React, { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { handleSaveSnapshot } from "../../lib/snapUtils";

const PoseLandmarkerComponent = ({filesetResolver}) => {
    const videoRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const lookAwayCountRef = useRef(0);
    const [status, setStatus] = useState('User not detected');
    const [noseEyeDistance, setNoseEyeDistance] = useState(0);
    const [lookAwayCount, setLookAwayCount] = useState(0);
    const [numPeople, setNumPeople] = useState(0);

    useEffect(() => {
        const initializePoseLandmarker = async () => {

            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "src/models/pose_landmarker_lite.task", 
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 2
            });
        };

        const startWebcam = async () => {
            const video = videoRef.current;
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                video.play();
            }
        };

        initializePoseLandmarker();
        startWebcam();

        return () => {
            const video = videoRef.current;
            if (video && video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;

        const detectLandmarks = async () => {
            if (poseLandmarkerRef.current && video.readyState === 4) {
                const landmarks = await poseLandmarkerRef.current.detectForVideo(video, performance.now());
                
                if (landmarks && landmarks.landmarks[0]) {
                    setNumPeople(landmarks.landmarks.length);                 
                  // checking if the person's face is in the middle of the fame
                  const nose = landmarks.landmarks[0][0]
                  if (nose) {
                    const videoWidth = video.videoWidth;
                    const videoHeight = video.videoHeight;

                    const box = {
                        left: videoWidth / 4,
                        right: (videoWidth * 3) / 4,
                        top: videoHeight / 4,
                        bottom: (videoHeight * 3) / 4
                    };

                    const noseX = nose.x * videoWidth;
                    const noseY = nose.y * videoHeight;

                    const isInBox = 
                        noseX >= box.left &&
                        noseX <= box.right &&
                        noseY >= box.top &&
                        noseY <= box.bottom;

                    isInBox ? setStatus("User is in box") : setStatus("User is not in box")
                 }
                 const leftEye = landmarks.landmarks[0][2];
                 const rightEye = landmarks.landmarks[0][5];
                 const eyeDiff = Math.abs(leftEye.x - rightEye.x); // Difference in X positions of eyes
                 if (eyeDiff < 0.070) {
                   lookAwayCountRef.current++;
                   if(lookAwayCountRef.current % 1000 == 0 && lookAwayCount.current != 0){
                    handleSaveSnapshot({anomalyType: "not focusing", video: videoRef.current})
                   }
                   setLookAwayCount(lookAwayCountRef.current);
                   setStatus('Focus on the lecture!');
                 }
                } else {
                  setStatus("User not detected.")
                }
            }

            requestAnimationFrame(detectLandmarks);
        };

        detectLandmarks();
    }, []);

    useEffect(() => {
        for(let i = 0; i<3; i++){
            if(numPeople>1){
                handleSaveSnapshot({anomalyType: "multiple people", video: videoRef.current});
            }
        }
    }, [numPeople]);

    return (
        <div>
            <video ref={videoRef} style={{ display: "none" }} />
            <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '14px' }}>
              <h4>People Count: {numPeople}</h4>
              <h4>Status: {status}</h4>
              <p>Look Away Count: {lookAwayCount} ms</p>
            </div>
        </div>
    );
};

export default PoseLandmarkerComponent;
