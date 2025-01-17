import { handleSaveSnapshot } from '../../lib/snapUtils.ts'
import React, { useEffect, useRef } from 'react'
import { clearSnapshots } from '../../lib/dbUtils.ts'
import { upload } from '../../lib/cloudUtils.ts'

interface Anomalies {
  lookAwayCount: number
  numPeople: number
  handCount: number
  isBlur: string
  status: string
}

const SnapshotRecorder: React.FC<{ anomalies: Anomalies }> = ({
  anomalies,
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentAnomaliesRef = useRef(anomalies) // Initialize with default array values
  const counterRef = useRef(0)

  const counterLimit = 5 // upload capacity = 2*counterLimit+1 should be the number of frames uploaded at a time. Ensure that this is less than the memory capacity defined in snapUtils.js

  // Helper function for computing anomalies
  const getActiveAnomalies = () => {
    let anomaliesList = []
    const { lookAwayCount, numPeople, handCount, isBlur, status } =
      currentAnomaliesRef.current

    if (lookAwayCount % 5000 === 0 && lookAwayCount > 0) {
      anomaliesList.push('looking away')
    }

    if (numPeople > 1) {
      anomaliesList.push('multiple people')
    }

    if (handCount > 2) {
      anomaliesList.push('more than two hands')
    }

    if (isBlur === 'Yes') {
      anomaliesList.push('blur video')
    }

    if (status === 'User not detected.' || status === 'User is not in box') {
      anomaliesList.push(status)
    }

    return anomaliesList.join(', ')
  }

  useEffect(() => {
    const startWebcam = async () => {
      const video = videoRef.current
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })
        if (video) {
          video.srcObject = stream
        }
        if (video) {
          video.play()
        }
      }
    }
    startWebcam()
    clearSnapshots()
    return () => {
      const video = videoRef.current
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      // if there is an anomaly, set a counter of 5, and after that counter ends upload the last 11 frames to cloud.
      // while the counter is running, do not reset the counter.

      const activeAnomalies = getActiveAnomalies()
      if (videoRef.current) {
        const id = await handleSaveSnapshot({
          anomalyType: activeAnomalies,
          video: videoRef.current,
        })
        if (id !== undefined) {
          if (activeAnomalies != '' && counterRef.current == 0) {
            counterRef.current = counterLimit + 1
          }
          if (counterRef.current > 0) {
            if (counterRef.current == 1) {
              upload(id, 2 * counterLimit)
            }
            counterRef.current--
          }
        } else {
          console.error('Snapshot ID is undefined')
        }
      } else {
        console.log('video not loaded')
      }
    }, 2000) // Capture every 2 seconds

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current) // Clear the interval on component unmount
      }
    }
  }, [])

  useEffect(() => {
    currentAnomaliesRef.current = anomalies
  }, [anomalies])

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
    </div>
  )
}

export default SnapshotRecorder
