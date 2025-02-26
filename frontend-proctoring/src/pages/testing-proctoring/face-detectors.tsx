import React, { useEffect, useRef, useState } from "react";

const MAX_IMAGES = 5; // Limit the number of stored images

const FaceDetectors: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [imageSrcs, setImageSrcs] = useState<string[]>([]); // Store Blob URLs
  const [imageBitmaps, setImageBitmaps] = useState<ImageBitmap[]>([]); // Store ImageBitmap for ML
  const [modelReady, setModelReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {

    const initWorker = async () => {
      if (workerRef.current == null){
        workerRef.current = new Worker(new URL("./face-detector-worker.ts", import.meta.url), {type: "module"});
        // Listen for messages from the worker
        workerRef.current.onmessage = (event) => {
        if (event.data.type === "MODEL_READY") {
          setModelReady(true);
        } else if (event.data.type === "DETECTION_RESULT") {
          console.log("Face Detection Result:", event.data.faces);
        } else if (event.data.type === "ERROR") {
          console.error("Worker Error:", event.data.message);
        }
      };
      };
      // Send initialization message to worker
      workerRef.current.postMessage({ type: "INIT" });
    };

    initWorker();

    const enableWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: { max: 30 } }, // Set frame rate to 3 FPS
      });

      videoRef.current.srcObject = stream;
    };

    enableWebcam();

    const captureFrame = async () => {
      if (!videoRef.current) return;
      console.log("Hello");

      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ✅ 1. Convert to ImageBitmap (for ML processing)
      const imageBitmap = await createImageBitmap(canvas);
      setImageBitmaps((prev) => [imageBitmap, ...prev.slice(0, MAX_IMAGES - 1)]);

      // ✅ 2. Convert to Blob (for displaying in <img>)
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        setImageSrcs((prev) => [blobUrl, ...prev.slice(0, MAX_IMAGES - 1)]); // Keep only MAX_IMAGES
      }, "image/png");

      // ✅ 3. Pass ImageBitmap to ML Model (Optional)
      processMLAnalysis(imageBitmap);
    };

    const intervalId = setInterval(captureFrame, 1000); // Capture at 3 FPS

    return () => {
      clearInterval(intervalId);
    }
  }, []);

  // Placeholder ML analysis function
  const processMLAnalysis = async (image: ImageBitmap) => {
    if (!workerRef.current) return;
    
    try {
      // ✅ Send image to worker for face detection
      workerRef.current.postMessage({ type: "DETECT", image }, [image]);
    } catch (error) {
      console.error("Error processing image:", error);
    }

    };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold text-center mb-4">Webcam Capture</h1>
      <div className="flex flex-col items-center space-y-4">
        <video ref={videoRef} autoPlay playsInline className="rounded-lg shadow-lg border" />
        <div className="grid grid-cols-3 gap-4">
          {imageSrcs.map((src, index) => (
            <img
              key={index}
              src={src} // ✅ Now it only stores Blob URLs
              alt={`Captured Frame ${index}`}
              className="w-32 h-32 object-cover rounded-lg shadow-md border"
            />
          ))}
        </div>
        <div className="container mx-auto p-4">
          <h1 className="text-xl font-bold text-center mb-4">
            Face Detector with Worker
          </h1>
          {modelReady ? (
            <p className="text-green-600 text-center">Model is ready!</p>
          ) : (
            <p className="text-red-600 text-center">Loading model...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceDetectors;

