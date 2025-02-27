/**
 * @file ContentScrollView2.tsx
 * @description This component handles the rendering and control of various content types (Video, Article, Assessment) within a scrollable view. It integrates YouTube video player functionalities, assessment handling, and state management for user interactions.
 *
 * @component
 * @example
 * <ContentScrollView2 />
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @remarks
 * This component uses several hooks and state variables to manage the content display and user interactions. It includes functionalities for:
 * - Initializing and controlling a YouTube video player.
 * - Handling assessments with questions and options.
 * - Managing playback controls such as play/pause, volume, playback speed, and fullscreen mode.
 * - Displaying progress and handling navigation between different content frames.
 *
 * @requires useRefresh
 * @requires useLocation
 * @requires useState
 * @requires useRef
 * @requires useSidebar
 * @requires useEffect
 * @requires useNavigate
 * @requires useStartAssessmentMutation
 * @requires useSubmitAssessmentMutation
 * @requires useUpdateSectionItemProgressMutation
 * @requires useFetchItemsWithAuthQuery
 * @requires useFetchQuestionsWithAuthQuery
 *
 * @todo
 * - Implement additional error handling and user feedback mechanisms.
 * - Optimize performance for large content sets.
 * - Add more customization options for video player controls.
 *
 * @see {@link https://developers.google.com/youtube/iframe_api_reference} for YouTube IFrame API reference.
 *
 * @typedef {Object} Frame
 * @property {string} item_type - The type of content (Video, Article, Assessment).
 * @property {string} source - The source URL of the content.
 * @property {number} start_time - The start time for video content.
 * @property {number} end_time - The end time for video content.
 * @property {string} title - The title of the content.
 * @property {string} content - The content text (for articles).
 * @property {number} id - The unique identifier for the content item.
 *
 * @typedef {Object} Question
 * @property {number} id - The unique identifier for the question.
 * @property {string} text - The question text.
 * @property {string[]} options - The list of answer options.
 * @property {string} hint - A hint for the question.
 *
 * @typedef {Object} PlayerReadyEvent
 * @property {YT.Player} target - The YouTube player instance.
 *
 * @typedef {Object} PlayerStateChangeEvent
 * @property {number} data - The state change data.
 * @property {YT.Player} target - The YouTube player instance.
 *
 * @typedef {Object} HandleTimeChangeProps
 * @property {number[]} value - The new time value.
 *
 * @typedef {Object} HandleQualityChangeProps
 * @property {'small' | 'medium' | 'large' | 'hd1080' | 'default'} quality - The selected video quality.
 *
 * @typedef {Object} ChangePlaybackSpeedProps
 * @property {number} speed - The new playback speed.
 *
 * @typedef {Object} RenderAssessmentProps
 * @property {Question} question - The question to render.
 *
 * @typedef {Object} GetYouTubeVideoIdProps
 * @property {string} url - The YouTube video URL.
 *
 * @typedef {Object} CustomHTMLElement
 * @property {() => Promise<void>} [webkitRequestFullscreen] - Vendor-prefixed method for fullscreen.
 * @property {() => Promise<void>} [mozRequestFullScreen] - Vendor-prefixed method for fullscreen.
 * @property {() => Promise<void>} [msRequestFullscreen] - Vendor-prefixed method for fullscreen.
 *
 * @typedef {Object} CustomDocument
 * @property {() => Promise<void>} [webkitExitFullscreen] - Vendor-prefixed method to exit fullscreen.
 * @property {() => Promise<void>} [mozCancelFullScreen] - Vendor-prefixed method to exit fullscreen.
 * @property {() => Promise<void>} [msExitFullscreen] - Vendor-prefixed method to exit fullscreen.
 *
 * @BIG COMMENT HERE: VIDEO PLAYER CONTROLLERS FUNCTIONS
 */

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void
  }
}

/**
 *
 *
 *
 * -------------------------------------------------------------------------------------------------------
 * Required Imports
 * -------------------------------------------------------------------------------------------------------
 *
 *
 *
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { useSidebar } from '@/components/ui/sidebar'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Fullscreen, Pause, Play } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import KeyboardLock from '@/components/proctoring-components/KeyboardLock'
import RightClickDisabler from '@/components/proctoring-components/RightClickDisable'
import { useFetchItemsWithAuthQuery } from '@/store/ApiServices/LmsEngine/DataFetchApiServices'
import {
  useStartAssessmentMutation,
  useSubmitAssessmentMutation,
} from '@/store/ApiServices/ActivityEngine/GradingApiServices'
import { useUpdateSectionItemProgressMutation } from '@/store/ApiServices/ActivityEngine/UpdatingApiServices'
import { useFetchQuestionsWithAuthQuery } from '@/store/ApiServices/LmsEngine/DataFetchApiServices'
import Cookies from 'js-cookie'
// import { useDispatch } from 'react-redux'
// import {
//   clearAndFetchProgress,
//   clearProgress,
// } from '@/store/slices/fetchStatusSlice'
// import {
//   clearAndFetchSectionProgress,
//   clearSectionProgress,
// } from '@/store/slices/sectionProgressSlice'
import { useRefresh } from '@/contextApi/refreshContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddQuestion } from '@/components/AddQuestion'

const ContentScrollView2 = () => {
  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Required Hooks and Variables
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  const { triggerRefresh } = useRefresh()
  const location = useLocation()
  const [responseData, setResponseData] = useState<string | null>(null)
  const playerIntervalRef = useRef<number | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const assignment = location.state?.assignment || {}
  const sectionId = location.state?.sectionId
  const courseId = location.state?.courseId
  const { setOpen } = useSidebar()
  const hasSetOpen = useRef(false)
  const [currentFrame, setCurrentFrame] = useState(
    assignment?.sequence ? assignment.sequence - 1 : 0
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const navigate = useNavigate()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  //   const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [selectedOption, setSelectedOption] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [volume, setVolume] = useState(50)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [startAssessment] = useStartAssessmentMutation()
  const [submitAssessment] = useSubmitAssessmentMutation()
  const [updateSectionItemProgress] = useUpdateSectionItemProgressMutation()
  //   const [gradingData, setGradingData] = useState<boolean | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [ytApiReady, setYtApiReady] = useState(false)
  const [videoQuality, setVideoQuality] =
    useState<keyof typeof qualityLabels>('large')
  const { data: assignmentsData } = useFetchItemsWithAuthQuery(sectionId)
  const content = useMemo(() => {
    return (assignmentsData || []) as {
      item_type: string
      source: string
      start_time: number
      end_time: number
      title: string
      content: string
      id: number
    }[]
  }, [assignmentsData])

  useEffect(() => {
    if (!hasSetOpen.current) {
      setOpen(true)
      hasSetOpen.current = true
    }
  }, [setOpen])

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Assessment Countdown Funtionality
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  const [countdown, setCountdown] = useState(30000) // 30 seconds countdown

  useEffect(() => {
    let timer: number | undefined

    const currentContent = content[currentFrame]

    if (currentContent && currentContent.item_type === 'Assessment') {
      setCountdown(30000) // Reset countdown to 30 seconds whenever the frame is an assessment
      timer = window.setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            // Change frame when countdown finishes
            clearInterval(timer)
            const nextFrameIndex = (currentFrame - 1) % content.length
            setCurrentFrame(nextFrameIndex)
            return 30000 // reset countdown if looping
          }
          return prevCountdown - 1
        })
      }, 1000) // Update countdown every second
    }

    // Cleanup function to clear the interval when component unmounts or dependencies change
    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [currentFrame, content, setCurrentFrame])

  const qualityLabels = {
    small: '360p',
    medium: '480p',
    large: '720p',
    hd1080: 'HD 1080p',
    default: 'Auto',
  }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Player Initialization
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // UseEffect to create player for each frame and to close the sidebar
  useEffect(() => {
    // Only load YT API once
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        setYtApiReady(true)
      }
    } else {
      setYtApiReady(true)
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      if (playerIntervalRef.current) {
        clearInterval(playerIntervalRef.current)
      }
      setIsPlayerReady(false)
    }
  }, [])

  // Initialize player when API is ready and frame changes
  useEffect(() => {
    if (!ytApiReady) return

    const initPlayer = () => {
      if (!window.YT?.Player) {
        setTimeout(initPlayer, 100)
        return
      }

      if (playerRef.current) {
        playerRef.current.destroy()
      }

      const currentContent = content[currentFrame]
      if (currentContent?.item_type !== 'Video') return

      const videoId = getYouTubeVideoId({ url: currentContent.source })
      if (!videoId) return

      renderdataByType(currentContent, currentFrame)

      playerRef.current = new window.YT.Player(`player-${currentFrame}`, {
        videoId,
        events: {
          onReady: (event) => {
            setIsPlayerReady(true)
            setCaptionsEnabled(true)
            onPlayerReady(event)
          },
          onStateChange: onPlayerStateChange,
        },
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          fs: 1,
        },
      })
    }

    initPlayer()
    setPlaybackSpeed(1) // Reset the playback speed to 1x when changing frames
  }, [ytApiReady, currentFrame, content])

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Initializing assessment functions
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  const [assessmentId, setAssessmentId] = useState(
    content[currentFrame + 1]?.id
  )

  //Responsible for fetching the questions using RTK Query
  const { data: assessmentData, refetch } =
    useFetchQuestionsWithAuthQuery(assessmentId)
  const AssessmentData = assessmentData as
    | { id: number; text: string; options: string[]; hint: string }[]
    | undefined
  console.log('assessmentData i am question ..................', assessmentData)

  useEffect(() => {
    refetch()
  }, [currentFrame, refetch])

  const fetchAssessment = (currentFrame: number) => {
    setAssessmentId(content[currentFrame + 1].id)
    // Only Fetches the assessment when the next frame is assessment
    if (content[currentFrame + 1].item_type === 'Assessment') {
      const nextAssessmentId = content[currentFrame + 1]?.id
      startAssessment({
        courseInstanceId: courseId,
        assessmentId: nextAssessmentId.toString(),
      })
        .then((response) => {
          if (response.data && response.data.attemptId) {
            setResponseData(response.data.attemptId)
            toast.success('Assessment started successfully!')
          } else {
            throw new Error('No attemptId received')
          }
        })
        .catch(() => {
          toast('Failed to start assessment. Please try again.')
        })
    }
  }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Initializing video player functions
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // When player Get ready this fucntion is called to make things happen in player
  interface PlayerReadyEvent {
    target: YT.Player
  }

  const onPlayerReady = (event: PlayerReadyEvent) => {
    const duration = event.target.getDuration()
    setTotalDuration(duration)
    event.target.setVolume(volume)

    event.target.setPlaybackQuality(videoQuality as YT.SuggestedVideoQuality)

    if (content[currentFrame].item_type === 'Video') {
      const startTime = content[currentFrame].start_time
      const endTime = content[currentFrame].end_time

      setCurrentTime(startTime)
      event.target.seekTo(startTime, true)
      setTotalDuration(endTime - startTime)
    }

    // Start interval to update current time
    playerIntervalRef.current = window.setInterval(() => {
      if (
        playerRef.current &&
        playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING
      ) {
        const currentPlayerTime = playerRef.current.getCurrentTime()
        setCurrentTime(currentPlayerTime)
      }
    }, 1000)
  }

  // Whenever the state of video changed like pause , play , ended this funtion is called
  interface PlayerStateChangeEvent {
    data: number
    target: YT.Player
  }

  const onPlayerStateChange = (event: PlayerStateChangeEvent) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true)
      // Clear any existing intervals to avoid duplicates
      if (playerIntervalRef.current) {
        clearInterval(playerIntervalRef.current)
      }
      // Start updating time
      playerIntervalRef.current = window.setInterval(() => {
        if (!playerRef.current) return
        const currentPlayerTime = playerRef.current.getCurrentTime()
        const endTime = content[currentFrame].end_time
        console.log(
          'current Time : ',
          currentPlayerTime,
          'end Time : ',
          endTime
        )

        if (currentPlayerTime >= endTime) {
          playerRef.current.pauseVideo() // Pause at end time
          if (playerIntervalRef.current !== null) {
            clearInterval(playerIntervalRef.current) // Clear interval
          }
          setCurrentFrame((prevFrame) => (prevFrame + 1) % content.length)
          setSelectedOption([])
          setSelectedOption([])
          setCurrentQuestionIndex(0)
          setIsPlaying(false)
          fetchAssessment(currentFrame)
        } else {
          setCurrentTime(currentPlayerTime)
        }
      }, 1000)
    } else if (
      event.data === window.YT.PlayerState.PAUSED ||
      event.data === window.YT.PlayerState.ENDED
    ) {
      setIsPlaying(false)
      // Clear interval when paused or ended
      if (playerIntervalRef.current) {
        clearInterval(playerIntervalRef.current)
      }
    }
  }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Navigation functions
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // This funtion is to go forward to the next frame
  const handleNextFrame = async () => {
    setCurrentFrame((prevFrame) => (prevFrame + 1) % content.length)
    setSelectedOption([])
    setSelectedOption([])
    setCurrentQuestionIndex(0)
    setCurrentTime(0)
    setIsPlaying(false)
    fetchAssessment(currentFrame)
  }

  // This funtion is responsible to go backward to the last frame
  //   const handlePrevFrame = () => {
  //     const nextFrameIndex = (currentFrame - 1 + content.length) % content.length
  //     localStorage.setItem('nextFrame', nextFrameIndex.toString())

  //     window.location.reload()
  //   }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Assessment answer handling functions
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // This funtion is to move to the next question
  // const handleNextQuestion = () => {
  //   if (selectedOption === null) return

  //   setSelectedAnswer(selectedOption)
  //   const question = questions[0].results[currentQuestionIndex]
  //   const isCorrect = selectedOption === question.answer
  //   setIsAnswerCorrect(isCorrect)

  //   if (!isCorrect) {
  //     toast('Incorrect Answer! Please try again.', { type: 'error' })
  //     handlePrevFrame()
  //   } else {
  //     setSelectedOption([])
  //     setCurrentQuestionIndex(
  //       (prevIndex) => (prevIndex + 1) % AssessmentData.length
  //     )
  //   }
  // }

  // This funtion called when user submits the assessment

  const handleSubmit = () => {
    const question =
      AssessmentData && AssessmentData[currentQuestionIndex]
        ? AssessmentData[currentQuestionIndex]
        : null
    submitAssessment({
      assessmentId: assessmentId,
      courseId: courseId,
      attemptId: responseData ? parseInt(responseData, 10) : 0,
      questionId: question ? question.id : 0,
      answers: selectedOption.map(Number).join(','),
    })
      .then((response) => {
        if (response.data) {
          Cookies.set('gradingData', response.data.isAnswerCorrect.toString())
          //   setGradingData(response.data.isAnswerCorrect)
          if (response.data.isAnswerCorrect === false) {
            // const nextFrameIndex =
            //   (currentFrame - 1 + content.length) % content.length
            // localStorage.setItem('nextFrame', nextFrameIndex)
            // toast('Incorrect Answer! The segment will now run again.')
            // setTimeout(() => {
            //   window.location.reload()
            // }, 2000)
            toast('Incorrect Answer! The segment will now run again.')
            setCurrentFrame((prevFrame) => (prevFrame - 1) % content.length)
          } else {
            toast('Correct Answer! Moving to the next segment !')
            const sectionItemId1 = `${content[currentFrame - 1].id}`
            const sectionItemId2 = `${content[currentFrame].id}`

            updateSectionItemProgress({
              courseInstanceId: courseId,
              sectionItemId: [sectionItemId1, sectionItemId2],
              cascade: true,
            })
              .then((response) => {
                if (response.data) {
                  //   interface SectionItem {
                  //     sectionItems: string[]
                  //     sections: string[]
                  //   }
                  //   interface UpdateSectionItemProgressResponse {
                  //     data: SectionItem[]
                  //   }
                  //   const handleUpdateProgress = (
                  //     response: UpdateSectionItemProgressResponse
                  //   ) => {
                  //     response.data.forEach((item) => {
                  //       if (Array.isArray(item.sectionItems)) {
                  //         item.sectionItems.forEach((sectionItemId: string) => {
                  //           const newCourseInstanceId = courseId
                  //           const newSectionItemId = sectionItemId
                  //           dispatch(
                  //             clearProgress({
                  //               courseInstanceId: newCourseInstanceId,
                  //               sectionItemId: newSectionItemId,
                  //             })
                  //           )
                  //           dispatch(
                  //             clearAndFetchProgress({
                  //               courseInstanceId: newCourseInstanceId,
                  //               sectionItemId: newSectionItemId,
                  //             })
                  //           )
                  //         })
                  //       }
                  //       if (Array.isArray(item.sections)) {
                  //         item.sections.forEach((newsectionId: string) => {
                  //           dispatch(
                  //             clearSectionProgress({
                  //               courseInstanceId: courseId,
                  //               sectionId: newsectionId,
                  //             })
                  //           )
                  //           dispatch(
                  //             clearAndFetchSectionProgress({
                  //               courseInstanceId: courseId,
                  //               sectionId: newsectionId,
                  //             })
                  //           )
                  //         })
                  //       }
                  //       // Uncomment and add a similar check for item.modules if needed
                  //       // if (Array.isArray(item.modules)) {
                  //       //   dispatch(clearModuleProgress({
                  //       //     courseInstanceId: courseId,
                  //       //     moduleId: item.modules,
                  //       //   }));
                  //       // }
                  //     })
                  //   }
                } else {
                  console.error('Failed to update progress.')
                }
              })
              .catch((error) => {
                console.error('Failed to update progress.', error)
              })
            const newframe = currentFrame + 1
            triggerRefresh()
            if (newframe !== content.length) {
              setCurrentFrame((prevFrame) => (prevFrame + 1) % content.length)
              setSelectedOption([])
              setSelectedOption([])
              setCurrentQuestionIndex(0)
              setCurrentTime(0)
              setIsPlaying(false)
              fetchAssessment(currentFrame)
            } else navigate('/')
          }
        }
      })
      .catch(() => {
        toast('Failed to submit assessment. Please try again.')
      })
  }

  // This funtion is responsible to set the selected option after click on any option of question by user
  // const handleOptionClick = (option) => {
  //   setSelectedOption(option)
  // }
  const handleOptionClick = (option: string) => {
    setSelectedOption((prevSelected) => {
      if (prevSelected.includes(option)) {
        // If already selected, remove it (undo selection)
        return prevSelected.filter((id) => id !== option)
      } else {
        // Otherwise add it to the list
        return [...prevSelected, option]
      }
    })
  }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * VIDEO PLAYER CONTROLLERS FUNCTIONS
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // This funtion is used to change the current time using slider of youtube video progress bar
  interface HandleTimeChangeProps {
    value: number[]
  }

  const handleTimeChange = ({ value }: HandleTimeChangeProps) => {
    if (!isPlayerReady) return
    const newTime = value[0]
    setCurrentTime(newTime)
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, true)
    }
  }

  // Funtion responsible in changing the volume of the video
  const handleVolumeChange = (value: number[]) => {
    if (!isPlayerReady) return
    setVolume(value[0])
    playerRef.current?.setVolume(value[0])
  }

  interface HandleQualityChangeProps {
    quality: 'small' | 'medium' | 'large' | 'hd1080' | 'default'
  }

  const handleQualityChange = ({ quality }: HandleQualityChangeProps) => {
    setVideoQuality(quality)
    if (playerRef.current) {
      playerRef.current.setPlaybackQuality(quality as YT.SuggestedVideoQuality)
    }
  }

  const [captionsEnabled, setCaptionsEnabled] = useState(false)

  interface ExtendedPlayer extends YT.Player {
    loadModule(moduleName: string): void
    unloadModule(moduleName: string): void
    setOption(module: string, option: string, value: unknown): void
  }

  // Function to toggle captions
  const toggleCaptions = () => {
    const player = playerRef.current as ExtendedPlayer | null
    if (!captionsEnabled) {
      setCaptionsEnabled(true)
      if (player) {
        player.loadModule('captions') // Load the caption module
        player.setOption('captions', 'track', { languageCode: 'en' }) // English captions
      }
    } else {
      setCaptionsEnabled(false)
      if (player) {
        player.unloadModule('captions') // Unload the caption module
      }
    }
  }

  // Effect to handle changes in captions state
  useEffect(() => {
    const player = playerRef.current as ExtendedPlayer | null
    if (captionsEnabled && player) {
      player.loadModule('captions') // Load captions if enabled
      player.setOption('captions', 'track', { languageCode: 'en' })
    } else if (player) {
      player.unloadModule('captions') // Unload captions if disabled
    }
  }, [captionsEnabled])

  // This funtion is responsible in for working of play/pause toggle button
  const togglePlayPause = () => {
    if (!isPlayerReady || !playerRef.current) return
    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  // This funtion is for changing the speed of Video
  interface ChangePlaybackSpeedProps {
    speed: number
  }

  const changePlaybackSpeed = ({ speed }: ChangePlaybackSpeedProps) => {
    if (!isPlayerReady) return
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(speed)
    }
    setPlaybackSpeed(speed)
  }

  interface CustomHTMLElement extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>
    mozRequestFullScreen?: () => Promise<void>
    msRequestFullscreen?: () => Promise<void>
  }

  interface CustomDocument extends Document {
    webkitExitFullscreen?: () => Promise<void>
    mozCancelFullScreen?: () => Promise<void>
    msExitFullscreen?: () => Promise<void>
  }

  // This funtion is to chnage the player to full screen mode
  const toggleFullscreen = () => {
    const player = document.getElementById(
      `player-${currentFrame}`
    ) as CustomHTMLElement | null

    if (player) {
      if (!document.fullscreenElement) {
        if (player.requestFullscreen) {
          player.requestFullscreen()
        } else {
          // Access vendor-prefixed methods using the extended interface
          player.webkitRequestFullscreen?.()
          player.mozRequestFullScreen?.()
          player.msRequestFullscreen?.()
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen()
        } else {
          // Access vendor-prefixed methods on the document
          ;(document as CustomDocument).webkitExitFullscreen?.()
          ;(document as CustomDocument).mozCancelFullScreen?.()
          ;(document as CustomDocument).msExitFullscreen?.()
        }
      }
    }
  }

  // This useeffect ensures that whenever the page reloads the currentframe should not be change
  useEffect(() => {
    const savedFrame = localStorage.getItem('nextFrame')
    if (savedFrame !== null) {
      setCurrentFrame(parseInt(savedFrame))
      localStorage.removeItem('nextFrame')
    }
  }, [])

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * ASSESSMENT RENDERING FUNCTIONS
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  // This funtion create the interface of assessment that exactly how the assessment will look like
  interface Question {
    id: number
    text: string
    options: string[]
    hint: string
  }

  interface RenderAssessmentProps {
    question: Question
  }

  const renderAssessment = ({ question }: RenderAssessmentProps) => {
    if (!AssessmentData || AssessmentData.length === 0) {
      return <div>No assessment data available.</div>
    }

    if (
      currentQuestionIndex < 0 ||
      currentQuestionIndex >= AssessmentData.length
    ) {
      return <div>Invalid question index.</div>
    }

    return (
      <div className='justify-top flex h-screen w-full flex-col bg-gray-50 px-8 pb-8 pt-4 text-gray-800 shadow-lg'>
        <div className='mb-16 ml-auto flex items-center gap-4'>
          <AddQuestion />
          Time Remaining:{' '}
          <span className='font-bold text-red-500'>{countdown} seconds</span>
        </div>
        <h3 className='mb-6 w-full text-3xl font-bold text-gray-900'>
          {question.text}
        </h3>
        <ul className='mb-4'>
          {question.options.map((option: string) => (
            <li key={option} className='mb-2'>
              <button
                onClick={() => handleOptionClick(option)}
                className={`w-full rounded-lg border border-gray-300 px-4 py-2 text-left ${
                  selectedOption?.includes(option)
                    ? 'bg-green-500 text-white'
                    : 'bg-white hover:bg-gray-100'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
        <small className='mb-6 text-gray-600'>{question.hint}</small>
        <div className='space-x-4'>
          <button
            onClick={() =>
              setCurrentQuestionIndex((prevIndex) => Math.max(prevIndex - 1, 0))
            }
            disabled={currentQuestionIndex === 0}
            className='rounded-lg bg-blue-500 px-6 py-2 text-white shadow disabled:bg-gray-300'
          >
            Previous
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedOption?.length === 0}
            className='rounded-lg bg-green-500 px-6 py-2 text-white shadow'
          >
            Submit
          </button>
        </div>
      </div>
    )
  }

  // As we are getting url from the backend and need VideoId for the player so this funtion convert the url to videoId
  interface GetYouTubeVideoIdProps {
    url: string
  }

  const getYouTubeVideoId = ({
    url,
  }: GetYouTubeVideoIdProps): string | null => {
    try {
      const parsedUrl = new URL(url)
      let videoId: string | null
      if (parsedUrl.hostname === 'youtu.be') {
        videoId = parsedUrl.pathname.slice(1)
      } else {
        videoId = parsedUrl.searchParams.get('v')
      }

      if (!videoId) {
        return null
      }
      return videoId
    } catch {
      return null
    }
  }

  // This funtion is used for switch case according to the data that whenever the data type is video , assessment or article it will display the frame according to the type
  interface Frame {
    item_type: string
    source: string
    start_time: number
    end_time: number
    title: string
    content: string
    id: number
  }

  /**
   *
   *
   *
   * -------------------------------------------------------------------------------------------------------
   * Switch case for rendering content by type
   * -------------------------------------------------------------------------------------------------------
   *
   *
   *
   */

  const renderdataByType = (frame: Frame, index: number) => {
    let videoId: string | null = null
    videoId = getYouTubeVideoId({ url: content[currentFrame].source })

    switch (content[currentFrame].item_type) {
      case 'Video':
        return (
          <iframe
            key={`player-${index}`}
            id={`player-${index}`}
            title={content[currentFrame].title}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&controls=0&modestbranding=1&showinfo=0&fs=1&iv_load_policy=3&cc_load_policy=0&autohide=1`}
            frameBorder='0'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
            className='pointer-events-none size-full cursor-none'
            loading='lazy'
          ></iframe>
        )
      case 'article':
        // Render article content with a scroll area and next button
        return (
          <div>
            <ScrollArea>{frame.content}</ScrollArea>
            <div className='mt-4 flex justify-end'>
              <Button onClick={handleNextFrame}>Next Part</Button>
            </div>
          </div>
        )
      case 'Assessment':
        // Render assessment questions if data is available
        if (AssessmentData && AssessmentData.length > 0) {
          return renderAssessment({
            question: AssessmentData[currentQuestionIndex],
          })
        } else {
          return <div>No assessment data available.</div>
        }

      default:
        // Fallback for unknown content types
        return <p>No specific type assigned</p>
    }
  }

  return (
    //These are the resizable panels with can be resized by dragging the resizable handle
    <ResizablePanelGroup direction='horizontal'>
      <ResizablePanel defaultSize={95} className='z-10'>
        <ResizablePanelGroup direction='vertical' className='bg-gray-200 p-2'>
          {/* Proctoring components */}
          <KeyboardLock />
          <RightClickDisabler />

          {/* Main content panel - 90% height */}
          <ResizablePanel defaultSize={90}>
            <div className='flex h-full flex-col'>
              <div className='relative h-full overflow-hidden'>
                <div
                  className='absolute size-full transition-transform duration-300'
                  style={{ transform: `translateY(-${currentFrame * 100}%)` }}
                >
                  {/* Map through content frames and render based on type */}
                  {content.map((frame, index) => (
                    <div
                      key={index}
                      className='flex size-full h-full flex-col items-center justify-center'
                    >
                      {renderdataByType(frame, index)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Resizable handle between panels */}
          <ResizableHandle className='p-1' />

          {/* Controls panel - 10% height */}
          <ResizablePanel defaultSize={10} className=''>
            <div className='controls-container flex w-full justify-center'>
              <div className='w-full border border-white bg-white shadow'>
                <div className='flex items-center justify-between'>
                  {/* Left section: Play/Pause, Next, Time slider, Volume */}
                  <div className='flex w-1/2 items-center justify-between'>
                    <button
                      onClick={togglePlayPause}
                      className='rounded-full p-2 text-2xl'
                      disabled={!isPlayerReady}
                    >
                      {isPlaying ? <Pause /> : <Play />}
                    </button>
                    <Slider
                      value={[currentTime]}
                      onValueChange={(value) => {
                        const newTime = value[0]
                        if (newTime <= currentTime) {
                          handleTimeChange({ value })
                        }
                      }}
                      min={content[currentFrame]?.start_time || 0}
                      max={content[currentFrame]?.end_time || totalDuration}
                      step={1}
                      className='w-48'
                      disabled={!isPlayerReady}
                    />
                    <div className='ml-6 flex items-center'>
                      <label
                        htmlFor='volume'
                        className='mr-2 text-sm font-medium'
                      >
                        Volume:
                      </label>
                      <Slider
                        value={[volume]}
                        onValueChange={handleVolumeChange}
                        min={0}
                        max={100}
                        step={1}
                        className='w-24'
                        disabled={!isPlayerReady}
                      />
                    </div>
                  </div>

                  {/* Center section: Playback speed controls */}
                  <div className='flex items-center'>
                    {[0.5, 1, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        className={`mx-1 rounded-full px-3 py-1 text-sm ${
                          playbackSpeed === speed
                            ? 'bg-gray-500'
                            : 'bg-gray-200'
                        }`}
                        onClick={() => {
                          setPlaybackSpeed(speed)
                          changePlaybackSpeed({ speed })
                        }}
                        disabled={!isPlayerReady}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button disabled={!isPlayerReady}>
                        {qualityLabels[videoQuality]}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleQualityChange({ quality: 'small' })
                        }
                      >
                        360p
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleQualityChange({ quality: 'medium' })
                        }
                      >
                        480p
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleQualityChange({ quality: 'large' })
                        }
                      >
                        720p
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleQualityChange({ quality: 'hd1080' })
                        }
                      >
                        HD 1080p
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          handleQualityChange({ quality: 'default' })
                        }
                      >
                        Auto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className='flex items-center'>
                    {/* Existing buttons for play/pause, etc. */}
                    <button
                      onClick={toggleCaptions}
                      className={`ml-4 rounded-full px-3 py-1 text-sm ${
                        captionsEnabled ? 'bg-black text-white' : 'bg-gray-200'
                      }`}
                      title='Toggle Captions'
                    >
                      {captionsEnabled ? 'Hide Captions' : 'Show Captions'}
                    </button>
                  </div>

                  {/* Right section: Fullscreen toggle */}
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle className='p-1' />
      <ResizablePanel defaultSize={5} className='z-20'>
        <div className='flex size-full flex-col items-center justify-center bg-gray-100 p-2'>
          <h4 className='mb-4 text-center text-sm font-semibold'>Progress</h4>
          <span className='mb-4 text-sm'>
            {Math.round(((currentFrame + 1) / content.length) * 100)}%
          </span>
          <div className='relative h-full w-4 rounded-xl bg-gray-300'>
            <div
              className='absolute left-0 w-full rounded-xl bg-black'
              style={{
                height: `${((currentFrame + 1) / content.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default ContentScrollView2
