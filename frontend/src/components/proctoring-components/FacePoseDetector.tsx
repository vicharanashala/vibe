import React, { useEffect, useRef } from 'react'
import { PoseLandmarker } from '@mediapipe/tasks-vision'

type WasmFileset = any
// take lookAwayCount and numPeople as props
interface PoseLandmarkerProps {
  filesetResolver: WasmFileset
  lookAwayCount: number
  setLookAwayCount: React.Dispatch<React.SetStateAction<number>>
  numPeople: number
  setNumPeople: React.Dispatch<React.SetStateAction<number>>
  status: string
  setStatus: React.Dispatch<React.SetStateAction<string>>
}

const PoseLandmarkerComponent: React.FC<PoseLandmarkerProps> = ({
  filesetResolver,
  lookAwayCount,
  setLookAwayCount,
  numPeople,
  setNumPeople,
  status,
  setStatus,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const lookAwayCountRef = useRef(0)
  const minEyeDiffForFocus = 0.07

  // useEffect to initialize the PoseLandmarker and start the webcam
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: 'src/models/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 2,
        }
      )
    }

    const startWebcam = async () => {
      const video = videoRef.current
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })
        if (video) {
          video.srcObject = stream
          video.play()
        }
      }
    }

    initializePoseLandmarker()
    startWebcam()

    return () => {
      const video = videoRef.current
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  // useEffect to detect poses in the webcam feed and update the number of people and status
  useEffect(() => {
    const video = videoRef.current

    const detectLandmarks = async () => {
      if (poseLandmarkerRef.current && video && video.readyState === 4) {
        const landmarks = await poseLandmarkerRef.current.detectForVideo(
          video,
          performance.now()
        )
        if (landmarks && landmarks.landmarks) {
          if (!landmarks.landmarks[0]) {
            setNumPeople(0)
          }
          if (landmarks.landmarks[0]) {
            setNumPeople(landmarks.landmarks.length)
            // checking if the person's face is in the middle of the fame
            const nose = landmarks.landmarks[0][0]
            if (nose) {
              const videoWidth = video.videoWidth
              const videoHeight = video.videoHeight

              const box = {
                // height and width of the box is 1/2 of the video frame
                left: videoWidth / 4,
                right: (videoWidth * 3) / 4,
                top: videoHeight / 4,
                bottom: (videoHeight * 3) / 4,
              }

              const noseX = nose.x * videoWidth
              const noseY = nose.y * videoHeight

              const isInBox =
                noseX >= box.left &&
                noseX <= box.right &&
                noseY >= box.top &&
                noseY <= box.bottom

              isInBox
                ? setStatus('User is in box')
                : setStatus('User is not in box')
            }
            const leftEye = landmarks.landmarks[0][2]
            const rightEye = landmarks.landmarks[0][5]
            const eyeDiff = Math.abs(leftEye.x - rightEye.x) // Difference in X positions of eyes
            if (eyeDiff < minEyeDiffForFocus) {
              lookAwayCountRef.current++
              setLookAwayCount(lookAwayCountRef.current)
              setStatus('Focus on the lecture!')
            }
          } else {
            setStatus('User not detected.')
          }
        }
      }

      requestAnimationFrame(detectLandmarks)
    }

    detectLandmarks()
  }, [])

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '14px' }}>
        <h4>People Count: {numPeople}</h4>
        <h4>Status: {status}</h4>
        <p>Look Away Count: {lookAwayCount} ms</p>
      </div>
    </div>
  )
}

export default PoseLandmarkerComponent
