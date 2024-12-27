import { saveSnapshot } from "./dbUtils";


const captureFrame = async (video) => {
  if (video.srcObject) {
    try {
      const track = video.srcObject.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);

      // Wait for the grabFrame to complete
      const bitmap = await imageCapture.grabFrame();

      // Create a canvas and draw the frame
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      // Convert to Base64
      const snapshot = canvas.toDataURL("image/png");
      return snapshot;
    } catch (error) {
      console.error("Frame capture failed:", error);
      return undefined;
    }
  } else {
    console.error("No video source object found.");
    return undefined;
  }
};

export const handleSaveSnapshot = async ({ anomalyType, video }) => {
  const base64Img = await captureFrame(video); // Await the async function
  if (base64Img) {
    const newSnapshot = {
      image: base64Img,
      anomalyType: anomalyType,
      timestamp: new Date().toISOString(),
    };

    try {
      const id = await saveSnapshot(newSnapshot); // Save snapshot to database
      return id;
    } catch (error) {
      console.error("Error saving snapshot to database:", error);
    }
  } else {
    console.error("Failed to capture or save snapshot.");
  }
};
