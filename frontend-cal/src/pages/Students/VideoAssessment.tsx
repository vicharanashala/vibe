import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useSidebar } from '@/components/ui/sidebar'
import { useEffect, useRef, useState } from 'react'
import '../../frame.css'

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void
    player: YT.Player
  }
}
import KeyboardLock from '@/components/proctoring-components/KeyboardLock'
import RightClickDisabler from '@/components/proctoring-components/RightClickDisable'
import { Fullscreen, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Slider } from '@/components/ui/slider'

interface Question {
  question_id: number
  question: string
  options: string[]
  correctAnswer: string
}

export default function VideoAssessment() {
  const { setOpen } = useSidebar() // Access setOpen to control the sidebar state
  const hasSetOpen = useRef(false) // Ref to track if setOpen has been called

  useEffect(() => {
    if (!hasSetOpen.current) {
      setOpen(false) // Set the sidebar to closed by default
      hasSetOpen.current = true // Mark as called
    }
  }, [setOpen])

  const [player] = useState<YT.Player | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [totalDuration, setTotalDuration] = useState<number>(0)
  const [volume, setVolume] = useState<number>(50)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const triggeredTimestamps = useRef<Set<number>>(new Set())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [timestamps, setTimestamps] = useState<number[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [currentPart, setCurrentPart] = useState(0)
  const [showThumbnail, setShowThumbnail] = useState(true) // State to show/hide the thumbnail
  const thumbnailUrl =
    'https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg'

  useEffect(() => {
    setCurrentPart(0)
  }, [currentFrame])
  const [data] = useState<
    { video: string; timestamps: { [key: number]: Question[] } }[]
  >([
    {
      video: '1z-E_KOC2L0',
      timestamps: {
        5: [
          {
            question_id: 1,
            question: 'What is the capital of France?',
            options: ['Paris', 'London', 'Berlin'],
            correctAnswer: 'Paris',
          },
          {
            question_id: 2,
            question: 'What is 2 + 2?',
            options: ['3', '4', '5'],
            correctAnswer: '4',
          },
        ],
        10: [
          {
            question_id: 3,
            question: 'What is the capital of India?',
            options: ['Paris', 'London', 'Berlin'],
            correctAnswer: 'Berlin',
          },
          {
            question_id: 4,
            question: 'What is 2 + 3?',
            options: ['3', '4', '5'],
            correctAnswer: '5',
          },
        ],
        15: [
          {
            question_id: 5,
            question: 'What is the capital of France?',
            options: ['Paris', 'London', 'Berlin'],
            correctAnswer: 'Paris',
          },
          {
            question_id: 6,
            question: 'What is 2 + 2?',
            options: ['3', '4', '5'],
            correctAnswer: '4',
          },
        ],
      },
    },
  ])
  const videoId = data[0].video

  useEffect(() => {
    const videoData = data[0] // Assuming single video data
    const ts = Object.keys(videoData.timestamps).map(Number)
    setTimestamps(ts)
  }, [data])

  const cleanupPlayer = () => {
    if (window.player) {
      window.player.destroy()
    }
  }

  // Create player using YouTube IFrame API
  const createPlayer = () => {
    cleanupPlayer() // Clean up any existing player instance
    window.player = new YT.Player(`player-${currentFrame}`, {
      videoId: videoId,
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
      playerVars: {
        rel: 0,
        controls: 0,
        modestbranding: 1,
        showinfo: 0,
        fs: 1,
        iv_load_policy: 3,
        cc_load_policy: 1,
        autohide: 1,
        enablejsapi: 1,
      },
    })
  }

  // Effect to create the player
  useEffect(() => {
    if (typeof YT === 'undefined' || !YT.Player) {
      // Load the YouTube IFrame Player API asynchronously
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      if (firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      }

      // Initialize player once API is ready
      window.onYouTubeIframeAPIReady = createPlayer
    } else {
      createPlayer()
    }
    return () => {
      cleanupPlayer()
    }
  }, [currentFrame, videoId])

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (isPlaying) {
      interval = setInterval(() => {
        if (window.player) {
          const current = window.player.getCurrentTime()
          setCurrentTime(current)

          const currentTimestamp = Math.floor(current)
          if (
            timestamps.includes(currentTimestamp) &&
            !triggeredTimestamps.current.has(currentTimestamp)
          ) {
            triggeredTimestamps.current.add(currentTimestamp)
            pauseVideoAndShowPopup(currentTimestamp)
          }
        }
        console.log('Current Time : ', interval)
      }, 500)
    } else {
      if (interval) clearInterval(interval)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isPlaying, player, timestamps]) //H

  const onPlayerReady = (event: YT.PlayerEvent) => {
    const duration = event.target.getDuration()
    setTotalDuration(duration)
    player?.setVolume(volume)
    setPlaybackSpeed(player?.getPlaybackRate() ?? 1)
  }

  const pauseVideoAndShowPopup = (timestamp: number) => {
    if (window.player) {
      window.player.pauseVideo()
      setIsPlaying(false)
    }
    setCurrentTimestamp(timestamp)
    setQuestions(data[0].timestamps[timestamp]) // Load questions for this timestamp
    setSelectedAnswer('') // Clear previous selections
    setCurrentQuestionIndex(0) // Start at the first question for this timestamp
    setCurrentPart((prevPart) => (prevPart < 1 ? prevPart + 1 : 0))
  }

  const handleIncorrectAnswer: () => void = () => {
    if (currentTimestamp !== null) {
      const lastTimestamp = [...triggeredTimestamps.current]
        .filter((t) => t < currentTimestamp)
        .sort((a, b) => b - a)[0]
      const resetTime = lastTimestamp ?? 0
      setCurrentTime(resetTime)
      setCurrentTimestamp(resetTime)
      if (window.player) {
        window.player.seekTo(resetTime, true)
      }
      triggeredTimestamps.current.delete(currentTimestamp)
    }
    toast('Wrong answer. Try again!')
    handlePartScrollDown() // Scroll the part down when the answer is incorrect
  }

  const goToNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex]
    if (selectedAnswer !== currentQuestion.correctAnswer) {
      setSelectedAnswer('') // Clear the selection for the current question
      handleIncorrectAnswer()
      return
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer('') // Reset selected answer for the new question
    } else {
      handleFrameScrollUp() // Scroll the frame up when both answers are correct
      closePopup() // Reset state when all questions are answered
    }
  }

  const closePopup = () => {
    setCurrentQuestionIndex(0) // Reset question index
    setSelectedAnswer('') // Clear selected answer
    setQuestions([]) // Clear the current questions
  }

  const onPlayerStateChange = (event: YT.OnStateChangeEvent) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true)
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false)
    }
  }

  const handleAnswerSelection = (answer: string) => {
    console.log('Answer : ', answer)
    setSelectedAnswer(answer)
    console.log('selected Answer', selectedAnswer)
  }

  const togglePlayPause = () => {
    if (isPlaying) {
      window.player.pauseVideo()
    } else {
      window.player.playVideo()
      // Ensure the video seeks to the current timestamp before playing
      window.player.seekTo(currentTime, true)
      setShowThumbnail(false)
    }
    setIsPlaying(!isPlaying)
  }

  const seekVideo = (newTime: number) => {
    if (window.player && newTime <= totalDuration) {
      window.player.seekTo(newTime, true) // Seek to the current time
      setCurrentTime(newTime)
    } else {
      console.error('Invalid seek time')
    }
  }

  const changeVolume = (newVolume: number) => {
    setVolume(newVolume)
    window.player?.setVolume(newVolume)
  }

  const changePlaybackSpeed = (speed: number) => {
    window.player?.setPlaybackRate(speed)
    setPlaybackSpeed(speed)
  }

  const toggleFullscreen = () => {
    const videoContainer = document.querySelector(
      '.video-container'
    ) as HTMLElement
    if (videoContainer.requestFullscreen) {
      videoContainer.requestFullscreen()
    } else if (
      (videoContainer as HTMLElement & { mozRequestFullScreen?: () => void })
        .mozRequestFullScreen
    ) {
      ;(
        videoContainer as HTMLElement & { mozRequestFullScreen?: () => void }
      ).mozRequestFullScreen?.()
    } else if (
      (videoContainer as HTMLElement & { webkitRequestFullscreen?: () => void })
        .webkitRequestFullscreen
    ) {
      ;(
        videoContainer as HTMLElement & { webkitRequestFullscreen?: () => void }
      ).webkitRequestFullscreen?.()
    } else if (
      (videoContainer as HTMLElement & { msRequestFullscreen?: () => void })
        .msRequestFullscreen
    ) {
      ;(
        videoContainer as HTMLElement & { msRequestFullscreen?: () => void }
      ).msRequestFullscreen?.()
    }
  }

  const handleFrameScrollUp = () => {
    setCurrentFrame((prevFrame) => {
      if (currentPart > 0) {
        // Ensure part transitions within the same frame
        setCurrentPart(currentPart - 1)
        return prevFrame + 1
      } else {
        // Move to the previous frame when all parts are completed
        setCurrentPart(1) // Reset part to the last part
        return prevFrame > 0 ? prevFrame - 1 : frames.length / 2 - 1 // Decrement frame or loop back
      }
    })
    setShowThumbnail(true)
  }

  const handlePartScrollDown = () => {
    setCurrentPart((prevPart) => (prevPart < 1 ? prevPart + 1 : 0))
    setShowThumbnail(true)
  }

  const frames = data
    .flatMap((frameData, frameIndex) => {
      return Object.keys(frameData.timestamps).map((timeKey, partIndex) => [
        <div
          key={`video-${frameIndex}-${partIndex}`}
          className='flex h-screen items-center justify-center bg-blue-500 text-white'
        >
          <iframe
            id={`player-${partIndex}`}
            title={`YouTube video player ${partIndex}`}
            width='100%'
            height='100%'
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&fs=1&iv_load_policy=3&cc_load_policy=1&autohide=1`}
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
          ></iframe>
          {showThumbnail && (
            <img
              src={thumbnailUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
              }}
              alt='Video Thumbnail'
            />
          )}
        </div>,
        <div
          key={`assessment-${frameIndex}-${partIndex}`}
          className='flex h-screen flex-col items-center justify-center bg-gray-100 p-4 text-gray-800'
        >
          <h2 className='mb-4 text-3xl font-bold text-gray-900'>
            Questions at {timeKey} seconds
          </h2>
          {questions.length > 0 && (
            <div
              key={`question-${currentQuestionIndex}`}
              className='mb-4 w-full max-w-md rounded-lg bg-white p-5 shadow-lg'
            >
              <h3 className='mb-4 text-2xl font-semibold text-gray-800'>
                {questions[currentQuestionIndex].question}
              </h3>
              <ul
                key={`question-set-${currentQuestionIndex}-${currentTimestamp}`}
                className='space-y-4'
              >
                {questions[currentQuestionIndex].options.map(
                  (option: string, index: number) => (
                    <li key={index} className='flex items-center'>
                      <input
                        type='radio'
                        id={`question-${questions[currentQuestionIndex].question_id}-option-${index}`}
                        name={`question-${questions[currentQuestionIndex].question_id}`}
                        value={option}
                        onChange={() => handleAnswerSelection(option)}
                        className='mr-3 size-5'
                      />
                      <label
                        htmlFor={`question-${questions[currentQuestionIndex].question_id}-option-${index}`}
                        className='text-lg text-gray-700'
                      >
                        {option}
                      </label>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}
          <button
            onClick={goToNextQuestion}
            className='mt-6 rounded bg-gray-800 px-6 py-3 text-white transition-colors duration-300 hover:bg-gray-900'
          >
            {currentQuestionIndex < questions.length - 1
              ? 'Next Question'
              : 'Submit'}
          </button>
        </div>,
      ])
    })
    .flat()

  return (
    <ResizablePanelGroup direction='vertical' className='bg-gray-200 p-2'>
      <KeyboardLock />
      <RightClickDisabler />
      <ResizablePanel defaultSize={95}>
        <div className='flex h-full flex-col'>
          {/* 80% VerticalScrollFrames Section */}
          <div className='relative size-full overflow-hidden'>
            <div
              className='flex size-full flex-col transition-transform duration-300'
              style={{ transform: `translateY(-${currentFrame * 200}%)` }}
            >
              {frames.map((part, index) => (
                <div
                  key={index}
                  className='flex size-full flex-col transition-transform duration-300'
                  style={{ transform: `translateY(-${currentPart * 100}%)` }}
                >
                  {part}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle className='p-1' />
      <ResizablePanel defaultSize={5} className=''>
        {currentPart == 0 ? (
          <div className='controls-container flex w-full justify-center'>
            <div className='w-full border border-white bg-white shadow'>
              <div className='flex items-center justify-between'>
                <div className='flex w-1/2 items-center justify-between'>
                  <button
                    onClick={togglePlayPause}
                    className='rounded-full p-2 text-2xl'
                  >
                    {isPlaying ? <Pause /> : <Play />}
                  </button>
                  <Slider
                    className='w-full'
                    defaultValue={[currentTime]}
                    min={currentTimestamp ?? 0}
                    max={
                      timestamps.find(
                        (timestamp) => timestamp > (currentTimestamp ?? 0)
                      ) ?? totalDuration
                    }
                    step={1}
                    value={[currentTime]}
                    onValueChange={(value) => seekVideo(value[0])}
                  />
                  <div className='ml-6 flex items-center'>
                    <label
                      htmlFor='volume'
                      className='mr-2 text-sm font-medium'
                    >
                      Volume:
                    </label>
                    <Slider
                      defaultValue={[volume]}
                      max={100}
                      step={1}
                      value={[volume]}
                      onValueChange={(value) => changeVolume(value[0])}
                      className='w-24'
                    />
                  </div>
                </div>
                <div className='flex items-center'>
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changePlaybackSpeed(speed)}
                      className={`mx-1 rounded-full px-3 py-1 text-sm ${
                        playbackSpeed === speed ? 'bg-gray-500' : ''
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <div>
                  <button
                    onClick={toggleFullscreen}
                    className='rounded-full p-2 text-xl'
                  >
                    <Fullscreen />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          ''
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}