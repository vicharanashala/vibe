import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiSectionAPI, editQuestionData, getApiUrl } from "@/lib/genai-api";
import { useCourseStore } from "@/store/course-store";
import { 
  ArrowLeft, ArrowRight, CheckCircle, Clock, FileText, Info, ListChecks, 
  Loader2, MessageSquareText, Plus, RefreshCw, Scissors, Sparkles, 
  Trash2, Upload, UploadCloud, X, Zap 
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AudioTranscripter } from "./AudioTranscripter";
import { TranscriberData } from "@/hooks/useTranscriber";
import { useNavigate } from "@tanstack/react-router";
import { 
  AiWorkflow,
  CurrentJob, 
  JobHeader, 
  ProgressiveProgressBar, 
  QuestionGenerationView, 
  SegmentationView, 
  Stepper, 
  UploadContentProps, 
  UploadContentView, 
  UploadParams, 
  YoutubeUrlInput,
  formatTime,
  parseTimeToSeconds
} from "./AiWorkflow";

const AdvancedAiWorkflow = () => {
    const { currentCourse } = useCourseStore();
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [videoId, setVideoId] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [isURLValidated, setIsURLValidated] = useState(false);
    
    // Workflow Choices
    const [audioChoice, setAudioChoice] = useState<"upload" | "extract" | null>(null);
    const [segmentationChoice, setSegmentationChoice] = useState<"manual" | "automatic" | null>(null);
    
    // Job State
    const [aiJobId, setAiJobId] = useState<string | null>(null);
    const [shouldPoll, setShouldPoll] = useState(false);
    const [currentJob, setCurrentJob] = useState<CurrentJob>({ task: "AUDIO_EXTRACTION", status: "WAITING" });
    const [aiJobStatus, setAiJobStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTaskResultLoading, setIsTaskResultLoading] = useState(false);
    const [error, setError] = useState("");
    const [isApprovingTask, setIsApprovingTask] = useState(false);
    const [isWaitingServer, setIsWaitingServer] = useState(false);
    const [showUploadContent, setShowUploadContent] = useState(false);
    const [progress, setProgress] = useState(0);

    // Data State
    const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined);
    const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
    const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null);
    const [segments, setSegments] = useState<any[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    
    // UI State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editQuestion, setEditQuestion] = useState<any>(null);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAudioExtracting, setIsAudioExtracting] = useState(false);
    const [isCreatingAiJob, setIsCreatingAiJob] = useState(false);
    const [isAiJobStarted, setIsAiJobStarted] = useState(false);
    const [showContinueButton, setShowContinueButton] = useState(false);
    
    // Manual Tagging State
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const [chunkTranscription, setChunkTranscription] = useState<any[]>([]);
    const [isPaused, setIsPaused] = useState(false);

    const [uploadParams, setUploadParams] = useState<UploadParams>({
        videoItemBaseName: "video_item",
        quizItemBaseName: "quiz_item",
        audioProvided: true,
        questionsPerQuiz: null,
    });

    const [customQuestionParams, setCustomQuestionParams] = useState<any>({
        BIN:0,
        SOL: 10,
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

    const [customSegmentationParams, setCustomSegmentationParams] = useState<any>({
        lam: 4.5,
        runs: 25,
        noiseId: -1,
    });

    const STEP_ORDER = {
        AUDIO_EXTRACTION: 0,
        TRANSCRIPT_GENERATION: 1,
        SEGMENTATION: 2,
        QUESTION_GENERATION: 3,
        UPLOAD_CONTENT: 4
    };

    const navigate = useNavigate();
    const playerRef = useRef<any>(null);
    const iframeRef = useRef<HTMLDivElement>(null);
    const lastStartTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const endTimeRef = useRef<number>(0);

    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };

    const extractIdFromUrl = (url: string): string | null => {
        const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    const handleValidateURL = () => {
        const trimmed = youtubeUrl.trim();
        if (!trimmed) {
            setUrlError("YouTube URL is required");
            return;
        }
        if (!isValidYouTubeUrl(trimmed)) {
            setUrlError("Please enter a valid YouTube URL");
            return;
        }
        const id = extractIdFromUrl(trimmed);
        setVideoId(id);
        setIsURLValidated(true);
        setUrlError(null);
    }

    const getCurrentTask = (jobStatus: any): { task: any, status: any } | null => {
        if (!jobStatus) return null;
        const TASK_ORDER = [
          "audioExtraction",
          "transcriptGeneration",
          "segmentation",
          "questionGeneration",
          "uploadContent",
        ];
        const runningTask = TASK_ORDER.find((key) => jobStatus[key] === "RUNNING");
        if (runningTask) return { task: runningTask, status: "RUNNING" }
        const failedTask = TASK_ORDER.find((key) => jobStatus[key] === "FAILED");
        if (failedTask) return { task: failedTask, status: "FAILED" };
        const pendingTask = TASK_ORDER.find((key) => jobStatus[key] === "WAITING" || jobStatus[key] === "PENDING");
        if (pendingTask) return { task: pendingTask, status: "PENDING" };
        const completedTasks = TASK_ORDER.filter((key) => jobStatus[key] === "COMPLETED");
        if (completedTasks.length > 0) {
          const lastTask = completedTasks[completedTasks.length - 1];
          return { task: lastTask, status: "COMPLETED" };
        }
        return null;
    };

    const updateCurrentJob = (task: string, status: any) => {
        const taskMap: Record<string, string> = {
          segmentation: "SEGMENTATION",
          questionGeneration: "QUESTION_GENERATION",
          uploadContent: "UPLOAD_CONTENT",
          audioExtraction: "AUDIO_EXTRACTION",
          transcriptGeneration: "TRANSCRIPT_GENERATION"
        };
        setCurrentJob({ status, task: taskMap[task] || task });
    };

    const handleRefreshStatus = async (isPolling = false) => {
        if (!aiJobId) return;
        try {
          if (!isPolling) setProgress(0);
          const status = await aiSectionAPI.getJobStatus(aiJobId);
          const currentTaskData = getCurrentTask(status.jobStatus);
          if (currentTaskData) {
            setAiJobStatus({ ...status, task: currentTaskData.task, status: currentTaskData.status });
            updateCurrentJob(currentTaskData.task, currentTaskData.status);
            if (currentTaskData.status === "COMPLETED") {
                handleShowHandleResult(currentJob.task);
            }
          }
        } catch (error) {
          console.error("Refresh status failed", error);
        }
    };

    useEffect(() => {
        if (!aiJobId || !shouldPoll) return;
        const interval = setInterval(() => handleRefreshStatus(true), 5000);
        return () => clearInterval(interval);
    }, [aiJobId, shouldPoll]);

    const handleCreateJob = async (withTranscript = true) => {
        setIsCreatingAiJob(true);
        setError("");
        try {
            let transcript = undefined;
            if (withTranscript && transcribedData) {
                transcript = {
                    chunks: transcribedData.chunks.map(c => ({
                        text: c.text,
                        timestamp: c.timestamp.map(t => t ?? 0),
                    }))
                };
            }

            const jobParams: any = {
                videoUrl: youtubeUrl,
                transcript,
                courseId: currentCourse?.courseId,
                versionId: currentCourse?.versionId,
                moduleId: currentCourse?.moduleId,
                sectionId: currentCourse?.sectionId,
                videoItemBaseName: uploadParams.videoItemBaseName,
                quizItemBaseName: uploadParams.quizItemBaseName,
                questionsPerQuiz: uploadParams.questionsPerQuiz,
                segmentationParameters: customSegmentationParams,
                questionGenerationParameters: customQuestionParams,
            };

            const { jobId } = await aiSectionAPI.createJob(jobParams);
            setAiJobId(jobId);
            setIsAiJobStarted(true);
            setShouldPoll(true);
            
            if (withTranscript) {
                setCurrentJob({ status: "WAITING", task: 'SEGMENTATION' });
            } else {
                setCurrentJob({ status: "RUNNING", task: 'AUDIO_EXTRACTION' });
            }
        } catch (err) {
            toast.error("Failed to create job");
            setError("Job creation failed");
        } finally {
            setIsCreatingAiJob(false);
        }
    };

    const handleApproveTask = async (qnParams?: any, filteredQuestions?: any[]) => {
        if (!aiJobId) return;
        try {
            setIsApprovingTask(true);
            setIsWaitingServer(false);
            
            const status = await aiSectionAPI.getJobStatus(aiJobId);
            const currentTaskData = getCurrentTask(status.jobStatus);
            if (!currentTaskData) return;

            const qnGenParams = qnParams || customQuestionParams;
            let params: any = null;

            switch (currentTaskData.task) {
                case 'segmentation':
                  params = { parameters: customSegmentationParams, usePrevious: 0, type: "SEGMENTATION" };
                  break;
                case 'questionGeneration':
                  params = { parameters: qnGenParams, type: "QUESTION_GENERATION" };
                  break;
                case 'uploadContent':
                  const uploadP = {
                    ...uploadParams,
                    courseId: currentCourse?.courseId,
                    versionId: currentCourse?.versionId,
                    moduleId: currentCourse?.moduleId,
                    sectionId: currentCourse?.sectionId,
                    questions: filteredQuestions || []
                  };
                  params = { parameters: uploadP, type: "UPLOAD_CONTENT", usePrevious: 0 };
                  break;
            }

            await aiSectionAPI.approveContinueTask(aiJobId);
            if (params) await aiSectionAPI.approveStartTask(aiJobId, params);
            
            setShouldPoll(true);
            setIsWaitingServer(true);
            toast.success("Task approved!");
        } catch (err) {
            toast.error("Failed to approve task");
            setIsWaitingServer(false);
        } finally {
            setIsApprovingTask(false);
        }
    };

    const handleShowHandleResult = async (task: string) => {
        if (!aiJobId) return;
        try {
            setIsTaskResultLoading(true);
            const data = await aiSectionAPI.getTaskStatus(aiJobId, task);
            if (task === "SEGMENTATION") {
                handleExtractSegmentationResponse(data);
            } else if (task === "QUESTION_GENERATION") {
                handleExtractQuestionResponse(data);
            }
        } catch (err) {
            console.error("Result fetch failed", err);
        } finally {
            setIsTaskResultLoading(false);
        }
    };

    const handleExtractSegmentationResponse = async (response: any) => {
        const segData = Array.isArray(response) ? response[response.length - 1] : response;
        if (segData?.segmentationMap) {
            setSegmentationMap(segData.segmentationMap);
            // Fetch transcript file if URL exists
            if (segData.transcriptFileUrl) {
                const res = await fetch(segData.transcriptFileUrl);
                const data = await res.json();
                setSegmentationChunks(groupChunks(data.chunks || [], segData.segmentationMap));
            }
        }
    };

    const handleExtractQuestionResponse = async (response: any) => {
        const questionData = Array.isArray(response) ? response[response.length - 1] : response;
        if (questionData?.fileUrl) {
            const res = await fetch(questionData.fileUrl);
            const data = await res.json();
            setQuestions(Array.isArray(data) ? data : data.segments || []);
        }
    };

    const groupChunks = (chunks: any[], segMap: any[]) => {
        const segs = segMap.map(v => typeof v === 'string' ? parseTimeToSeconds(v) : v);
        const grouped: any[][] = [];
        let start = 0;
        segs.forEach(end => {
            grouped.push(chunks.filter(c => c.timestamp?.[0] >= start && c.timestamp?.[0] < end));
            start = end;
        });
        return grouped;
    };

    // YouTube Player Logic for Manual Tagging
    useEffect(() => {
        if (!isURLValidated || !iframeRef.current || !videoId || segmentationChoice !== "manual") return;
        
        const createPlayer = () => {
            playerRef.current = new window.YT!.Player(iframeRef.current, {
                videoId,
                playerVars: { controls: 1, modestbranding: 1, rel: 0, autoplay: 0 },
                events: {
                    onReady: (e: any) => setVideoDuration(e.target.getDuration()),
                    onStateChange: (e: any) => {
                        const time = playerRef.current.getCurrentTime();
                        if (e.data === window.YT!.PlayerState.PLAYING) {
                            setIsPaused(false);
                            setStartTime(time);
                        } else if (e.data === window.YT!.PlayerState.PAUSED || e.data === window.YT!.PlayerState.ENDED) {
                            setIsPaused(true);
                            setEndTime(time);
                            if (e.data === window.YT!.PlayerState.ENDED) setEndTime(playerRef.current.getDuration());
                        }
                    }
                }
            });
        };

        if (window.YT && window.YT.Player) createPlayer();
        else {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(tag);
            window.onYouTubeIframeAPIReady = createPlayer;
        }
        return () => playerRef.current?.destroy();
    }, [isURLValidated, videoId, segmentationChoice]);

    useEffect(() => {
        if (startTime !== null && endTime !== null && endTime !== lastStartTimeRef.current) {
            lastStartTimeRef.current = endTime;
            setChunkTranscription(prev => [...prev, { startTime, endTime }]);
        }
    }, [endTime]);

    const handleManualSegmentationComplete = async () => {
        if (!aiJobId) return;
        const boundaries = chunkTranscription.map(c => c.endTime);
        await aiSectionAPI.editSegmentMap(aiJobId, boundaries);
        setSegmentationMap(boundaries);
        updateCurrentJob("questionGeneration", "WAITING");
        setCurrentJob(prev => ({...prev, task: "QUESTION_GENERATION"}));
    };

    useEffect(() => {
        if (isLoading || isTranscribing) {
            const interval = setInterval(() => {
                setProgress(prev => prev < 90 ? prev + (90 - prev) / 10 : prev + (99 - prev) / 20);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setProgress(0);
        }
    }, [isLoading, isTranscribing]);

    return (
        <div className="py-2">
            <div className="mb-2">
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/teacher/courses/view" })} className="hover:bg-accent/10">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Courses
                </Button>
            </div>
            
            <Card className="overflow-hidden border-none shadow-2xl bg-card">
                <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-primary" /> Advanced AI Workflow
                            </CardTitle>
                            <CardDescription>Unified and complete control over your AI sequence.</CardDescription>
                        </div>
                        {isURLValidated && <div className="hidden sm:block"><Stepper currentJobData={currentJob} aiJobStatus={aiJobStatus} /></div>}
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {!isURLValidated ? (
                        <div className="max-w-2xl mx-auto py-8">
                            <YoutubeUrlInput
                                youtubeUrl={youtubeUrl}
                                setYoutubeUrl={setYoutubeUrl}
                                urlError={urlError}
                                setUrlError={setUrlError}
                                aiJobId={aiJobId}
                                isLoading={isLoading}
                                handleValidateURL={handleValidateURL}
                            />
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="sm:hidden"><Stepper currentJobData={currentJob} aiJobStatus={aiJobStatus} /></div>
                            
                            <JobHeader currentJob={currentJob} handleRefreshStatus={() => handleRefreshStatus()} aiJobId={!!aiJobId} />
                            
                            <ProgressiveProgressBar value={progress} showTooltip={isLoading || isTranscribing} />

                            {/* Branching UI */}
                            {audioChoice === null && (
                                <div className="grid sm:grid-cols-2 gap-6 p-8 border-2 border-dashed rounded-2xl bg-muted/20">
                                    <div className="space-y-4 text-center p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                            <UploadCloud className="w-6 h-6 text-primary" />
                                        </div>
                                        <h3 className="font-bold text-lg">Auto Extraction</h3>
                                        <p className="text-sm text-muted-foreground">The AI will extract and transcribe the audio from the YouTube video directly.</p>
                                        <Button className="w-full" variant="outline" onClick={() => { setAudioChoice("extract"); handleCreateJob(false); }}>Choose Extract</Button>
                                    </div>
                                    <div className="space-y-4 text-center p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto">
                                            <Upload className="w-6 h-6 text-secondary" />
                                        </div>
                                        <h3 className="font-bold text-lg">Manual Audio Upload</h3>
                                        <p className="text-sm text-muted-foreground">Upload your own high-quality audio file for transcription (Wizard mode).</p>
                                        <Button className="w-full" onClick={() => setAudioChoice("upload")}>Choose Upload</Button>
                                    </div>
                                </div>
                            )}

                            {audioChoice === "upload" && currentJob.task === "AUDIO_EXTRACTION" && !aiJobId && (
                                <AudioTranscripter 
                                    setIsAudioExtracting={setIsAudioExtracting}
                                    setIsTranscribing={setIsTranscribing}
                                    transcribedData={transcribedData}
                                    setTranscribedData={setTranscribedData}
                                    isRunningAiJob={!!aiJobId}
                                    jobError={error}
                                    createAiJob={() => handleCreateJob(true)}
                                    isCreatingAiJob={isCreatingAiJob}
                                />
                            )}

                            {isAiJobStarted && segmentationChoice === null && (currentJob.task === "SEGMENTATION" || currentJob.status === "COMPLETED") && (
                                <div className="grid sm:grid-cols-2 gap-6 p-8 border-2 border-dashed rounded-2xl bg-muted/20">
                                    <div className="space-y-4 text-center p-6 bg-card rounded-xl border shadow-sm">
                                        <h3 className="font-bold text-lg">AI Segmentation</h3>
                                        <p className="text-sm text-muted-foreground">Let the AI automatically find the best logical breaking points.</p>
                                        <Button className="w-full" variant="outline" onClick={() => setSegmentationChoice("automatic")}>Use Automatic</Button>
                                    </div>
                                    <div className="space-y-4 text-center p-6 bg-card rounded-xl border shadow-sm">
                                        <h3 className="font-bold text-lg">Manual Tagging</h3>
                                        <p className="text-sm text-muted-foreground">Watch the video and manually mark the points where segments should end.</p>
                                        <Button className="w-full" onClick={() => setSegmentationChoice("manual")}>Use Manual</Button>
                                    </div>
                                </div>
                            )}

                            {segmentationChoice === "manual" && currentJob.task === "SEGMENTATION" && (
                                <div className="space-y-6">
                                    <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-muted">
                                        <div ref={iframeRef} className="w-full h-full" />
                                    </div>
                                    <div className="flex flex-col items-center gap-4 py-6">
                                        <div className="flex gap-4">
                                            <Button size="lg" className="rounded-full px-8 shadow-lg transition-transform active:scale-95" 
                                                onClick={() => playerRef.current?.pauseVideo()}>
                                                Tag Segment Boundary
                                            </Button>
                                            <Button variant="secondary" size="lg" className="rounded-full px-8" 
                                                onClick={handleManualSegmentationComplete} 
                                                disabled={chunkTranscription.length === 0}>
                                                Finish Tagging & Generate
                                            </Button>
                                        </div>
                                        <div className="w-full max-w-2xl mx-auto space-y-2">
                                            {chunkTranscription.map((c, i) => (
                                                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card hover:bg-muted/50 transition">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                                        Segment {i + 1}: {formatTime(c.startTime)} - {formatTime(c.endTime)}
                                                    </span>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setChunkTranscription(prev => prev.filter((_, idx) => idx !== i))}
                                                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {segmentationChoice === "automatic" && currentJob.task === "SEGMENTATION" && (
                                <SegmentationView 
                                    isLoading={isLoading}
                                    isTaskResultLoading={isTaskResultLoading}
                                    error={error}
                                    aiJobId={aiJobId}
                                    segmentationMap={segmentationMap}
                                    segmentationChunks={segmentationChunks}
                                    segments={segments}
                                    handleApproveTask={handleApproveTask}
                                    currentJobStatus={currentJob.status}
                                    setCustomSegmentationParams={setCustomSegmentationParams}
                                    customSegmentationParams={customSegmentationParams}
                                    updateCurrentJob={updateCurrentJob}
                                    handleShowHandleResult={handleShowHandleResult}
                                    isWaitingServer={isWaitingServer}
                                    isApprovingTask={isApprovingTask}
                                    setSegmentationMap={setSegmentationMap}
                                    setSegmentationChunks={setSegmentationChunks}
                                    showSegments={true}
                                />
                            )}

                            {currentJob.task === "QUESTION_GENERATION" && (
                                <QuestionGenerationView 
                                    isLoading={isLoading}
                                    isTaskResultLoading={isTaskResultLoading}
                                    error={error}
                                    questions={questions}
                                    setQuestions={setQuestions}
                                    aiJobId={aiJobId}
                                    handleApproveTask={handleApproveTask}
                                    setEditingIdx={setEditingIdx}
                                    setEditQuestion={setEditQuestion}
                                    setEditModalOpen={setEditModalOpen}
                                    editModalOpen={editModalOpen}
                                    editQuestion={editQuestion}
                                    editingIdx={editingIdx}
                                    currentJobStatus={currentJob.status}
                                    customQuestionParams={customQuestionParams}
                                    setCustomQuestionParams={setCustomQuestionParams}
                                    updateCurrentJob={updateCurrentJob}
                                    handleShowHandleResult={handleShowHandleResult}
                                    isWaitingServer={isWaitingServer}
                                    isApprovingTask={isApprovingTask}
                                    setShowUploadContent={setShowUploadContent}
                                />
                            )}

                            {showUploadContent && (
                                <UploadContentView 
                                    currentJobStatus={currentJob.status}
                                    setUploadParams={setUploadParams}
                                    uploadParams={uploadParams}
                                    handleApproveTask={handleApproveTask}
                                    isLoading={isLoading}
                                    isApprovingTask={isApprovingTask}
                                    aiJobId={aiJobId}
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdvancedAiWorkflow;
