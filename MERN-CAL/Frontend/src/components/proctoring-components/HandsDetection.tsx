import React, { useEffect, useRef, useState } from 'react'
import { HandLandmarker } from '@mediapipe/tasks-vision'
import { toast } from 'sonner'

type WasmFileset = any
// take handCount as props
interface HandLandmarkerComponentProps {
  filesetResolver: WasmFileset
  handCount: number
  setHandCount: React.Dispatch<React.SetStateAction<number>>
}

const HandLandmarkerComponent: React.FC<HandLandmarkerComponentProps> = ({
  filesetResolver,
  handCount,
  setHandCount,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [gesture, setGesture] = useState('None')
  const minAngleTanForRaised = 2
  const minAngleTanForDown = 1

  // function to check whether a particular finger is raised.
  interface Landmark {
    x: number
    y: number
  }

  const isRaised = (landmarks: Landmark[], fingerNumber: number): boolean => {
    // Each finger has MCP (knuckle), PIP, DIP and TIP landmarks.
    // when the y coordinate monotonically increases from MCP to TIP, we say that the finger is raised.
    let y_coord = landmarks[0].y
    let index = fingerNumber * 4 + 1 // index initially points to the MCP of the given finger.
    for (index; index < fingerNumber * 4 + 5; index++) {
      if (y_coord < landmarks[index].y) {
        return false
      }
      y_coord = landmarks[index].y
    }
    // we add the additional condition that the angle of the finger wrt horizontal is greater than arctan(2)
    if (
      Math.abs(landmarks[index - 1].y - landmarks[index - 3].y) <
      minAngleTanForRaised *
        Math.abs(landmarks[index - 1].x - landmarks[index - 3].x)
    ) {
      return false
    }
    return true
  }

  interface Landmark {
    x: number
    y: number
  }

  const isExtended = (landmarks: Landmark[]): boolean => {
    let x_coord = landmarks[0].x // x coordinate of wrist
    let index = 1
    if (landmarks[index].x > x_coord) {
      // if x of MCP is greater than that of wrist, it must further increase from MCP to TIP.
      for (index; index < 5; index++) {
        if (x_coord > landmarks[index].x) {
          return false
        }
        x_coord = landmarks[index].x
      }
    } else {
      // if x of MCP is less than that of wrist, it must further decrease from MCP to TIP.
      for (index; index < 5; index++) {
        if (x_coord < landmarks[index].x) {
          return false
        }
        x_coord = landmarks[index].x
      }
    }
    return true
  }

  interface Landmark {
    x: number
    y: number
  }

  const isDown = (landmarks: Landmark[]): boolean => {
    let y_coord = landmarks[0].y
    let index = 1
    for (index; index < 5; index++) {
      if (y_coord > landmarks[index].y) {
        return false
      }
      y_coord = landmarks[index].y
    }
    if (
      Math.abs(landmarks[index - 1].y - landmarks[index - 3].y) <
      minAngleTanForDown *
        Math.abs(landmarks[index - 1].x - landmarks[index - 3].x)
    ) {
      return false
    }
    return true
  }

  const getRaisedFingers = (landmarks: Landmark[]) => {
    let numRaised = 0
    for (let i = 1; i < 5; i++) {
      if (isRaised(landmarks, i)) {
        numRaised++
      }
    }
    return numRaised.toString()
  }

  const checkThumb = (landmarks: Landmark[]) => {
    if (isRaised(landmarks, 0)) {
      return 'Thumbs Up'
    } else if (isDown(landmarks)) {
      return 'Thumbs Down'
    } else if (isExtended(landmarks)) {
      return 'Thumb Extended'
    } else {
      return false
    }
  }

  interface GestureLandmarks {
    x: number
    y: number
  }

  const getGesture = (landmarks: GestureLandmarks[]): string => {
    const numRaised = getRaisedFingers(landmarks)
    if (parseInt(numRaised) != 0 && parseInt(numRaised) !== 4) {
      return numRaised.toString()
    }
    const thumbStatus = checkThumb(landmarks)
    if (!thumbStatus) {
      return numRaised
    }
    if (parseInt(numRaised) === 4) {
      if (
        (thumbStatus === 'Thumb Extended' || thumbStatus === 'Thumbs Up') &&
        ((landmarks[4].x < landmarks[5].x && landmarks[5].x < landmarks[9].x) ||
          (landmarks[4].x > landmarks[5].x && landmarks[5].x > landmarks[9].x))
      ) {
        // if thumb is outside the palm
        return '5'
      } else {
        return '4'
      }
    }
    return thumbStatus
  }

  // useEffects are kept separate for readability and separation of concerns

  // useEffect to initialize the HandLandmarker and start the webcam feed.
  useEffect(() => {
    const initializeHandLandmarker = async () => {
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: 'src/models/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 3,
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

    initializeHandLandmarker()
    startWebcam()

    return () => {
      const video = videoRef.current
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  // useEffect to detect hands in the webcam feed and update the hand count and gesture.
  useEffect(() => {
    const video = videoRef.current

    const detectHands = async () => {
      if (handLandmarkerRef.current && video && video.readyState === 4) {
        const results = await handLandmarkerRef.current.detectForVideo(
          video,
          performance.now()
        )

        if (results && results.landmarks) {
          setHandCount(results.landmarks.length)
          if (handCount > 2) {
            toast(`${handCount} hands are present in the frame. Flag Notted !`)
            console.log('number of hands', handCount)
          }
          if (results.landmarks[0]) {
            setGesture(getGesture(results.landmarks[0]))
          } else {
            setGesture('None')
          }
          if (results.landmarks[0]) {
            setGesture(getGesture(results.landmarks[0]))
          } else {
            setGesture('None')
          }
        } else {
          setHandCount(0)
        }
      }

      requestAnimationFrame(detectHands)
    }

    detectHands()
  }, [])

  return (
    <div>
      <h1>Gesture: {gesture}</h1>
      <h4>Number of Hands Detected: {handCount}</h4>
      <video ref={videoRef} style={{ display: 'none' }} />
    </div>
  )
}

export default HandLandmarkerComponent
