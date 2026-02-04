import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { useNavigate } from '@tanstack/react-router';;
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadParams, YoutubeUrlInput } from "./AiWorkflow";
import { AudioTranscripter } from "./AudioTranscripter";
import { TranscriberData } from "@/hooks/useTranscriber";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";
import { aiSectionAPI, Chunk, QuestionGenerationParameters, SegmentationParameters } from "@/lib/genai-api";
import { CurrentJob } from "./AiWorkflow";


// const YT_IFRAME_API_SRC = "https://www.youtube.com/iframe_api"



const AiModule = () => {
    const { currentCourse } = useCourseStore();
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [isURLValidated, setIsURLValidated] = useState(false)
    const [isLoading, setIsLoading] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [aiJobId, setAiJobId] = useState<string | null>(null);
    // const [videoPlayer, setVideoPlayer] = useState(false);
    const [videoId, setVideoId] = useState<string | null>("");
    // const [isYTReady, setIsYTReady] = useState(false);
    const [isAudioExtracting, setIsAudioExtracting] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined)
    const [isCreatingAiJob, setIsCreatingAiJob] = useState(false);
    const [isAiJobStarted, setIsAiJobStarted] = useState(false);
    const [currentJob, setCurrentJob] = useState<CurrentJob>({ task: "AUDIO_EXTRACTION", status: "WAITING" })
    const [error, setError] = useState("");



    const navigate = useNavigate();



    // const playerRef = useRef<any>(null);
    // const iframeRef = useRef<HTMLDivElement>(null);

    const clearStoredQuestions = () => {
        localStorage.removeItem('questions');
    };

    const [uploadParams, setUploadParams] = useState<UploadParams>({
        videoItemBaseName: "video_item",
        quizItemBaseName: "quiz_item",
        audioProvided: true,
        questionsPerQuiz: null,
    });
    const [customQuestionParams, setCustomQuestionParams] =
        useState<QuestionGenerationParameters>({
            model: "deepseek-r1:70b",
            SOL: 0,
            SML: 0,
            NAT: 0,
            DES: 0,
            prompt: `Focus on conceptual understanding
        - Test comprehension of key ideas, principles, and relationships discussed in the content
        - Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content
        - The answer of questions should be present within the content, but not directly quoted
        - Make all the options roughly the same length
        - Set isParameterized to false unless the question uses variables
        - Do not mention the word 'transcript' for giving references, use the word 'video' instead`,
            numberOfQuestions: 10
        });
    const [customSegmentationParams, setCustomSegmentationParams] =
        useState<SegmentationParameters>({
            lam: 4.5,
            runs: 25,
            noiseId: -1,
        });

    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };

    const extractIdFromUrl = (url: string): string | null => {
        const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i);
        return match ? match[1] : null;
    }
    const handleValidateURL = () => {
        if (!youtubeUrl.trim()) {
            setUrlError("YouTube URL is required");

            return;
        }
        if (!isValidYouTubeUrl(youtubeUrl.trim())) {
            setUrlError("Please enter a valid YouTube URL");
            return;
        }
        const id = extractIdFromUrl(youtubeUrl.trim());
        setVideoId(id);
        console.log("Extracted YouTube ID:", id);
        clearStoredQuestions();
        setIsLoading(true)

        setTimeout(() => {
            setIsURLValidated(true);
            setIsLoading(false);
        }, 500);
    }

    const handleCreateJob = async () => {
        clearStoredQuestions();
        // 1. Check transcription text is there
        if (!transcribedData?.text) {
            toast.error("No transcript found, Try again!");
            return;
        };
        // 2. Track creation for UI
        setIsCreatingAiJob(true);
        setError("");
        // 3. Chunks of transcription
        const chunks: Chunk[] = transcribedData.chunks.map(c => ({
            text: c.text,
            timestamp: c.timestamp.map(t => t ?? 0), // convert null to 0
        }));

        // 4. Get courseId and versionId from store
        const { currentCourse } = useCourseStore.getState();
        if (!currentCourse?.courseId || !currentCourse?.versionId) {
            toast.error("Missing course or version information");
            return;
        }

        try {
            // 5. Build job parameters
            const jobParams: Parameters<typeof aiSectionAPI.createJob>[0] = {
                videoUrl: youtubeUrl,
                transcript: { chunks },
                courseId: currentCourse.courseId,
                versionId: currentCourse.versionId,
                moduleId: currentCourse.moduleId,
                sectionId: currentCourse.sectionId,
                videoItemBaseName: uploadParams.videoItemBaseName,
                quizItemBaseName: uploadParams.quizItemBaseName,
                questionsPerQuiz: uploadParams.questionsPerQuiz,
            };


            jobParams.segmentationParameters = {
                lam: customSegmentationParams.lam ?? 4.5,
                runs: customSegmentationParams.runs ?? 25,
                noiseId: customSegmentationParams.noiseId ?? -1,
            };

            jobParams.questionGenerationParameters = {
                model: customQuestionParams.model || "deepseek-r1:70b",
                SOL: customQuestionParams.SOL ?? 1,
                SML: customQuestionParams.SML ?? 0,
                NAT: customQuestionParams.NAT ?? 0,
                DES: customQuestionParams.DES ?? 0,
                prompt:
                    customQuestionParams.prompt ||
                    `Focus on conceptual understanding
    - Test comprehension of key ideas, principles, and relationships discussed in the content
    - Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content
    - The answer of questions should be present within the content, but not directly quoted
    - Make all the options roughly the same length
    - Set isParameterized to false unless the question uses variables
    - Do not mention the word 'transcript' for giving references, use the word 'video' instead`,
            };

            // 6. Create AI Job
            const { jobId } = await aiSectionAPI.createJob(jobParams);
            setAiJobId(jobId);
            setIsAiJobStarted(true);
            // 7. Set current job status
            setCurrentJob({ status: "WAITING", task: 'SEGMENTATION' });

        } catch (error) {
            setCurrentJob({ status: "FAILED", task: 'TRANSCRIPT_GENERATION' })
            toast.error("An error occured. Please try again!");
            setError("Failed to create ai job");
        } finally {
            // 8. Stop progress bar and loading
            setIsCreatingAiJob(false);
        }
    }

    //   useEffect(() => {
    //   if (window.YT && window.YT.Player) {
    //     setIsYTReady(true);
    //     return;
    //   }

    //   const tag = document.createElement("script");
    //   tag.src = YT_IFRAME_API_SRC;
    //   document.body.appendChild(tag);

    //   window.onYouTubeIframeAPIReady = () => {
    //     setIsYTReady(true);
    //   };
    // }, []);

    // useEffect(() => {
    //     if (!videoId || !iframeRef.current || !isYTReady ) return;
    //     playerRef.current = new window.YT.Player(iframeRef.current, {
    //         videoId,
    //         playerVars: {
    //             controls: 1,
    //             modestbranding: 1,
    //             rel: 0,
    //             fs: 0,
    //             autoplay: 0,
    //         },
    //         events: {
    //             onReady: (event: any) => {
    //                 console.log("Player is ready");
    //                 setVideoPlayer(true);
    //             },
    //             onStateChange(event: any) {
    //                 console.log("Player state changed to:", event.data);
    //             },
    //         }
    //     })

    //     return () => {
    //         if (playerRef.current) {
    //             playerRef.current.destroy();
    //             playerRef.current = null;
    //         }
    //     };
    // }, [videoId, isYTReady]);

    return (
        <>
            <div className="py-2">
                <div className="mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate({ to: "/teacher/courses/view" })}
                        className="relative h-10 w-10 p-0 mr-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <div className="space-y-2">
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <Sparkles className="w-6 h-6" />
                                AI Module Builder
                            </CardTitle>
                            <CardDescription className="text-base">
                                Create AI-powered modules for your courses.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    {!isURLValidated ? (<CardContent className="space-y-4">
                        <div className="space-y-6">
                        </div>
                        <YoutubeUrlInput
                            handleValidateURL={handleValidateURL}
                            isLoading={isLoading}
                            setUrlError={setUrlError}
                            setYoutubeUrl={setYoutubeUrl}
                            urlError={urlError}
                            youtubeUrl={youtubeUrl}
                            aiJobId={aiJobId}
                        />
                    </CardContent>) :
                        (<div className=" bg-linear-to-br from-background to-muted/20">
                            {isURLValidated && videoId && (
                                <>
                                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                                        <iframe
                                            className="w-full h-full"
                                            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                                            title="YouTube video player"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                    <hr className="my-6" />
                                    <div>
                                        <div className="flex items-center gap-3 p-4">
                                              <Upload className="w-6 h-6 dark:text-white" />
                                        <h2 className="text-xl font-bold">Upload Audio</h2>
                                        </div>
                                      
                                        <p className="text-md text-gray-600 dark:text-gray-200 p-4">
                                            Upload your audio file to generate a high-quality transcription of the spoken content.
                                        </p>

                                        <AudioTranscripter
                                            setIsAudioExtracting={setIsAudioExtracting}
                                            setIsTranscribing={setIsTranscribing}
                                            transcribedData={transcribedData}
                                            setTranscribedData={setTranscribedData}
                                            isRunningAiJob={!!aiJobId}
                                            jobError={error}
                                            createAiJob={handleCreateJob}
                                            isCreatingAiJob={isCreatingAiJob}
                                        />
                                    </div>
                                </>

                            )}

                        </div>)}
                </Card>
            </div>
        </>
    )
}


export default AiModule;