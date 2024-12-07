import React, { useRef, useEffect } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import * as drawingUtils from "@mediapipe/drawing_utils";

const RealTimeHandBlurDetection = () => {
  const videoRef = useRef(null);
  const infoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const infoElement = infoRef.current;

    // Create an offscreen canvas
    const canvasElement = document.createElement("canvas");
    const canvasCtx = canvasElement.getContext("2d");
    let animationFrameId;

    // Set up video stream from webcam
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          // Adjust canvas size to match video
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          // Start processing frames
          startProcessing();
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

    // Set up Hands parameters
    hands.setOptions({
      maxNumHands: 6,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Register a callback to receive the results
    hands.onResults(onResults);

    /**
     * Starts processing video frames using Mediapipe Hands.
     */
    function startProcessing() {
      const processFrame = async () => {
        await hands.send({ image: videoElement });
        animationFrameId = requestAnimationFrame(processFrame);
      };
      processFrame();
    }

    /**
     * Callback function to handle results from Mediapipe Hands.
     * @param {Object} results - The results from hand detection.
     */
    function onResults(results) {
      // Draw the video frame onto the offscreen canvas
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      // Draw hand annotations
      if (results.multiHandLandmarks && results.multiHandedness) {
        for (
          let index = 0;
          index < results.multiHandLandmarks.length;
          index++
        ) {
          const classification = results.multiHandedness[index];
          const isRightHand = classification.label === "Right";
          const landmarks = results.multiHandLandmarks[index];

          // Draw hand skeleton
          drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: isRightHand ? "#00FF00" : "#FF0000",
          });
          // Draw hand landmarks
          drawingUtils.drawLandmarks(canvasCtx, landmarks, {
            color: "#FFFFFF",
            lineWidth: 2,
          });
        }
      }

      // Perform blur detection on the frame
      const blurResult = checkBlur(results.image);

      // Update the info display
      const numHands = results.multiHandLandmarks
        ? results.multiHandLandmarks.length
        : 0;
      infoElement.textContent = `Hands detected: ${numHands} | Blurry: ${
        blurResult.isBlurry ? "Yes" : "No"
      } | Variance: ${blurResult.variance.toFixed(2)}`;

      canvasCtx.restore();
    }

    /**
     * Checks if the given image is blurry using the variance of the Laplacian method.
     * @param {HTMLImageElement | HTMLCanvasElement | HTMLVideoElement} image - The image to analyze.
     * @returns {Object} - An object containing isBlurry (boolean) and variance (number).
     */
    function checkBlur(image) {
      // Downscale the image for performance
      const scale = 0.5; // Scale down to 50% of the original size
      const width = Math.floor(image.width * scale);
      const height = Math.floor(image.height * scale);

      // Create an offscreen canvas for processing
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const offscreenCtx = offscreenCanvas.getContext("2d");
      offscreenCtx.drawImage(image, 0, 0, width, height);

      // Get image data
      const imageData = offscreenCtx.getImageData(0, 0, width, height);

      // Convert to grayscale
      const gray = rgbToGrayscale(imageData);

      // Compute the Laplacian
      const laplacian = computeLaplacian(gray, width, height);

      // Compute the variance
      const variance = computeVariance(laplacian);

      // Threshold for blurriness (adjust as needed)
      const isBlurry = variance < 250;

      // Return both isBlurry and variance
      return {
        isBlurry: isBlurry,
        variance: variance,
      };
    }

    /**
     * Converts RGB image data to grayscale.
     * @param {ImageData} imageData - The image data to convert.
     * @returns {Uint8ClampedArray} - Grayscale pixel data.
     */
    function rgbToGrayscale(imageData) {
      const gray = new Uint8ClampedArray(imageData.width * imageData.height);
      for (let i = 0; i < gray.length; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        // Grayscale conversion formula
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return gray;
    }

    /**
     * Computes the Laplacian of the grayscale image.
     * @param {Uint8ClampedArray} gray - Grayscale pixel data.
     * @param {number} width - Image width.
     * @param {number} height - Image height.
     * @returns {Float32Array} - Laplacian pixel data.
     */
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

    /**
     * Computes the variance of pixel data.
     * @param {Float32Array} data - Pixel data.
     * @returns {number} - Variance of the data.
     */
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

    // Cleanup function
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      hands.close();
    };
  }, []);

  return (
    <div>
      <div className="flex justify-center">
        <video ref={videoRef} style={{ display: "none" }} playsInline></video>
      </div>
      <div ref={infoRef}></div>
    </div>
  );
};

export default RealTimeHandBlurDetection;
