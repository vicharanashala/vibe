import Cookies from 'js-cookie'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const CameraAndMicCheck = () => {
  const [cameraPermission, setCameraPermission] = useState('Checking...')
  const [micPermission, setMicPermission] = useState('Checking...')
  const navigate = useNavigate()

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // If the promise resolves, access is granted
        setCameraPermission('Granted')
        setMicPermission('Granted')

        // Cleanup: stop the stream to release the camera and mic
        stream.getTracks().forEach((track) => track.stop())
      })
      .catch((error) => {
        // If the promise rejects, access is denied or not available
        if (error.name === 'NotFoundError') {
          setCameraPermission('Not Available')
          setMicPermission('Not Available')
          toast('Camera and Micrphone not Found !')
          // Cookies.remove('access_token');
          // navigate('/login')
        } else if (error.name === 'NotAllowedError') {
          setCameraPermission('Denied')
          setMicPermission('Denied')
          toast('Camera and Micrphone not Found !')
          // Cookies.remove('access_token');
          // navigate('/login')
        } else {
          setCameraPermission('Error')
          setMicPermission('Error')
          toast('Camera and Micrphone not Found !')
          // Cookies.remove('access_token');
          // navigate('/login')
        }
      })
  }, [])

  return (
    <div>
      <h1></h1>
    </div>
  )
}

export default CameraAndMicCheck
