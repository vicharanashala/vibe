import React, { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const MultiPersonDetection = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [peopleCount, setPeopleCount] = useState(0);
    const alertTriggered = useRef(false); // Track if the alert was triggered

    
    useEffect(() => {
        // Set up webcam feed
        const setupCamera = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            await new Promise((resolve) => {
                videoRef.current.onloadedmetadata = () => {
                    resolve();
                };
            });
            videoRef.current.play();
        };

        // Load YOLO model (COCO-SSD in this case)
        const loadModelAndDetect = async () => {
            const model = await cocoSsd.load(); // Load the COCO-SSD model

            // Perform detection every 200ms
            const detectPeople = () => {
                if (videoRef.current && canvasRef.current) {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;

                    model.detect(videoRef.current).then((predictions) => {
                        // Clear the canvas
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                        // Draw bounding boxes and count people
                        let count = 0;
                        predictions.forEach((prediction) => {
                            if (prediction.class === 'person' && prediction.score > 0.6) {
                                count++;
                                const [x, y, width, height] = prediction.bbox;
                                ctx.strokeStyle = 'red';
                                ctx.lineWidth = 2;
                                ctx.strokeRect(x, y, width, height);
                                ctx.fillStyle = 'red';
                                ctx.font = '16px Arial';
                                ctx.fillText(
                                    `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
                                    x,
                                    y > 10 ? y - 5 : y + 15
                                );
                            }
                        });

                        setPeopleCount(count); // Update the people count

                        // Trigger an alert if count is 2 and hasn't been triggered yet
                        if (count === 2 && !alertTriggered.current) {
                            alert('There are two people in the frame!');
                            alertTriggered.current = true; // Set the flag
                        }

                        // Reset the flag if the count changes from 2
                        if (count !== 2) {
                            alertTriggered.current = false;
                        }
                    });
                }
            };

            setInterval(detectPeople, 200); // Detect every 200ms
        };

        setupCamera().then(loadModelAndDetect);

        return () => {
            // Cleanup: stop video feed
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
            }
        };
    }, []);

    return (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <video ref={videoRef} style={{ display: 'none' }} />
            <canvas ref={canvasRef} style={{ border: '1px solid black', maxWidth: '80%', display: 'none' }}></canvas>
            <div style={{ marginTop: '10px' }}>
                People Count: {peopleCount}
            </div>
        </div>
    );
};

export default MultiPersonDetection;
