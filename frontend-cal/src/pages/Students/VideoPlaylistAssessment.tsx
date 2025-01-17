import React, { useState, useEffect, useRef } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import { Fullscreen, Pause, Play } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import RightClickDisabler from '@/components/proctoring-components/RightClickDisable'
import KeyboardLock from '@/components/proctoring-components/KeyboardLock'

const VideoPlaylistAssessment = () => {
  const { setOpen } = useSidebar() // Access setOpen to control the sidebar state
  const hasSetOpen = useRef(false) // Ref to track if setOpen has been called

  useEffect(() => {
    if (!hasSetOpen.current) {
      setOpen(false) // Set the sidebar to closed by default
      hasSetOpen.current = true // Mark as called
    }
  }, [setOpen])

  const [data] = useState([
    {
      sections: [
        {
          section_item_id: 'section_item_id1',
          source: 'WW7YO0b4QHs',
          questions: [
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
        },
        {
          section_item_id: 'section_item_id2',
          source: 'oi64QRZmhgs',
          questions: [
            {
              question_id: 3,
              question: 'What is the capital of India?',
              options: ['New Delhi', 'Mumbai', 'Kolkata'],
              correctAnswer: 'New Delhi',
            },
            {
              question_id: 4,
              question: 'What is 3 + 3?',
              options: ['5', '6', '7'],
              correctAnswer: '6',
            },
          ],
        },
        {
          section_item_id: 'section_item_id3',
          source: 'v65Pbjd_PPY',
          questions: [
            {
              question_id: 5,
              question: 'What is the capital of Japan?',
              options: ['Tokyo', 'Osaka', 'Kyoto'],
              correctAnswer: 'Tokyo',
            },
            {
              question_id: 6,
              question: 'What is 5 + 5?',
              options: ['9', '10', '11'],
              correctAnswer: '10',
            },
          ],
        },
        {
          section_item_id: 'section_item_id4',
          source: 'vfFyAFGKN0M',
          questions: [
            {
              question_id: 7,
              question: 'What is the capital of Germany?',
              options: ['Berlin', 'Munich', 'Frankfurt'],
              correctAnswer: 'Berlin',
            },
            {
              question_id: 8,
              question: 'What is 7 + 7?',
              options: ['13', '14', '15'],
              correctAnswer: '14',
            },
          ],
        },
        {
          section_item_id: 'section_item_id5',
          source: 'LA3R7Tk-8LY',
          questions: [
            {
              question_id: 9,
              question: 'What is the capital of Italy?',
              options: ['Rome', 'Milan', 'Naples'],
              correctAnswer: 'Rome',
            },
            {
              question_id: 10,
              question: 'What is 8 + 8?',
              options: ['15', '16', '17'],
              correctAnswer: '16',
            },
          ],
        },
        {
          section_item_id: 'section_item_id6',
          source: '2LQ2QS9r-Ho',
          questions: [
            {
              question_id: 11,
              question: 'What is the capital of Spain?',
              options: ['Madrid', 'Barcelona', 'Valencia'],
              correctAnswer: 'Madrid',
            },
            {
              question_id: 12,
              question: 'What is 9 + 9?',
              options: ['17', '18', '19'],
              correctAnswer: '18',
            },
          ],
        },
        {
          section_item_id: 'section_item_id7',
          source: '9HDdnbacDO4',
          questions: [
            {
              question_id: 13,
              question: 'What is the capital of Canada?',
              options: ['Ottawa', 'Toronto', 'Vancouver'],
              correctAnswer: 'Ottawa',
            },
            {
              question_id: 14,
              question: 'What is 10 + 10?',
              options: ['19', '20', '21'],
              correctAnswer: '20',
            },
          ],
        },
        {
          section_item_id: 'section_item_id8',
          source: '2XXXSL7hjnI',
          questions: [
            {
              question_id: 15,
              question: 'What is the capital of Australia?',
              options: ['Canberra', 'Sydney', 'Melbourne'],
              correctAnswer: 'Canberra',
            },
            {
              question_id: 16,
              question: 'What is 11 + 11?',
              options: ['21', '22', '23'],
              correctAnswer: '22',
            },
          ],
        },
      ],
    },
  ])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [currentPart, setCurrentPart] = useState(0)
  const playerRefs = useRef(new Array(data[0].sections.length))
  const currentTimeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [totalDuration, setTotalDuration] = useState<number>(0)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [volume, setVolume] = useState<number>(50) // Define volume state here

  const clearTimeInterval = () => {
    if (currentTimeIntervalRef.current) {
      clearInterval(currentTimeIntervalRef.current)
      currentTimeIntervalRef.current = null
    }
  }

  const handleFrameScrollDown = () => {
    setCurrentFrame((prevFrame) => {
      const newFrame = prevFrame < frames.length / 2 - 1 ? prevFrame + 1 : 0
      resetVideoState(newFrame)
      return newFrame
    })
    setCurrentPart(0) // Reset currentPart to 0
    setIsPlaying(false) // Pause the video when switching frames
  }

  const resetVideoState = (newFrame: number) => {
    setTotalDuration(0) // Reset total duration
    setCurrentTime(0) // Reset current time
    const player = playerRefs.current[newFrame]
    if (player) {
      setTotalDuration(player.getDuration()) // Set total duration for new video
      setCurrentTime(0) // Reset current time when switching videos
    }
  }

  useEffect(() => {
    data[0].sections.forEach((section, index) => {
      playerRefs.current[index] = new window.YT.Player(`player-${index}`, {
        events: {
          onReady: (event) => onPlayerReady(event, index),
          onStateChange: handlePlayerStateChange,
        },
      })
    })

    return () => {
      playerRefs.current.forEach((player) => player?.destroy())
    }
  }, [data])

  const handlePlayerStateChange = (event) => {
    const player = playerRefs.current[currentFrame]
    if (event.data === window.YT.PlayerState.PLAYING) {
      if (!currentTimeIntervalRef.current) {
        currentTimeIntervalRef.current = setInterval(() => {
          if (player && isPlaying) {
            setCurrentTime(player.getCurrentTime())
          }
        }, 1000)
      }
    } else {
      clearTimeInterval() // Clear interval if the player is not playing
    }

    if (event.data === window.YT.PlayerState.ENDED) {
      handlePartScrollDown() // Handle video change on end
    }
  }

  useEffect(() => {
    // Ensure to clean up interval on component unmount
    return () => {
      clearTimeInterval()
    }
  }, [])

  console.log('Current Time', currentTime)

  const onPlayerReady = () => {
    const player = playerRefs.current[currentFrame]
    setTotalDuration(player.getDuration())
  }

  const togglePlayPause = () => {
    const player = playerRefs.current[currentFrame]
    if (player) {
      if (isPlaying) {
        player.pauseVideo()
        clearTimeInterval() // Clear interval when pausing
      } else {
        player.playVideo()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleAnswerSelection = (answer) => {
    setSelectedAnswer(answer)
  }

  const frames = data
    .flatMap((frameData, partIndex) => {
      return frameData.sections.map((section, frameIndex) => [
        <div
          key={`video-${frameIndex}`}
          className='flex h-screen items-center justify-center bg-blue-500 text-white'
        >
          <iframe
            id={`player-${frameIndex}`}
            title={`YouTube video player ${frameIndex}`}
            width='100%'
            height='100%'
            src={`https://www.youtube.com/embed/${section.source}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&fs=1&iv_load_policy=3&cc_load_policy=1&autohide=1`}
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
          ></iframe>
        </div>,
        <div
          key={`assessment-${frameIndex}-${partIndex}`}
          className='flex h-screen flex-col items-center justify-center bg-gray-100 p-4 text-gray-800'
        >
          <h2 className='mb-4 text-3xl font-bold text-gray-900'>Questions</h2>
          {section.questions.length > 0 && (
            <div
              key={`question-${currentQuestionIndex}`}
              className='mb-4 w-full max-w-md rounded-lg bg-white p-5 shadow-lg'
            >
              <h3 className='mb-4 text-2xl font-semibold text-gray-800'>
                {section.questions[currentQuestionIndex].question}
              </h3>
              <ul
                key={`question-set-${currentQuestionIndex}`}
                className='space-y-4'
              >
                {section.questions[currentQuestionIndex].options.map(
                  (option: string, index: number) => (
                    <li key={index} className='flex items-center'>
                      <input
                        type='radio'
                        id={`question-${section.questions[currentQuestionIndex].question_id}-option-${index}`}
                        name={`question-${section.questions[currentQuestionIndex].question_id}`}
                        value={option}
                        onChange={() => handleAnswerSelection(option)}
                        className='mr-3 size-5'
                      />
                      <label
                        htmlFor={`question-${section.questions[currentQuestionIndex].question_id}-option-${index}`}
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
            onClick={() => {
              const currentQuestion = section.questions[currentQuestionIndex]
              if (selectedAnswer === currentQuestion.correctAnswer) {
                toast('Correct answer!')
                if (currentQuestionIndex < section.questions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1)
                  setSelectedAnswer('')
                } else {
                  toast('Assessment completed!')
                  handleFrameScrollDown()
                }
              } else {
                toast('Wrong answer!')
                handlePartScrollDown()
              }
            }}
            className='mt-6 rounded bg-gray-800 px-6 py-3 text-white transition-colors duration-300 hover:bg-gray-900'
          >
            {currentQuestionIndex < section.questions.length - 1
              ? 'Next Question'
              : 'Submit'}
          </button>
        </div>,
      ])
    })
    .flat()

  const handlePartScrollDown = () => {
    setCurrentPart((prevPart) => (prevPart < 1 ? prevPart + 1 : 0))
  }

  function seekVideo(time: number): void {
    const player = playerRefs.current[currentFrame]
    if (player) {
      player.seekTo(time, true) // Seek to the time in the video
      setCurrentTime(time) // Update the current time state
    }
  }

  function changePlaybackSpeed(speed: number): void {
    const player = playerRefs.current[currentFrame]
    if (player) {
      player.setPlaybackRate(speed)
    }
  }

  function toggleFullscreen(): void {
    const player = playerRefs.current[currentFrame]
    if (player) {
      const iframe = player.getIframe()
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen()
      } else if (iframe.mozRequestFullScreen) {
        iframe.mozRequestFullScreen()
      } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen()
      } else if (iframe.msRequestFullscreen) {
        iframe.msRequestFullscreen()
      }
    }
  }

  return (
    <ResizablePanelGroup direction='vertical' className='bg-gray-200 p-2'>
      <RightClickDisabler />
      <KeyboardLock />
      <ResizablePanel defaultSize={95}>
        <div className='flex h-full flex-col'>
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
          <button
            onClick={handleFrameScrollDown}
            className='absolute bottom-4 right-4 rounded bg-blue-500 px-4 py-2 text-white'
          >
            Scroll Down
          </button>
        </div>
      </ResizablePanel>
      <ResizableHandle className='p-1' />
      <ResizablePanel defaultSize={5}>
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
                    value={[currentTime]}
                    onValueChange={(value) => {
                      seekVideo(value[0])
                    }}
                    min={0}
                    max={totalDuration}
                    step={1}
                  />
                  <div className='ml-6 flex items-center'>
                    <label
                      htmlFor='volume'
                      className='mr-2 text-sm font-medium'
                    >
                      Volume:
                    </label>
                    <Slider
                      defaultValue={[volume]} // Use volume state here
                      max={100}
                      step={1}
                      onValueChange={(value) => setVolume(value[0])} // Update volume state
                      className='w-24'
                    />
                  </div>
                </div>
                <div className='flex items-center'>
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      className={`mx-1 rounded-full px-3 py-1 text-sm ${
                        playbackSpeed === speed ? 'bg-gray-500' : ''
                      }`}
                      onClick={() => {
                        setPlaybackSpeed(speed)
                        changePlaybackSpeed(speed)
                      }}
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

export default VideoPlaylistAssessment
