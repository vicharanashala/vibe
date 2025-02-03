import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// take isBlur as props
interface BlurDetectionProps {
  isBlur: string
  setIsBlur: (value: string) => void
}

const BlurDetection: React.FC<BlurDetectionProps> = ({ isBlur, setIsBlur }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [image, setImage] = useState<ImageData | null>(null)
  const [blurStartTime, setBlurStartTime] = useState<number | null>(null)

  useEffect(() => {
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

    startWebcam()

    return () => {
      const video = videoRef.current
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    const captureFrame = () => {
      const video = videoRef.current
      if (video) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          setImage(imageData)
        }
      }
    }

    const interval = setInterval(captureFrame, 200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!image) {
      return
    }
    checkBlur(image)
  }, [image])

  function checkBlur(imageData: ImageData): void {
    // Downscale the image for performance
    const scale: number = 0.5 // Scale down to 50% of the original size
    const width: number = Math.floor(imageData.width * scale)
    const height: number = Math.floor(imageData.height * scale)

    // Convert to grayscale
    const gray: Uint8ClampedArray = rgbToGrayscale(imageData)

    // Compute the Laplacian
    const laplacian: Float32Array = computeLaplacian(gray, width, height)

    // Compute the variance
    const variance: number = computeVariance(laplacian)

    // Threshold for blurriness (adjust as needed)
    const isBlurry: boolean = variance < 250

    if (isBlurry) {
      if (!blurStartTime) {
        // Set blur start time if not already set
        setBlurStartTime(Date.now())
        console.log('Blur time set at: ', blurStartTime)
      } else {
        const elapsedTime = Date.now() - blurStartTime
        console.log('Elapsed time: ', elapsedTime)
        // Check if blurred for at least 2 seconds but less than 5 seconds
        if (elapsedTime >= 2000 && elapsedTime < 2200) {
          toast('Your image is blurry')
          // Reset blurStartTime to stop further toasts during this interval
        } else if (elapsedTime >= 5000 && elapsedTime < 5200) {
          // Check if blurred for 5 seconds or more
          toast('Your image is still blurry, flag noted')
          // Reset blurStartTime to stop further toasts during this interval or restart monitoring
          setBlurStartTime(null)
        }
      }
      setIsBlur('Yes')
    } else {
      // If no longer blurry, reset everything
      setBlurStartTime(null)
      setIsBlur('No')
    }
  }

  function rgbToGrayscale(imageData: ImageData): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height)
    for (let i = 0; i < gray.length; i++) {
      const r = imageData.data[i * 4]
      const g = imageData.data[i * 4 + 1]
      const b = imageData.data[i * 4 + 2]
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
    }
    return gray
  }

  function computeLaplacian(
    gray: Uint8ClampedArray,
    width: number,
    height: number
  ): Float32Array {
    const laplacian = new Float32Array(gray.length)
    const kernel = [
      [0, 1, 0],
      [1, -4, 1],
      [0, 1, 0],
    ]
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)]
            const weight = kernel[ky + 1][kx + 1]
            sum += pixel * weight
          }
        }
        laplacian[y * width + x] = sum
      }
    }
    return laplacian
  }

  function computeVariance(data: Float32Array): number {
    let mean = 0
    for (let i = 0; i < data.length; i++) {
      mean += data[i]
    }
    mean /= data.length

    let variance = 0
    for (let i = 0; i < data.length; i++) {
      variance += Math.pow(data[i] - mean, 2)
    }
    variance /= data.length

    return variance
  }

  return (
    <div>
      <video ref={videoRef} style={{ display: 'block' }} />
    </div>
  )
}

export default BlurDetection
