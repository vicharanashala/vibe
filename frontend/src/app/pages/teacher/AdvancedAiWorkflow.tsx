// @ts-nocheck

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
    const [audioExtractionProgress, setAudioExtractionProgress] = useState(0);
    const [audioExtractionStatus, setAudioExtractionStatus] = useState<"ready" | "processing" | "completed" | "failed" | "paused">("ready");
    const [audioExtractionStartTime, setAudioExtractionStartTime] = useState<Date | null>(null);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
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

    const [transitioningToTask, setTransitioningToTask] = useState<string | null>(null);

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
        const runningTask = [...TASK_ORDER].reverse().find((key) => jobStatus[key] === "RUNNING");
        if (runningTask) return { task: runningTask, status: "RUNNING" };

        const failedTask = [...TASK_ORDER].reverse().find((key) => jobStatus[key] === "FAILED");
        if (failedTask) return { task: failedTask, status: "FAILED" };

        const pendingTask = TASK_ORDER.find((key, idx) => {
            const status = jobStatus[key];
            if (status === "WAITING" || status === "PENDING") {
                if (idx === 0) return true;
                const prevStatus = jobStatus[TASK_ORDER[idx - 1]];
                return prevStatus === "COMPLETED";
            }
            return false;
        });
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
                if (transitioningToTask && currentTaskData.task !== transitioningToTask && currentTaskData.task === "segmentation") {
                    console.log("Ignoring stale status poll during transition...");
                    return;
                }
                if (transitioningToTask && (currentTaskData.task === transitioningToTask || currentTaskData.task === "uploadContent")) {
                    setTransitioningToTask(null);
                }

            setAiJobStatus({ ...status, task: currentTaskData.task, status: currentTaskData.status });
            updateCurrentJob(currentTaskData.task, currentTaskData.status);
            
            if (currentTaskData.task.toLowerCase() === 'audioextraction' && currentTaskData.status.toLowerCase() === 'completed') {
                setAudioExtractionStatus('completed');
            }

            if (currentTaskData.status === "COMPLETED") {
                handleShowHandleResult(currentJob.task);
            }
          }
        } catch (error) {
          console.error("Refresh status failed", error);
        }
    };
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
    
        if (audioExtractionStatus === 'processing') {
          interval = setInterval(() => {
            setAudioExtractionProgress((prev) => {
              if (prev >= 99) return 99;
              return prev + Math.random() * 2;
            });
    
            if (audioExtractionStartTime) {
              const elapsed = Date.now() - audioExtractionStartTime.getTime();
              const progress = audioExtractionProgress;
              if (progress > 0) {
                const totalEstimated = elapsed / (progress / 100);
                const remaining = totalEstimated - elapsed;
                const minutes = Math.max(0, Math.ceil(remaining / 60000));
                setEstimatedTimeRemaining(`~${minutes} minute${minutes !== 1 ? 's' : ''}`);
              }
            }
          }, 1000);
        }
    
        return () => {
          if (interval) clearInterval(interval);
        };
    }, [audioExtractionStatus, audioExtractionProgress, audioExtractionStartTime]);

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
                setAudioExtractionStatus('processing');
                setAudioExtractionStartTime(new Date());
                try {
                    await aiSectionAPI.postJobTask(jobId, 'AUDIO_EXTRACTION', {}, 0);
                    setShouldPoll(true);
                } catch (approveErr) {
                    console.error("Failed to auto-start audio extraction", approveErr);
                    setAudioExtractionStatus('failed');
                }
            }
        } catch (err) {
            toast.error("Failed to create job");
            setError("Job creation failed");
        } finally {
            setIsCreatingAiJob(false);
        }
    };

    const handleApproveTask = async (taskToApprove: string, qnParams?: any, filteredQuestions?: any[]) => {
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
                case 'audioExtraction':
                  params = { parameters: {}, type: "AUDIO_EXTRACTION" };
                  break;
                case 'transcriptGeneration':
                  params = { parameters: {}, type: "TRANSCRIPT_GENERATION" };
                  break;
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
            if (taskToApprove !== 'audioExtraction' && taskToApprove !== 'transcriptGeneration') {

            await aiSectionAPI.approveContinueTask(aiJobId);
            }

            if (params) {
                if (taskToApprove === 'audioExtraction' || taskToApprove === 'transcriptGeneration') {
                    // Use postJobTask for the initial steps as per Custom Mode
                    await aiSectionAPI.postJobTask(aiJobId, params.type, params.parameters, params.usePrevious || 0);
                } else {
                    await aiSectionAPI.approveStartTask(aiJobId, params);
                }
            }
            
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
        setIsLoading(true);
        setShouldPoll(false); 
        
        try {
            const boundaries = chunkTranscription.map((c: any) => c.endTime);
            
            
            await aiSectionAPI.editSegmentMap(aiJobId, boundaries);
            
            
            await aiSectionAPI.approveContinueTask(aiJobId);
            
           
            const params = { parameters: customQuestionParams, type: "QUESTION_GENERATION" };
            await aiSectionAPI.approveStartTask(aiJobId, params);
            
            
            setSegmentationMap(boundaries);
            setTransitioningToTask("questionGeneration"); 
            updateCurrentJob("questionGeneration", "RUNNING");
            setCurrentJob({ task: "QUESTION_GENERATION", status: "RUNNING" });
            
            setShouldPoll(true); 
            toast.success("Segments saved! AI is now generating questions.");
        } catch (err: any) {
            console.error("Manual segmentation failed", err);
            toast.error(`Error: ${err.message || "An error occurred during transition"}`);
            setShouldPoll(true); 
        } finally {
            setIsLoading(false);
        }
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
           
            <Card className="overflow-hidden border-none shadow-2xl bg-card">
                <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-primary" /> Advanced AI Workflow
                            </CardTitle>
                            <CardDescription>Unified and complete control over your AI sequence.</CardDescription>
                        </div>
                        {isURLValidated && <div className="hidden sm:block"><Stepper currentJobData={currentJob} aiJobStatus={aiJobStatus} firstStepLabel={audioChoice === 'upload' ? 'Audio Uploading' : 'Audio Extraction'} /></div>}
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
                            <div className="sm:hidden"><Stepper currentJobData={currentJob} aiJobStatus={aiJobStatus} firstStepLabel={audioChoice === 'upload' ? 'Audio Uploading' : 'Audio Extraction'} /></div>
                            
                            <JobHeader currentJob={currentJob} handleRefreshStatus={() => handleRefreshStatus()} aiJobId={!!aiJobId} />
                            
                            {currentJob.task === 'AUDIO_EXTRACTION' && audioExtractionStatus === 'processing' ? (
                                <div className="space-y-4 bg-card p-6 rounded-2xl border shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <UploadCloud className="w-6 h-6 text-primary animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">Extracting Audio</h3>
                                                <p className="text-xs text-muted-foreground">{estimatedTimeRemaining ? `Estimated: ${estimatedTimeRemaining}` : 'Optimizing video for extraction...'}</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-bold text-primary">{Math.round(audioExtractionProgress)}%</span>
                                    </div>
                                    <ProgressiveProgressBar value={audioExtractionProgress} showTooltip={true} />
                                </div>
                            ) : (
                                <ProgressiveProgressBar value={progress} showTooltip={isLoading || isTranscribing} />
                            )}

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
                                        <p className="text-sm text-muted-foreground">Upload your own high-quality audio file for transcription.</p>
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
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="bg-primary/10 border border-primary/20 rounded-xl px-6 py-3 flex items-center gap-3 animate-pulse">
                                                <Info className="w-5 h-5 text-primary" />
                                                <span className="font-medium text-primary">Pause the video at any point to create a segment boundary.</span>
                                            </div>
                                            
                                            <Button 
                                                variant="secondary" 
                                                size="lg" 
                                                className="rounded-full px-12 shadow-md hover:shadow-lg transition-all" 
                                                onClick={handleManualSegmentationComplete} 
                                                disabled={chunkTranscription.length === 0 || isLoading}
                                            >
                                                {isLoading ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Processing...
                                                    </div>
                                                ) : (
                                                    "Generate AI Questions"
                                                )}
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
                                    handleApproveTask={(...args: any[]) => handleApproveTask('segmentation', ...args)}
                                    currentJobStatus={currentJob.status}
                                    setCustomSegmentationParams={setCustomSegmentationParams}
                                    customSegmentationParams={customSegmentationParams}
                                    updateCurrentJob={updateCurrentJob}
                                    handleShowHandleResult={handleShowHandleResult}
                                    isWaitingServer={isWaitingServer}
                                    isApprovingTask={isApprovingTask}
                                    setSegmentationMap={setSegmentationMap}
                                    setSegmentationChunks={setSegmentationChunks}
                                    showSegments={false}
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
                                    handleApproveTask={(qnParams, filtered) => handleApproveTask('questionGeneration', qnParams, filtered)}
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
                                    handleApproveTask={(qnParams, filtered) => handleApproveTask('uploadContent', qnParams, filtered)}
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
