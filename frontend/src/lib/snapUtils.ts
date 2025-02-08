import { saveSnapshot, deleteSnapshot, getSnapshots } from './dbUtils.ts'
import html2canvas from 'html2canvas'

const memoryCapacity = 20 // Number of entries stored in the database at any given time.

// Snapshot interface
interface Snapshot {
  id?: number
  image: string
  screenshot: string
  anomalyType: string
  timestamp: string
}

// Options for handleSaveSnapshot
interface SaveSnapshotOptions {
  anomalyType: string
  video: HTMLVideoElement
}

const captureFrame = async (
  video: HTMLVideoElement
): Promise<string | undefined> => {
  if (video.srcObject) {
    try {
      const track = (video.srcObject as MediaStream).getVideoTracks()[0]
      const imageCapture = new ImageCapture(track)

      // Wait for the grabFrame to complete
      const bitmap = await imageCapture.grabFrame()

      // Create a canvas and draw the frame
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0)

        // Convert to Base64
        return canvas.toDataURL('image/png')
      }
    } catch (error) {
      console.error('Frame capture failed:', error)
      return undefined
    }
  } else {
    console.error('No video source object found.')
    return undefined
  }
}

const captureScreenshot = async (): Promise<string | undefined> => {
  try {
    const canvas = await html2canvas(document.body, {
      scale: 1, // Adjust scale for resolution
      useCORS: true, // Enable cross-origin resources
      ignoreElements: (element) => element.tagName === 'VIDEO',
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error capturing screenshot:', error)
    return undefined
  }
}

export const handleSaveSnapshot = async ({
  anomalyType,
  video,
}: SaveSnapshotOptions): Promise<number | undefined> => {
  const base64Img = await captureFrame(video)
  const base64Screenshot = await captureScreenshot()
  console.log('Captured snapshot', base64Img, base64Screenshot)
  if (base64Img && base64Screenshot) {
    const newSnapshot: Snapshot = {
      image: base64Img,
      screenshot: base64Screenshot,
      anomalyType: anomalyType,
      timestamp: new Date().toISOString(),
    }

    try {
      const id = await saveSnapshot(newSnapshot) // Save snapshot to database
      await deleteOldSnapshot(id)
      return id
    } catch (error) {
      console.error('Error saving snapshot to database:', error)
    }
  } else {
    console.error('Failed to capture or save snapshot.')
  }
  return undefined
}

/**
 * Deletes the oldest snapshot if the total exceeds the memory capacity.
 * @param added_id - The ID of the recently added snapshot.
 */
const deleteOldSnapshot = async (added_id: number): Promise<void> => {
  const target_id = added_id - (memoryCapacity - 1)

  if (target_id <= 0) {
    return
  }

  try {
    const snapshots = await getSnapshots() // Fetch all snapshots
    const snapshotToDelete: Snapshot | undefined = snapshots.find(
      (snapshot: Snapshot) => snapshot.id === target_id
    )

    if (!snapshotToDelete) {
      return
    }

    await deleteSnapshot(target_id)
  } catch (error) {
    console.error('Error in deleteOldSnapshot:', error)
    throw error // Re-throw the error to propagate it back to the caller
  }
}
