import React, { useRef, useEffect } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import * as drawingUtils from "@mediapipe/drawing_utils";

const RealTimeHandBlurDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const infoRef = useRef(null);
  let blurAlertTimeout = null;
  let resolveTimeout = null;
  let handRaiseTimeout = null;
  let checkHandTimeout = null;
  let handDetectedInitially = false;

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const infoElement = infoRef.current;
    const canvasCtx = canvasElement.getContext("2d");
    let animationFrameId;

    // Set up video stream
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          startProcessing();
          startRandomHandRaiseAlert();
        };
      })
      .catch((err) => {
        console.error("Error accessing the camera: " + err);
      });

    // Initialize Mediapipe Hands
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 6,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    function startProcessing() {
      const processFrame = async () => {
        await hands.send({ image: videoElement });
        animationFrameId = requestAnimationFrame(processFrame);
      };
      processFrame();
    }

    function onResults(results) {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      if (results.multiHandLandmarks && results.multiHandedness) {
        for (
          let index = 0;
          index < results.multiHandLandmarks.length;
          index++
        ) {
          const classification = results.multiHandedness[index];
          const isRightHand = classification.label === "Right";
          const landmarks = results.multiHandLandmarks[index];

          drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: isRightHand ? "#00FF00" : "#FF0000",
          });
          drawingUtils.drawLandmarks(canvasCtx, landmarks, {
            color: "#FFFFFF",
            lineWidth: 2,
          });
        }
      }

      const blurResult = checkBlur(results.image);

      const numHands = results.multiHandLandmarks
        ? results.multiHandLandmarks.length
        : 0;

      infoElement.textContent = `Hands detected: ${numHands} | Blurry: ${
        blurResult.isBlurry ? "Yes" : "No"
      } | Variance: ${blurResult.variance.toFixed(2)}`;

      if (blurResult.isBlurry) {
        handleBlur();
      } else {
        clearBlurAlert();
      }

      checkForHandRaise(numHands);

      canvasCtx.restore();
    }

    function handleBlur() {
      if (!blurAlertTimeout) {
        // Start a timer to trigger the alert after 5 seconds
        blurAlertTimeout = setTimeout(() => {
          alert("Warning: The image has been blurry for 5 seconds!");
    
          // Start a secondary timeout for the 10-second flag if blur persists
          resolveTimeout = setTimeout(() => {
            alert("The image is still blurry after 10 seconds. Flag noted.");
            resolveTimeout = null;
          }, 10000); // Secondary alert after 5 additional seconds (10 seconds total)
        }, 5000); // Initial blur alert timeout set to 5 seconds
      }
    }
    

    function clearBlurAlert() {
      if (blurAlertTimeout) {
        clearTimeout(blurAlertTimeout);
        blurAlertTimeout = null;
      }
      if (resolveTimeout) {
        clearTimeout(resolveTimeout);
        resolveTimeout = null;
      }
    }

    function startRandomHandRaiseAlert() {
      const randomTime = Math.floor(Math.random() * 480000) + 420000; // Between 7-15 minutes
      handRaiseTimeout = setTimeout(() => {
        alert("Please raise your hand within 10 seconds!");

        // Check if a hand is raised within 10 seconds
        handDetectedInitially = false; // Reset the flag
        checkHandTimeout = setTimeout(() => {
          if (!handDetectedInitially) {
            alert("You did not raise your hand. Flag noted.");
          }
          startRandomHandRaiseAlert(); // Restart the random alert cycle
        }, 10000); // Wait 10 seconds for the user to raise their hand
      }, randomTime);
    }

    function checkForHandRaise(numHands) {
      if (numHands > 0) {
        handDetectedInitially = true; // Hand has been detected
        if (checkHandTimeout) {
          clearTimeout(checkHandTimeout);
          checkHandTimeout = null;
          alert("Hand detected successfully! Thank you.");
          startRandomHandRaiseAlert(); // Restart the random alert cycle
        }
      }
    }

    function checkBlur(image) {
      const scale = 0.5;
      const width = Math.floor(image.width * scale);
      const height = Math.floor(image.height * scale);

      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const offscreenCtx = offscreenCanvas.getContext("2d");
      offscreenCtx.drawImage(image, 0, 0, width, height);

      const imageData = offscreenCtx.getImageData(0, 0, width, height);
      const gray = rgbToGrayscale(imageData);
      const laplacian = computeLaplacian(gray, width, height);
      const variance = computeVariance(laplacian);

      return {
        isBlurry: variance < 250,
        variance,
      };
    }

    function rgbToGrayscale(imageData) {
      const gray = new Uint8ClampedArray(imageData.width * imageData.height);
      for (let i = 0; i < gray.length; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return gray;
    }

    function computeLaplacian(gray, width, height) {
      const laplacian = new Float32Array(gray.length);
      const kernel = [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0],
      ];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = gray[(y + ky) * width + (x + kx)];
              const weight = kernel[ky + 1][kx + 1];
              sum += pixel * weight;
            }
          }
          laplacian[y * width + x] = sum;
        }
      }
      return laplacian;
    }

    function computeVariance(data) {
      let mean = 0;
      for (let i = 0; i < data.length; i++) {
        mean += data[i];
      }
      mean /= data.length;

      let variance = 0;
      for (let i = 0; i < data.length; i++) {
        variance += Math.pow(data[i] - mean, 2);
      }
      variance /= data.length;

      return variance;
    }

    function clearTimers() {
      if (handRaiseTimeout) {
        clearTimeout(handRaiseTimeout);
        handRaiseTimeout = null;
      }
      if (checkHandTimeout) {
        clearTimeout(checkHandTimeout);
        checkHandTimeout = null;
      }
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      clearTimers();
      hands.close();
    };
  }, []);

  return (
    <div>
      <div className="flex justify-center">
        <video ref={videoRef} style={{ display: "none" }} playsInline></video>
        <canvas
          ref={canvasRef}
          className="h-36 border-1 border-gray-600"
        ></canvas>
      </div>
      <div ref={infoRef}></div>
    </div>
  );
};

export default RealTimeHandBlurDetection;
