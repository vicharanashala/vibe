import React, { useRef, useEffect } from 'react';
import FaceRecognitionComponent from './FaceRecognitionComponent';

const FaceRecognitionTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay width={400} height={300} />
      <FaceRecognitionComponent videoRef={videoRef} faces={[]} />
    </div>
  );
};

export default FaceRecognitionTest;