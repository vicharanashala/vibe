import React, { useEffect, useRef } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// take handCount as props
interface HandLandmarkerComponentProps {
    filesetResolver: FilesetResolver;
    handCount: number;
    setHandCount: React.Dispatch<React.SetStateAction<number>>;
}

const HandLandmarkerComponent: React.FC<HandLandmarkerComponentProps> = ({ filesetResolver, handCount, setHandCount }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);

    useEffect(() => {
        const initializeHandLandmarker = async () => {

            handLandmarkerRef.current = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "src/models/hand_landmarker.task", 
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 3
            });
        };

        const startWebcam = async () => {
            const video = videoRef.current;
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (video) {
                    video.srcObject = stream;
                    video.play();
                }
            }
        };

        initializeHandLandmarker();
        startWebcam();

        return () => {
            const video = videoRef.current;
            if (video && video.srcObject) {
                const tracks = (video.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;

        const detectHands = async () => {
            if (handLandmarkerRef.current && video && video.readyState === 4) {
                const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());

                if (results && results.landmarks) {
                    setHandCount(results.landmarks.length);
                } else {
                    setHandCount(0);
                }
            }

            requestAnimationFrame(detectHands);
        };

        detectHands();
    }, []);
    

    return (
        <div>
            <h4>Number of Hands Detected: {handCount}</h4>
            <video ref={videoRef} style={{ display: "none" }} />
        </div>
    );
};

export default HandLandmarkerComponent;
