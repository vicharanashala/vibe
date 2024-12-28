import { saveSnapshot, deleteSnapshot, getSnapshots } from "./dbUtils";

const memoryCapacity = 20; // number of images stored in the database at any given time.

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
  console.log("capturing for", anomalyType)
  const base64Img = await captureFrame(video); // Await the async function
  if (base64Img) {
    const newSnapshot = {
      image: base64Img,
      anomalyType: anomalyType,
      timestamp: new Date().toISOString(),
    };

    try {
      const id = await saveSnapshot(newSnapshot); // Save snapshot to database
      console.log("saved snapshot with id ", id)
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
 * Deletes a snapshot with id = added_id - 20 if its anomalyType is "none".
 * @param {number} added_id - The ID of the recently added snapshot.
 */
const deleteOldSnapshot = async (added_id) => {
  const target_id = added_id - (memoryCapacity-1);

  if (target_id <= 0) {
    console.log(`Invalid target_id: ${target_id}. Skipping deletion.`);
    return;
  }

  try {
    const snapshots = await getSnapshots(); // Fetch all snapshots
    const snapshotToDelete = snapshots.find((snapshot) => snapshot.id === target_id);

    if (!snapshotToDelete) {
      console.log(`No snapshot found with id: ${target_id}. Skipping deletion.`);
      return;
    }

    await deleteSnapshot(target_id);
    console.log(`Snapshot with id: ${target_id} has been deleted.`);
  } catch (error) {
    console.error("Error in deleteOldSnapshotIfNone:", error);
    throw error; // Re-throw the error to propagate it back to the caller
  }
};
