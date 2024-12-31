import React, { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const HandLandmarkerComponent = ({filesetResolver}) => {
    const videoRef = useRef(null);
    const handLandmarkerRef = useRef(null);
    const [handCount, setHandCount] = useState(0);
    const [gesture, setGesture] = useState("None");

    // function to check whether a particular finger is raised.
    const isRaised = (landmarks, fingerNumber) => {
        // Each finger has MCP (knuckle), PIP, DIP and TIP landmarks.
        // when the y coordinate monotonically increases from MCP to TIP, we say that the finger is raised.
        let y_coord = landmarks[0].y;
        let index = fingerNumber*4+1; // index initially points to the MCP of the given finger.
        for (index; index < fingerNumber*4+5; index++){
            if(y_coord < landmarks[index].y) {
                return false;
            }
            y_coord = landmarks[index].y
        }
        // we add the additional condition that the angle of the finger wrt horizontal is greater than arctan(2)        
        if(Math.abs(landmarks[index-1].y - landmarks[index-3].y) < 2*Math.abs(landmarks[index-1].x - landmarks[index-3].x)){
            return false;
        }
        return true;
    }

    const isExtended = (landmarks) => {
        let x_coord = landmarks[0].x; // x coordinate of wrist
        let index = 1;
        if(landmarks[index].x>x_coord){
            // if x of MCP is greater than that of wrist, it must further increase from MCP to TIP.
            for (index; index < 5; index++){
                if(x_coord > landmarks[index].x) {
                    return false;
                }
                x_coord = landmarks[index].x
            }
        } else {
            // if x of MCP is less than that of wrist, it must further decrease from MCP to TIP.
            for (index; index < 5; index++){
                if(x_coord < landmarks[index].x) {
                    return false;
                }
                x_coord = landmarks[index].x
            }
        }
        return true;
    }
    
    const isDown = (landmarks) => {
        let y_coord = landmarks[0].y;
        let index = 1;
        for (index; index < 5; index++){
            if(y_coord > landmarks[index].y) {
                return false;
            }
            y_coord = landmarks[index].y
        }
        if(Math.abs(landmarks[index-1].y - landmarks[index-3].y) < Math.abs(landmarks[index-1].x - landmarks[index-3].x)){
            return false;
        }
        return true;
    }

    const getRaisedFingers = (landmarks) => {
        let numRaised = 0;
        for(let i = 1; i<5;i++){
            if(isRaised(landmarks, i)){
                console.log(i+" is raised")
                numRaised ++;
            }
        }
        return numRaised;
    }

    const checkThumb = (landmarks) => {
        if(isRaised(landmarks, 0)){
            return "Thumbs Up"
        } else if(isDown(landmarks)){
            return "Thumbs Down"
        } else if(isExtended(landmarks)){
            return "Thumb Extended"
        } else {
            return false;
        }
    }

    const getGesture = (landmarks) => {
        const numRaised = getRaisedFingers(landmarks);
        if(numRaised && numRaised != 4){
            return numRaised;
        }
        const thumbStatus = checkThumb(landmarks);
        if(!thumbStatus){
            return numRaised;
        }
        if(numRaised == 4){
            if((thumbStatus == "Thumb Extended" || thumbStatus == "Thumbs Up")&&((landmarks[4].x<landmarks[5].x && landmarks[5].x<landmarks[9].x) || (landmarks[4].x>landmarks[5].x && landmarks[5].x>landmarks[9].x))) {
                // if thumb is outside the palm
                return 5;
            } else {
                return 4;
            }
        }
        return thumbStatus;
    }

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
                video.srcObject = stream;
                video.play();
            }
        };

        initializeHandLandmarker();
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

        const detectHands = async () => {
            if (handLandmarkerRef.current && video.readyState === 4) {
                const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());

                if (results && results.landmarks) {
                    setHandCount(results.landmarks.length);
                    if(handCount>2){
                        console.log(handCount, " hands are present in the feed.")
                    }
                    if(results.landmarks[0]){
                        setGesture(getGesture(results.landmarks[0]));
                    }
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
            <h1>Number of Hands Detected: {handCount}</h1>
            <h1>Gesture: {gesture}</h1>
            <video ref={videoRef} style={{ display: "none" }} />
        </div>
    );
};

export default HandLandmarkerComponent;
