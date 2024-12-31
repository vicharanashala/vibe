import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import React, { useEffect, useRef, useState } from "react";

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}
import KeyboardLock from "@/components/proctoring-components/KeyboardLock";
import RightClickDisabler from "@/components/proctoring-components/RightClickDisable";
import { Fullscreen, Pause, Play } from "lucide-react";
import { Slider } from "@/components/ui/slider"


interface Question {
    question: string;
    options: string[];
    correctAnswer: string;
}

export default function VideoAssessment({ ...props }: React.ComponentProps<typeof Sidebar>) {

    const { setOpen } = useSidebar(); // Access setOpen to control the sidebar state
    const hasSetOpen = useRef(false); // Ref to track if setOpen has been called

    useEffect(() => {
        if (!hasSetOpen.current) {
            setOpen(false); // Set the sidebar to closed by default
            hasSetOpen.current = true; // Mark as called
        }
    }, [setOpen]);

    const videoPlayerRef = useRef<HTMLDivElement>(null);
    const [player, setPlayer] = useState<YT.Player | null>(null);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [showPopup, setShowPopup] = useState<boolean>(false);
    const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [totalDuration, setTotalDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(50);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
    const triggeredTimestamps = useRef<Set<number>>(new Set());
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string>("");
    const [timestamps, setTimestamps] = useState<number[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [currentPart, setCurrentPart] = useState(0);

    useEffect(() => {
        setCurrentPart(0);
    }, [currentFrame]);
    const [data] = useState([
        {
            video: "1z-E_KOC2L0",
            timestamps: {
                5: [
                    {
                        question_id: 1,
                        question: "What is the capital of France?",
                        options: ["Paris", "London", "Berlin"],
                        correctAnswer: "Paris",
                    },
                    {
                        question_id: 2,
                        question: "What is 2 + 2?",
                        options: ["3", "4", "5"],
                        correctAnswer: "4",
                    },
                ],
                10: [
                    {
                        question_id: 3,
                        question: "What is the capital of India?",
                        options: ["Paris", "London", "Berlin"],
                        correctAnswer: "Berlin",
                    },
                    {
                        question_id: 4,
                        question: "What is 2 + 3?",
                        options: ["3", "4", "5"],
                        correctAnswer: "5",
                    },
                ],
                15: [
                    {
                        question_id: 5,
                        question: "What is the capital of France?",
                        options: ["Paris", "London", "Berlin"],
                        correctAnswer: "Paris",
                    },
                    {
                        question_id: 6,
                        question: "What is 2 + 2?",
                        options: ["3", "4", "5"],
                        correctAnswer: "4",
                    },
                ],
            },
        },
    ]);
    
    console.log("current Part",currentPart)

    useEffect(() => {
        const videoData = data[0]; // Assuming single video data
        const ts = Object.keys(videoData.timestamps).map(Number);
        setTimestamps(ts);
        console.log(ts)
    }, [data]);

    useEffect(() => {
    // Function to clean up the existing player
    function cleanupPlayer() {
        if (window.player && window.player.destroy) {
            window.player.destroy();
        }
    }

    // Load the IFrame Player API code asynchronously, if not already loaded
    const setupYouTubeScript = () => {
        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = createPlayer;
        }
    };

    // Create a new YT.Player when the API is ready
    const createPlayer = () => {
        cleanupPlayer(); // Clean up any existing player instance
        window.player = new YT.Player(`player-${currentFrame}`, {
            videoId: data.video, // Ensure this matches the updated data source
            events: {
                onReady: onPlayerReady,
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
            },
        });
    };

    setupYouTubeScript();

    return () => {
        cleanupPlayer(); // Clean up on component unmount or before re-running this effect
    };
}, [currentFrame]); // Re-run this effect when `currentFrame` changes

    useEffect(() => {
        let interval: NodeJS.Timeout | undefined;
        console.log("is playing", isPlaying)
        if (isPlaying) {
            interval = setInterval(() => {
                if ((window as any).player) {
                    const current = (window as any).player.getCurrentTime();
                    setCurrentTime(current);
                    console.log("current", current);

                    const currentTimestamp = Math.floor(current);
                    console.log("currentTimestamp", currentTimestamp);
                    if (
                        timestamps.includes(currentTimestamp) &&
                        !triggeredTimestamps.current.has(currentTimestamp)
                    ) {
                        triggeredTimestamps.current.add(currentTimestamp);
                        console.log("triggeredTimestamps", triggeredTimestamps.current);
                        pauseVideoAndShowPopup(currentTimestamp);
                    }
                }
            }, 500);
        } else {
            if (interval) clearInterval(interval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, player, timestamps]);


    const onPlayerReady = (event: YT.PlayerEvent) => {
        const duration = event.target.getDuration();
        setTotalDuration(duration);
        player?.setVolume(volume);
        setPlaybackSpeed(player?.getPlaybackRate() ?? 1);
    };

    const pauseVideoAndShowPopup = (timestamp: number) => {
        if ((window as any).player) {
            (window as any).player.pauseVideo();
            setIsPlaying(false);
        }
        setCurrentTimestamp(timestamp);
        setQuestions(data[0].timestamps[timestamp]); // Load questions for this timestamp
        setSelectedAnswer(""); // Clear previous selections
        setCurrentQuestionIndex(0); // Start at the first question for this timestamp
        setCurrentPart((prevPart) => (prevPart < 1 ? prevPart + 1 : 0));
    };

    console.log("bukla",(window as any).player)

    const handleIncorrectAnswer: () => void = () => {
        if (currentTimestamp !== null) {
            const lastTimestamp = [...triggeredTimestamps.current]
                .filter((t) => t < currentTimestamp)
                .sort((a, b) => b - a)[0];
            const resetTime = lastTimestamp ?? 0;
            setCurrentTime(resetTime);
            if ((window as any).player) {
                (window as any).player.seekTo(resetTime, true);
                (window as any).player.playVideo();
                setIsPlaying(true);
            }
            triggeredTimestamps.current.delete(currentTimestamp);
            setShowPopup(false); // Close the popup
        }
        alert("Wrong answer. Try again!");
        handlePartScrollDown(); // Scroll the part down when the answer is incorrect
    };

    const goToNextQuestion = () => {
        const currentQuestion = questions[currentQuestionIndex];
        if (selectedAnswer !== currentQuestion.correctAnswer) {
            handleIncorrectAnswer();
            setSelectedAnswer(""); // Clear the selection for the current question
            return;
        }

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedAnswer(""); // Reset selected answer for the new question
        } else {
            handleFrameScrollUp(); // Scroll the frame up when both answers are correct
            closePopup(); // Reset state when all questions are answered
        }
    };

    const closePopup = () => {
        setShowPopup(false);
        setCurrentQuestionIndex(0); // Reset question index
        setSelectedAnswer(""); // Clear selected answer
        setQuestions([]); // Clear the current questions
    };

    const onPlayerStateChange = (event: YT.OnStateChangeEvent) => {
        if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
        } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
        }
    };


    const handleAnswerSelection = (answer: string) => {
        setSelectedAnswer(answer);
    };

    const togglePlayPause = () => {
        if (isPlaying) {
            (window as any).player.pauseVideo();
        } else {
            (window as any).player.playVideo();
            // Ensure the video seeks to the current timestamp before playing
            (window as any).player.seekTo(currentTime, true);
        }
        setIsPlaying(!isPlaying);
    };

    const seekVideo = (newTime: number) => {
        if ((window as any).player && newTime <= totalDuration) {
            (window as any).player.seekTo(newTime, true);  // Seek to the current time
            setCurrentTime(newTime);
        } else {
            console.log("Attempting to seek to an invalid time.");
        }
    };

    const changeVolume = (newVolume: number) => {
        setVolume(newVolume);
        (window as any).player?.setVolume(newVolume);
    };

    const changePlaybackSpeed = (speed: number) => {
        (window as any).player?.setPlaybackRate(speed);
        setPlaybackSpeed(speed);
    };

    const toggleFullscreen = () => {
        const videoContainer = document.querySelector(
            ".video-container"
        ) as HTMLElement;
        if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
        } else if ((videoContainer as any).mozRequestFullScreen) {
            (videoContainer as any).mozRequestFullScreen();
        } else if ((videoContainer as any).webkitRequestFullscreen) {
            (videoContainer as any).webkitRequestFullscreen();
        } else if ((videoContainer as any).msRequestFullscreen) {
            (videoContainer as any).msRequestFullscreen();
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    const handleFrameScrollUp = () => {
        setCurrentFrame((prevFrame) => {
            if (currentPart > 0) {
                // Ensure part transitions within the same frame
                setCurrentPart(currentPart - 1);
                return prevFrame + 1;
            } else {
                // Move to the previous frame when all parts are completed
                setCurrentPart(1); // Reset part to the last part
                return prevFrame > 0 ? prevFrame - 1 : (frames.length / 2) - 1; // Decrement frame or loop back
            }
            seekVideo(currentTime);
        });
    };


    const handleFrameScrollDown = () => {
        setCurrentFrame((prevFrame) =>
            prevFrame < frames.length / 2 - 1 ? prevFrame + 1 : 0
        );
        seekVideo(currentTime);
        console.log("current Frame",currentFrame)
    };

    const handlePartScrollUp = () => {
        setCurrentPart((prevPart) => (prevPart > 0 ? prevPart - 1 : 1));
    };

    const handlePartScrollDown = () => {
        setCurrentPart((prevPart) => (prevPart < 1 ? prevPart + 1 : 0));
    };

    const frames = data
        .flatMap((frameData, frameIndex) => {
            const videoUrl = `https://www.youtube.com/embed/${frameData.video}?enablejsapi=1&controls=0&rel=0&modestbranding=1&showinfo=0&fs=1&iv_load_policy=3&cc_load_policy=1&autohide=1`;
            console.log("lulululluulooo", frameIndex)
            return Object.keys(frameData.timestamps).map((timeKey, partIndex) => [
                <div
                    key={`video-${frameIndex}-${partIndex}`}
                    className="h-screen bg-blue-500 text-white flex justify-center items-center"
                >
                    <iframe
                        id={`player-${partIndex}`}
                        width="100%"
                        height="100%"
                        src={videoUrl}
                        title="YouTube video player"
                        style={{ border: 0, pointerEvents: 'none', cursor: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>,
                <div
                    key={`assessment-${frameIndex}-${partIndex}`}
                    className="h-screen bg-cyan-500 text-white flex flex-col justify-center items-center p-4"
                >
                    <h2 className="mb-4 text-2xl font-bold">Questions at {timeKey} seconds</h2>
                    {questions.length > 0 && (
                        <div className="mb-4 w-full max-w-md">
                            <h3 className="text-xl font-semibold mb-2">{questions[currentQuestionIndex].question}</h3>
                            <ul className="space-y-2">
                                {questions[currentQuestionIndex].options.map((option, index) => (
                                    <li key={index} className="flex items-center">
                                        <input
                                            type="radio"
                                            id={`question-${questions[currentQuestionIndex].question_id}-option-${index}`}
                                            name={`question-${questions[currentQuestionIndex].question_id}`}
                                            value={option}
                                            className="mr-2"
                                            onChange={() => handleAnswerSelection(option)}
                                        />
                                        <label htmlFor={`question-${questions[currentQuestionIndex].question_id}-option-${index}`}>
                                            {option}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button
                        onClick={goToNextQuestion}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Submit"}
                    </button>
                </div>,
            ]);
        })
        .flat();


    
    

    return (
        <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={80}>
                <div className="flex flex-col h-full">
                    {/* 80% VerticalScrollFrames Section */}
                    <div className="w-full h-[100%] overflow-hidden relative">
                        <div
                            className="w-full h-full flex flex-col transition-transform duration-300"
                            style={{ transform: `translateY(-${currentFrame * 200}%)` }}
                        >
                            {frames.map((part, index) => (
                                <div
                                    key={index}
                                    className="w-full h-full flex flex-col transition-transform duration-300"
                                    style={{ transform: `translateY(-${currentPart * 100}%)` }}
                                >
                                    {part}
                                </div>
                            ))}
                        </div>

                        {/* External Scroll Buttons */}
                        <button
                            onClick={handleFrameScrollUp}
                            className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full"
                        >
                            ↑ Frame
                        </button>
                        <button
                            onClick={handleFrameScrollDown}
                            className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full"
                        >
                            ↓ Frame
                        </button>

                        {/* Internal Scroll Buttons */}
                        <button
                            onClick={handlePartScrollUp}
                            className="absolute top-1/4 left-4 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full"
                        >
                            ↑ Part
                        </button>
                        <button
                            onClick={handlePartScrollDown}
                            className="absolute top-3/4 left-4 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full"
                        >
                            ↓ Part
                        </button>
                        {currentPart !== 1 && (
                        <div className='controls-container w-full h-1/6 flex justify-center'>
                            <div className="w-1/2 mx-auto p-4 rounded-lg shadow border border-white bg-white absolute bottom-0 left-0 right-0 h-1/6">
                                <div className="mt-2">
                                    <Slider
                                        defaultValue={[currentTime]}
                                        min={currentTimestamp ?? 0}
                                        max={
                                            timestamps.find((timestamp) => timestamp > (currentTimestamp ?? 0)) ??
                                            totalDuration
                                        }
                                        step={1}
                                        value={[currentTime]}
                                        onValueChange={(value) => seekVideo(value[0])}
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <button
                                            onClick={togglePlayPause}
                                            className="text-2xl p-2 rounded-full"
                                        >
                                            {isPlaying ? <Pause /> : <Play />}
                                        </button>
                                        <div className="ml-6 flex items-center">
                                            <label htmlFor="volume" className="mr-2 text-sm font-medium">
                                                Volume:
                                            </label>
                                            <Slider
                                                defaultValue={[volume]}
                                                max={100}
                                                step={1}
                                                value={[volume]}
                                                onValueChange={(value) => changeVolume(value[0])}
                                                className="w-24"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        {[0.5, 1, 1.5, 2].map((speed) => (
                                            <button
                                                key={speed}
                                                onClick={() => changePlaybackSpeed(speed)}
                                                className={`mx-1 px-3 py-1 text-sm rounded-full ${playbackSpeed === speed ? "bg-gray-500" : ""
                                                    }`}
                                            >
                                                {speed}x
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <button
                                            onClick={toggleFullscreen}
                                            className="text-xl p-2 rounded-full"
                                        >
                                            <Fullscreen />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={20}>
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={80}>Transcript</ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={20}>FaceCam</ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};