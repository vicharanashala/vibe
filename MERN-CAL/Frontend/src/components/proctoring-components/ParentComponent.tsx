import { useState, useEffect } from 'react'

// Define the WasmFileset type
type WasmFileset = any
import FacePoseDetector from './FacePoseDetector'
import VoiceActivityDetection from './VoiceActivityDetection'
import { FilesetResolver } from '@mediapipe/tasks-vision'
import HandsDetection from './HandsDetection'
import BlurDetection from './BlurDetection'
import SnapshotRecorder from './SnapshotRecorder'
// import VirtualBackgroundDetection from "./VirtualBackgroundDetection"

const ParentComponent = () => {
  const [filesetResolver, setFilesetResolver] = useState<WasmFileset>(null)
  const [audioFilesetResolver, setAudioFilesetResolver] =
    useState<WasmFileset>(null)

  // anomaly state related variables
  const [handCount, setHandCount] = useState(0) // for HandsDetection
  const [lookAwayCount, setLookAwayCount] = useState(0) // for FacePoseDetector
  const [numPeople, setNumPeople] = useState(0) // for FacePoseDetector
  const [isBlur, setIsBlur] = useState('No') // for BlurDetection
  const [status, setStatus] = useState('') // for FacePoseDetector

  useEffect(() => {
    const initializeFilesetResolver = async () => {
      const resolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      )
      const audioResolver = await FilesetResolver.forAudioTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm'
      )
      setAudioFilesetResolver(audioResolver)
      setFilesetResolver(resolver)
    }

    initializeFilesetResolver()
  }, [])
  if (!(filesetResolver && audioFilesetResolver)) {
    return <div>Loading...</div> // Wait until the resolver is initialized.
  }

  return (
    <div>
      <FacePoseDetector
        filesetResolver={filesetResolver}
        lookAwayCount={lookAwayCount}
        setLookAwayCount={setLookAwayCount}
        numPeople={numPeople}
        setNumPeople={setNumPeople}
        status={status}
        setStatus={setStatus}
      />
      <HandsDetection
        filesetResolver={filesetResolver}
        handCount={handCount}
        setHandCount={setHandCount}
      />
      <VoiceActivityDetection filesetResolver={audioFilesetResolver} />
      <BlurDetection isBlur={isBlur} setIsBlur={setIsBlur} />
      {/* <SnapshotRecorder
        anomalies={{ lookAwayCount, numPeople, handCount, isBlur, status }}
      /> */}
      {/* <VirtualBackgroundDetection /> */}
    </div>
  )
}

export default ParentComponent
