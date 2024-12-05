import React, { useEffect, useRef, useState } from "react";

// Define the type for calibration positions
interface CalibrationPosition {
    x: number;
    y: number;
}

const EyeTrackingWithWebGazer: React.FC = () => {
    const [status, setStatus] = useState<string>("Initializing...");
    const [inViewport, setInViewport] = useState<boolean>(true);
    const [showMessage, setShowMessage] = useState<boolean>(true);

    const calibrationCounterRef = useRef<number>(0);
    const totalCalibrationPoints = 9;
    const calibrationPositions: CalibrationPosition[] = [
        { x: 0.2, y: 0.2 },
        { x: 0.5, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.2, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0.8, y: 0.5 },
        { x: 0.2, y: 0.8 },
        { x: 0.5, y: 0.8 },
        { x: 0.8, y: 0.8 },
    ];

    useEffect(() => {
        const initializeWebGazer = async () => {
            setStatus("WebGazer.js initialized. Starting calibration...");

            if (typeof window.webgazer !== "undefined") {
                window.webgazer
                    .setRegression("ridge")
                    .setGazeListener((data, elapsedTime) => {
                        if (!data) return;

                        const x = data.x; // Gaze x-coordinate
                        const y = data.y; // Gaze y-coordinate
                        const screenWidth = window.innerWidth;
                        const screenHeight = window.innerHeight;

                        const horizontalThreshold = screenWidth / 6;
                        const verticalThreshold = screenHeight / 6;

                        let gazeHorizontal = false, gazeVertical = false;

                        // Horizontal Gaze Direction
                        gazeHorizontal = x > screenWidth / 2 - horizontalThreshold && x < screenWidth / 2 + horizontalThreshold;

                        // Vertical Gaze Direction
                        gazeVertical = y > screenHeight / 2 - verticalThreshold && y < screenHeight / 2 + verticalThreshold;

                        if (gazeHorizontal && gazeVertical) {
                            setInViewport(true);
                        } else {
                            setInViewport(false);
                        }
                    })
                    .saveDataAcrossSessions(true)
                    .begin();

                window.webgazer.showVideo(false);
                window.webgazer.showPredictionPoints(false); // Hide the red dot
            } else {
                console.error("WebGazer is not loaded.");
                setStatus("Error: WebGazer.js not found.");
            }
        };

        initializeWebGazer();

        return () => {
            if (typeof window.webgazer !== "undefined") {
                window.webgazer.end();
            }
        };
    }, []);

    const startCalibration = () => {
        setStatus("Calibration in progress...");
        setTimeout(() => {
            showCalibrationPoint();
        }, 2000); // Adjust delay as needed to ensure camera starts
    };

    const showCalibrationPoint = () => {
        if (calibrationCounterRef.current >= totalCalibrationPoints) {
            setStatus("Calibration complete. Tracking gaze...");
            return;
        }

        const position = calibrationPositions[calibrationCounterRef.current];
        const x = position.x * window.innerWidth;
        const y = position.y * window.innerHeight;

        const calibrationDot = document.createElement("div");
        calibrationDot.style.position = "absolute";
        calibrationDot.style.width = "30px";
        calibrationDot.style.height = "30px";
        calibrationDot.style.backgroundColor = "green";
        calibrationDot.style.borderRadius = "50%";
        calibrationDot.style.left = `${x - 15}px`;
        calibrationDot.style.top = `${y - 15}px`;
        calibrationDot.style.zIndex = "1000";
        calibrationDot.style.pointerEvents = "none";

        document.body.appendChild(calibrationDot);

        setTimeout(() => {
            if (typeof window.webgazer !== "undefined") {
                window.webgazer.recordScreenPosition(x, y, "click");
            }

            document.body.removeChild(calibrationDot);
            calibrationCounterRef.current++;
            showCalibrationPoint();
        }, 1500); // Adjust duration as needed
    };

    const handleAccept = () => {
        setShowMessage(false);
        startCalibration();
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
            {showMessage ? (
                <div>
                    <p>Please look at the green dot for calibration.</p>
                    <button onClick={handleAccept}>Accept</button>
                </div>
            ) : (
                <div style={{ marginTop: '10px' }}>
                    (Gaze Detection) Status: {status}, In Viewport: {inViewport.toString()}
                </div>
            )}
        </div>
    );
};

export default EyeTrackingWithWebGazer;
