import { saveSnapshot, deleteSnapshot, getSnapshots } from "./dbUtils";
import html2canvas from 'html2canvas';

const memoryCapacity = 20; // number of entries stored in the database at any given time.

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

const captureScreenshot = async () => {
  try {
    const canvas = await html2canvas(document.body, {
      scale: 1, // Adjust scale for resolution
      useCORS: true, // Enable cross-origin resources
      ignoreElements: (element) => element.tagName === 'VIDEO',
    });

    const base64Image = canvas.toDataURL('image/png');
    return base64Image;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
  }
};

export const handleSaveSnapshot = async ({ anomalyType, video }) => {
  const base64Img = await captureFrame(video);
  const base64Screenshot = await captureScreenshot()
  if (base64Img && base64Screenshot) {
    const newSnapshot = {
      image: base64Img,
      screenshot: base64Screenshot,
      anomalyType: anomalyType,
      timestamp: new Date().toISOString(),
    };

    try {
      const id = await saveSnapshot(newSnapshot); // Save snapshot to database
      await deleteOldSnapshot(id);
      return id;
    } catch (error) {
      console.error("Error saving snapshot to database:", error);
    }
  } else {
    console.error("Failed to capture or save snapshot.");
  }
};

/**
 * @param {number} added_id - The ID of the recently added snapshot.
 */
const deleteOldSnapshot = async (added_id) => {
  const target_id = added_id - (memoryCapacity-1);

  if (target_id <= 0) {
    return;
  }

  try {
    const snapshots = await getSnapshots(); // Fetch all snapshots
    const snapshotToDelete = snapshots.find((snapshot) => snapshot.id === target_id);

    if (!snapshotToDelete) {
      return;
    }

    await deleteSnapshot(target_id);
  } catch (error) {
    console.error("Error in deleteOldSnapshotIfNone:", error);
    throw error; // Re-throw the error to propagate it back to the caller
  }
};
