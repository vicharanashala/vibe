import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { aiSectionAPI, Chunk, connectToLiveStatusUpdates, getApiUrl, JobStatus, QuestionGenerationParameters, SegmentationParameters, TranscriptParameters } from '@/lib/genai-api';
import { useCourseStore } from '@/store/course-store';
import {  AlertTriangle, Ban, Bot, CheckCircle, Clock, FileText, ListChecks, Loader2, MessageSquareText, MoveRightIcon, PauseCircle, RefreshCw, Settings, Sparkles, Upload, UploadCloud, XCircle, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner';
import { AudioTranscripter } from './AudioTranscripter';
import { TranscriberData } from '@/hooks/useTranscriber';


interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed";
  result?: JobStatus;
  parameters?: Record<string, unknown>;
}

interface TaskRuns {
  transcription: TaskRun[];
  segmentation: TaskRun[];
  question: TaskRun[];
  upload: TaskRun[];
}

const AiWorkflow = () => {

    // Store
    const { currentCourse } = useCourseStore();

    // State
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [aiJobId, setAiJobId] = useState<string | null>(null);
    const [currentJob, setCurrentJob] = useState<{status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING", task: any} | null>(null)

    // Ref
    const optimisticFailedTaskRef = useRef<string | null>(null);

    // Upload parameters
    const [uploadParams, setUploadParams] = useState({
    videoItemBaseName: "video_item",
    quizItemBaseName: "quiz_item",
    questionsPerQuiz: 1,
    });

    const [customQuestionParams, setCustomQuestionParams] =
    useState<QuestionGenerationParameters>({
        model: "deepseek-r1:70b",
        SOL: 1,
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
    });

    // Custom configuration parameters
    const [customTranscriptParams, setCustomTranscriptParams] =
    useState<TranscriptParameters>({
        language: "en",
        modelSize: "large",
    });

    const [customSegmentationParams, setCustomSegmentationParams] =
    useState<SegmentationParameters>({
        lam: 4.6,
        runs: 25,
        noiseId: -1,
    });

    // Track AI job status
    const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null);
    const prevJobStatusRef = useRef<any>(null);
    const didMountRef = useRef(false);

    const [taskRuns, setTaskRuns] = useState<TaskRuns>({
    transcription: [],
    segmentation: [],
    question: [],
    upload: [],
    });


    const [aiWorkflowStep, setAiWorkflowStep] = useState("");
    const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined);

    const [acceptedRuns, setAcceptedRuns] = useState<Partial<Record<keyof TaskRuns, string>>>({});

    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAudioExtracting, setIsAudioExtracting] = useState(false);
    const [isAiJobStarted, setIsAiJobStarted] = useState(false); //will true once segmentation starts (backend)
    const errorRef = useRef<HTMLDivElement | null>(null);

    // Validation
    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };
  
  
    useEffect(() => {
      if (!aiJobId) return;
      handleRefreshStatus();
      const es = connectToLiveStatusUpdates(aiJobId, (incoming) => {
        setAiJobStatus((prev) => {
          let next: any = incoming ? { ...incoming } : incoming;
          const failing = optimisticFailedTaskRef.current;
          if (next && failing) {
            const ensureJobStatus = () => { next.jobStatus = { ...(next.jobStatus || {}) }; };
            const setTop = (taskStr: string) => { next.task = taskStr; next.status = 'FAILED'; };
            switch (failing) {
              case 'AUDIO_EXTRACTION':
                setTop('AUDIO_EXTRACTION');
                ensureJobStatus();
                next.jobStatus.audioExtraction = 'FAILED';
                break;
              case 'TRANSCRIPT_GENERATION':
                setTop('TRANSCRIPT_GENERATION');
                ensureJobStatus();
                next.jobStatus.transcriptGeneration = 'FAILED';
                break;
              case 'SEGMENTATION':
                setTop('SEGMENTATION');
                ensureJobStatus();
                next.jobStatus.segmentation = 'FAILED';
                break;
              case 'QUESTION_GENERATION':
                setTop('QUESTION_GENERATION');
                ensureJobStatus();
                next.jobStatus.questionGeneration = 'FAILED';
                break;
              case 'UPLOAD_CONTENT':
                setTop('UPLOAD_CONTENT');
                ensureJobStatus();
                next.jobStatus.uploadContent = 'FAILED';
                break;
            }
          }
          if (next?.status === 'FAILED' || next?.status === 'STOPPED') {
            optimisticFailedTaskRef.current = null;
          }
  
          if (next?.task === 'TRANSCRIPT_GENERATION' && next?.status === 'COMPLETED') {
            setTimeout(() => {
              setTaskRuns((prevTaskRuns: any) => {
                const lastLoadingIdx = [...prevTaskRuns.transcription].reverse().findIndex(run => run.status === 'loading');
                if (lastLoadingIdx === -1) {
                  console.log('Live update: No loading transcription run found');
                  return prevTaskRuns;
                }
  
                const idxToUpdate = prevTaskRuns.transcription.length - 1 - lastLoadingIdx;
                const updatedRun = prevTaskRuns.transcription[idxToUpdate];
                const completedRunId = updatedRun.id;
  
                const updatedTaskRuns = {
                  ...prevTaskRuns,
                  transcription: prevTaskRuns.transcription.map((run, idx) =>
                    idx === idxToUpdate ? { ...run, status: 'done', result: next } : run
                  ),
                };
  
                return updatedTaskRuns;
              });
              toast.success('Transcription completed!');
            }, 50);
          }
  
          return next;
        });
      });
      return () => es.close();
  
    }, [aiJobId]);


    useEffect(()=> {

        if(isAudioExtracting) 
            setCurrentJob({status: "RUNNING", task: 'AUDIO_EXTRACTION'}); 

        if(isTranscribing) 
             setCurrentJob({status: "RUNNING", task: 'TRANSCRIPT_GENERATION'});
            else if(!isTranscribing && transcribedData){
            setCurrentJob({status: "COMPLETED", task: 'TRANSCRIPT_GENERATION'});
            setIsAiJobStarted(true);
        }

    }, [isTranscribing, isAudioExtracting]);

  
    // Handlers
    const handleCreateJob = async () => {

        if (!youtubeUrl.trim()) {
            setUrlError("YouTube URL is required");
            scrollToError();
            return;
        }
        if (!isValidYouTubeUrl(youtubeUrl.trim())) {
            setUrlError("Please enter a valid YouTube URL");
            scrollToError();
            return;
        }

        if(!transcribedData?.text){
            toast.error("No transcript found, Try again!");
            return;
        };
        
        const chunks: Chunk[] = transcribedData.chunks.map(c => ({
            text: c.text,
            timestamp: c.timestamp.map(t => t ?? 0), // convert null to 0
        }));

        setUrlError(null);
        // Get courseId and versionId from store
        const { currentCourse } = useCourseStore.getState();
        if (!currentCourse?.courseId || !currentCourse?.versionId) {
            toast.error("Missing course or version information");
            return;
        }

        try {
        // Build job parameters
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

        // Optional parameters
        // if (selectedTasks.transcription) {
        //     jobParams.transcriptParameters = {
        //         language: customTranscriptParams.language || "en",
        //         modelSize: customTranscriptParams.modelSize || "large",
        //     };
        // }

        // if (selectedTasks.segmentation) {
        jobParams.segmentationParameters = {
            lam: customSegmentationParams.lam ?? 4.6,
            runs: customSegmentationParams.runs ?? 25,
            noiseId: customSegmentationParams.noiseId ?? -1,
        };
        // }

        // if (selectedTasks.questions) {
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
        // }

        // Create AI Job
        const { jobId } = await aiSectionAPI.createJob(jobParams);
        setAiJobId(jobId);

        await handleApproveTask();
        console.log("[handleCreateJob] Set aiJobId:", jobId);
        toast.success("AI job created successfully!");
        } catch (error) {
            toast.error("Failed to create AI job. Please try again.");
        } finally {
            handleRefreshStatus();
        }
    };

    const scrollToError = () => {
        if (errorRef.current) {
        errorRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
        }
    };
    // Task dependency order (linear workflow)
    const taskOrder = ['transcription', 'segmentation', 'questions', 'upload'] as const;


    // Passing the task and recieving appproval
    const canRunTask = (task: keyof typeof taskRuns): boolean => {
        switch (task) {
        case "transcription":
            return !!aiJobId;
        case "segmentation":
            return !!acceptedRuns.transcription;
        case "question":
            return !!acceptedRuns.segmentation;
        case "upload":
            return !!acceptedRuns.question;
        default:
            return false;
        }
    };

    const handleAcceptRun = async (task: keyof typeof taskRuns, runId: string) => {
        if ((task === 'transcription' || task === 'segmentation' || task === 'question') && aiJobId) {
        try {
            await aiSectionAPI.approveContinueTask(aiJobId);
            toast.success(`${task === 'question' ? 'Question generation' : task.charAt(0).toUpperCase() + task.slice(1)} run approved and continued!`);
        } catch (e: any) {
            toast.error(`Failed to approve ${task === 'question' ? 'question generation' : task}.`);
            return;
        }
        }
        setAcceptedRuns(prev => ({ ...prev, [task]: runId }));
        if (task !== 'segmentation' && task !== 'question' && task !== 'transcription') toast.success(`${task} run accepted!`);
    };


    // ----------------------
    // Manual Refresh Handler
    // ----------------------

    const handleRefreshStatus = async () => {
    if (!aiJobId) return;

    try {
        const status = await aiSectionAPI.getJobStatus(aiJobId);
        const currentTaskData = getCurrentTask(status.jobStatus);
        console.log("Current task: ", currentTaskData);

        if (!currentTaskData) {
            toast.error("Current task is missing");
            return;
        }

        const currentTask = currentTaskData.task; 
        const currentStatus = currentTaskData.status;
        // const current
        setAiJobStatus( { ...status, task: currentTask, status: currentStatus  } );
        console.log("Status from handle refresh status: ", status);
        const prevJobStatus = prevJobStatusRef.current;


        // --- Transcript Generation ---
        if (
        didMountRef.current &&
        status.jobStatus?.transcriptGeneration === 'COMPLETED' &&
        prevJobStatus?.transcriptGeneration !== 'COMPLETED'
        ) {
        setTaskRuns(prev => {
            const lastLoadingIdx = [...prev.transcription]
            .reverse()
            .findIndex(run => run.status === 'loading');

            if (lastLoadingIdx === -1) return prev;

            const idxToUpdate = prev.transcription.length - 1 - lastLoadingIdx;
            return {
            ...prev,
            transcription: prev.transcription.map((run, idx) =>
                idx === idxToUpdate ? { ...run, status: 'done', result: status } : run
            ),
            };
        });

        toast.success('Transcription completed!');
        }

        // --- Segmentation ---
        if (
        didMountRef.current &&
        status.jobStatus?.segmentation === 'COMPLETED' &&
        prevJobStatus?.segmentation !== 'COMPLETED'
        ) {
        setTaskRuns(prev => {
            const lastLoadingIdx = [...prev.segmentation]
            .reverse()
            .findIndex(run => run.status === 'loading');

            if (lastLoadingIdx === -1) return prev;

            const idxToUpdate = prev.segmentation.length - 1 - lastLoadingIdx;
            return {
            ...prev,
            segmentation: prev.segmentation.map((run, idx) =>
                idx === idxToUpdate ? { ...run, status: 'done', result: status } : run
            ),
            };
        });

        toast.success('Segmentation completed!');
        }

        // --- Question Generation ---
        if (
        didMountRef.current &&
        status.jobStatus?.questionGeneration === 'COMPLETED' &&
        prevJobStatus?.questionGeneration !== 'COMPLETED'
        ) {
        // Fetch QUESTION_GENERATION task status (for fileUrl)
        const token = localStorage.getItem('firebase-auth-token');
        const backendUrl = getApiUrl(
            `/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`
        );

        let res = await fetch(backendUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        // Retry once if failed
        if (!res.ok) {
            res = await fetch(backendUrl, {
            headers: { Authorization: `Bearer ${token}` },
            });
        }

        if (res.ok) {
            const arr = await res.json();

            setTaskRuns(prev => {
            const lastLoadingIdx = [...prev.question]
                .reverse()
                .findIndex(run => run.status === 'loading');

            const lastDoneIdx = [...prev.question]
                .reverse()
                .findIndex(run => run.status === 'done');

            const idxToUpdate =
                lastLoadingIdx !== -1
                ? prev.question.length - 1 - lastLoadingIdx
                : lastDoneIdx !== -1
                ? prev.question.length - 1 - lastDoneIdx
                : -1;

            if (idxToUpdate === -1) return prev;

            return {
                ...prev,
                question: prev.question.map((run, idx) => {
                if (idx === idxToUpdate) {
                    const { id, timestamp, result, parameters } = run;
                    return {
                    id,
                    timestamp,
                    status: 'done',
                    result: { ...result, questionTaskStatus: arr },
                    parameters,
                    } as TaskRun;
                }
                return run;
                }),
            };
            });

            toast.success('Questions generated!');
        }
        }

        // --- Update refs at the end ---
        prevJobStatusRef.current = status.jobStatus;

        // Mark first mount after initial fetch
        if (!didMountRef.current) didMountRef.current = true;

        // --- Workflow step management ---
        if (status.jobStatus?.transcriptGeneration === 'COMPLETED') {
        setAiWorkflowStep('transcription_done');
        return;
        }

        if (status.jobStatus?.audioExtraction === 'COMPLETED') {
        setAiWorkflowStep('audio_extraction_done');
        return;
        }

        if (
        status.jobStatus?.audioExtraction === 'FAILED' ||
        status.jobStatus?.transcriptGeneration === 'FAILED'
        ) {
        setAiWorkflowStep('error');
        toast.error('A step failed.');
        return;
        }
    } catch (error) {
        setAiWorkflowStep('error');
        toast.error('Failed to refresh status.');
    }
    };

    const getCurrentTask = (jobStatus: JobStatus["jobStatus"]): {task: any, status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING"} | null => {
        if (!jobStatus) return null;
        console.log(jobStatus);
        const TASK_ORDER: (keyof typeof jobStatus)[] = [
            "audioExtraction",
            "transcriptGeneration",
            "segmentation",
            "questionGeneration",
            "uploadContent",
        ];
        // Check running task
        const runningTask = TASK_ORDER.find((key)=> jobStatus[key] === "RUNNING");
        if(runningTask) return {task: runningTask, status: "RUNNING"}
        // Check for failed task 
        const failedTask = TASK_ORDER.find((key) => jobStatus[key] === "FAILED");
        if (failedTask) return { task: failedTask, status: "FAILED" };

        // Check for pending/waiting task
        const pendingTask = TASK_ORDER.find(
            (key) => jobStatus[key] === "WAITING" || jobStatus[key] === "PENDING"
        );
        if (pendingTask) return { task: pendingTask, status: "PENDING" };

        // Return last completed task
        const completedTasks = TASK_ORDER.filter((key) => jobStatus[key] === "COMPLETED");
        if (completedTasks.length > 0) {
            const lastTask = completedTasks[completedTasks.length - 1];
            return { task: lastTask, status: "COMPLETED" };
        }

        return null;
    };

    const handleAiJob = async () => {
        if (isAiJobStarted && aiJobId) {
            // alert('Approving task...')
            await handleApproveTask()
        } else {
            // alert('Creating job...')
            await handleCreateJob();
        }
    }


    const handleApproveTask = async() => {
        alert("Aproving task...")
        try {

            if (!aiJobId || !aiJobStatus || !aiJobStatus.jobStatus) {
                toast.error("Job not found");
                return;
            }

            const currentTaskData = getCurrentTask(aiJobStatus.jobStatus);
            setCurrentJob(currentJob);
            console.log("Current task: ", currentTaskData);

            if (!currentTaskData) {
                toast.error("Current task is missing");
                return;
            }

            const currentTask = currentTaskData.task; 

            console.log('currentTask from approve: ', currentTask)

            const customUploadParams = { 
                courseId: currentCourse?.courseId, 
                versionId: currentCourse?.versionId, 
                moduleId: currentCourse?.moduleId, 
                sectionId: currentCourse?.sectionId, 
                videoItemBaseName: uploadParams.videoItemBaseName, 
                quizItemBaseName: uploadParams.quizItemBaseName, questionsPerQuiz: uploadParams.questionsPerQuiz
            };

            let params: Record<string, any> | null = null;

            switch (currentTask) {
                case 'segmentation':
                    params = {...customSegmentationParams, usePrevious: 0, type: "SEGMENTATION"};
                    break;
                case 'questionGeneration':
                    params = {...customQuestionParams, type: "QUESTION_GENERATION"};
                    break;
                case 'uploadContent': 
                    params = { ...customUploadParams , type: "UPLOAD_CONTENT" };
                    break;
                default: 
                    console.error("Invalid current task", currentTask);
                    toast.error("Invalida current task");
                    return;
            }
            await aiSectionAPI.approveContinueTask(aiJobId);
            await aiSectionAPI.approveStartTask(aiJobId, params);
            toast.success("Task approved!")
        } catch(error) {
            toast.error("Failed to approve task");
            console.log("Failed to approve task", error);
        } finally {
            console.log("Refreshing at finally block of handle approve task...");
            handleRefreshStatus();
        }
    }

    // Define possible task statuses for type safety
    type TaskStatus =
    | "PENDING"
    | "RUNNING"
    | "WAITING"
    | "COMPLETED"
    | "FAILED"
    | "ABORTED"
    | string; // fallback for unexpected values

    // ✅ Helper to map status → icon + tooltip
    const getTaskStatusIcon = (status: TaskStatus | null) => {
    if (!status) return null;

    const baseClass =
        "flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium";

    switch (status) {
        case "PENDING":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div className={`${baseClass} bg-gray-100 dark:bg-gray-800`}>
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                    Pending
                    </span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Task is pending and waiting to start</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        case "RUNNING":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800`}
                >
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-blue-700 dark:text-blue-300">Running</span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Task is currently running</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        case "WAITING":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800`}
                >
                    <PauseCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-700 dark:text-yellow-300">
                    Waiting
                    </span>
                </div>
                </TooltipTrigger>
                <TooltipContent>
                Task is waiting for approval or dependencies
                </TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        case "COMPLETED":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800`}
                >
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-300">
                    Completed
                    </span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Task completed successfully</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        case "FAILED":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800`}
                >
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-700 dark:text-red-300">Failed</span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Task failed to complete</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        case "ABORTED":
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800`}
                >
                    <Ban className="w-4 h-4 text-orange-600" />
                    <span className="text-orange-700 dark:text-orange-300">
                    Aborted
                    </span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Task was aborted</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );

        default:
        return (
            <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div
                    className={`${baseClass} bg-gray-100 dark:bg-gray-800`}
                >
                    <AlertTriangle className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                    Unknown
                    </span>
                </div>
                </TooltipTrigger>
                <TooltipContent>Unknown status: {status}</TooltipContent>
            </Tooltip>
            </TooltipProvider>
        );
    }
    };

    // Helper to safely extract status
    const getTaskStatus = (
    jobStatus: Record<string, TaskStatus> | null,
    taskKey: string
    ): TaskStatus | null => {
    if (!jobStatus) return null;
    return jobStatus[taskKey] ?? null;
    };


  return (
    <div className='py-2'>
        <Stepper jobStatus={aiJobStatus} currentJobData={currentJob}/>
        <Card className="mb-2">
            <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <CardTitle className="flex items-center gap-3 text-xl">
                    <Sparkles  className="w-6 h-6" />
                    Smart Content Builder
                    </CardTitle>
                    <CardDescription className="text-base">
                    Click to instantly generate engaging learning content. All essential steps are handled in the background.
                    </CardDescription>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                    disabled={!!aiJobId}
                    className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 text-sm"
                >
                    {showAdvancedConfig ? "Hide" : "Show"} Advanced Settings
                </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-6">
                {showAdvancedConfig && (
                    <div
                    className={`transition-all duration-500 ease-in-out overflow-hidden ${
                        showAdvancedConfig ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                    >
                        <Accordion type="multiple" className="border rounded-xl overflow-hidden">
                            <AccordionItem value="transcript" className="border-b-0">
                            <AccordionTrigger className="px-6 py-4 text-base font-medium hover:bg-muted/50">
                                Transcription Settings
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Language</Label>
                                    <Select
                                    value={customTranscriptParams.language}
                                    onValueChange={(value) => setCustomTranscriptParams((prev) => ({ ...prev, language: value }))}
                                    disabled={!!aiJobId}
                                    >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="hi">Hindi</SelectItem>
                                        <SelectItem value="es">Spanish</SelectItem>
                                        <SelectItem value="fr">French</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Model Size</Label>
                                    <Select
                                    value={customTranscriptParams.modelSize}
                                    onValueChange={(value) =>
                                        setCustomTranscriptParams((prev) => ({ ...prev, modelSize: value }))
                                    }
                                    disabled={!!aiJobId}
                                    >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select model size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="large">Large (Most Accurate)</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="small">Small (Fastest)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>
                                </div>
                            </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="segmentation" className="border-b-0">
                            <AccordionTrigger className="px-6 py-4 text-base font-medium hover:bg-muted/50">
                                Segmentation Settings
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Lambda</Label>
                                    <Input
                                    type="number"
                                    step="0.1"
                                    value={customSegmentationParams.lam}
                                    onChange={(e) =>
                                        setCustomSegmentationParams((prev) => ({ ...prev, lam: Number.parseFloat(e.target.value) }))
                                    }
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Runs</Label>
                                    <Input
                                    type="number"
                                    value={customSegmentationParams.runs}
                                    onChange={(e) =>
                                        setCustomSegmentationParams((prev) => ({ ...prev, runs: Number.parseInt(e.target.value) }))
                                    }
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Noise ID</Label>
                                    <Input
                                    type="number"
                                    value={customSegmentationParams.noiseId}
                                    onChange={(e) =>
                                        setCustomSegmentationParams((prev) => ({
                                        ...prev,
                                        noiseId: Number.parseInt(e.target.value),
                                        }))
                                    }
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                                </div>
                            </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="questions" className="border-b-0">
                            <AccordionTrigger className="px-6 py-4 text-base font-medium hover:bg-muted/50">
                                Question Generation Settings
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-2">
                                <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Model</Label>
                                    <Select
                                    value={customQuestionParams.model}
                                    onValueChange={(value) => setCustomQuestionParams((prev) => ({ ...prev, model: value }))}
                                    disabled={!!aiJobId}
                                    >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="deepseek-r1:70b">DeepSeek R1 70B</SelectItem>
                                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                    <Label className="text-sm font-medium">SOL Questions</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={customQuestionParams.SOL}
                                        onChange={(e) =>
                                        setCustomQuestionParams((prev) => ({ ...prev, SOL: Number.parseInt(e.target.value) }))
                                        }
                                        disabled={!!aiJobId}
                                        className="h-10"
                                    />
                                    </div>
                                    <div className="space-y-2">
                                    <Label className="text-sm font-medium">SML Questions</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={customQuestionParams.SML}
                                        onChange={(e) =>
                                        setCustomQuestionParams((prev) => ({ ...prev, SML: Number.parseInt(e.target.value) }))
                                        }
                                        disabled={!!aiJobId}
                                        className="h-10"
                                    />
                                    </div>
                                    <div className="space-y-2">
                                    <Label className="text-sm font-medium">NAT Questions</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={customQuestionParams.NAT}
                                        onChange={(e) =>
                                        setCustomQuestionParams((prev) => ({ ...prev, NAT: Number.parseInt(e.target.value) }))
                                        }
                                        disabled={!!aiJobId}
                                        className="h-10"
                                    />
                                    </div>
                                    <div className="space-y-2">
                                    <Label className="text-sm font-medium">DES Questions</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={customQuestionParams.DES}
                                        onChange={(e) =>
                                        setCustomQuestionParams((prev) => ({ ...prev, DES: Number.parseInt(e.target.value) }))
                                        }
                                        disabled={!!aiJobId}
                                        className="h-10"
                                    />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Custom Prompt</Label>
                                    <Textarea
                                    value={customQuestionParams.prompt}
                                    onChange={(e) => setCustomQuestionParams((prev) => ({ ...prev, prompt: e.target.value }))}
                                    placeholder="Enter custom instructions for question generation..."
                                    disabled={!!aiJobId}
                                    className="min-h-[100px] resize-none"
                                    rows={4}
                                    />
                                </div>
                                </div>
                            </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <div className=" rounded-xl border p-6 space-y-4 mb-10">
                            <h4 className="font-semibold text-base text-foreground mb-4">Upload Parameters</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="video-base-name" className="text-sm font-medium">
                                    Video Item Name
                                    </Label>
                                    <Input
                                    id="video-base-name"
                                    value={uploadParams.videoItemBaseName}
                                    onChange={(e) => setUploadParams((prev) => ({ ...prev, videoItemBaseName: e.target.value }))}
                                    placeholder="video_item"
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quiz-base-name" className="text-sm font-medium">
                                    Quiz Item Name
                                    </Label>
                                    <Input
                                    id="quiz-base-name"
                                    value={uploadParams.quizItemBaseName}
                                    onChange={(e) => setUploadParams((prev) => ({ ...prev, quizItemBaseName: e.target.value }))}
                                    placeholder="quiz_item"
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="questions-per-quiz" className="text-sm font-medium">
                                    Questions Per Quiz
                                    </Label>
                                    <Input
                                    id="questions-per-quiz"
                                    type="number"
                                    min={1}
                                    value={uploadParams.questionsPerQuiz}
                                    onChange={(e) => setUploadParams((prev) => ({ ...prev, questionsPerQuiz: Number(e.target.value) }))}
                                    disabled={!!aiJobId}
                                    className="h-10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>

                <div className="flex-1 w-full">
                    <div className="relative w-full">
                        <div
                            className={`absolute left-3 top-1/2 -translate-y-1/2 text-red-500 transition-transform duration-300 ease-in-out ${
                            youtubeUrl ? "scale-110" : "scale-100"
                            }`}
                        >
                            <YoutubeIcon /> 
                        </div>

                        <Input
                            placeholder="YouTube URL"
                            value={youtubeUrl}
                            onChange={(e) => {
                            setUrlError(null);
                            setYoutubeUrl(e.target.value);
                            }}
                            disabled={!!aiJobId}
                            onFocus={() => setShowAdvancedConfig(false)}
                            className={`pl-10 flex-1 w-full border rounded-md py-2 transition-all duration-300 ease-in-out ${
                            urlError ? "border-red-500" : "border-gray-900"
                            } `}
                        />
                        </div>
                    {urlError && (
                        <p ref={errorRef} className="text-red-500 text-sm mt-1">{urlError}</p>
                    )}
                </div>
            </CardContent>
        </Card>
        <div className=" bg-gradient-to-br from-background to-muted/20 ">
            <div className=" mx-auto space-y-8">
                <div className="bg-card rounded-2xl border shadow-lg p-8 space-y-6">
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/20">
                        <div className='flex items-center gap-3 pb-2'>
                            <Upload className="w-6 h-6 dark:text-white " />
                            <h2 className="text-xl font-bold">Upload Audio</h2>
                        </div>
                         {/* <Button
                            onClick={handleApproveTask}
                            variant="outline"
                            className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                            >
                            <RefreshCw className="w-4 h-4 mr-2" />
                             Approve Run
                         </Button> */}
                        <Button
                            onClick={handleRefreshStatus}
                            variant="outline"
                            className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                            >
                            <RefreshCw className="w-4 h-4" />
                         </Button>
                       
                    </div>

                    <p className="text-md text-gray-600 dark:text-gray-200">
                        Select your preferred method to upload audio — via File, Link, or Recording.
                    </p>

                    {/* Transcribe component */}

                    <AudioTranscripter 
                        setIsAudioExtracting ={setIsAudioExtracting}
                        setIsTranscribing ={setIsTranscribing}
                        transcribedData = {transcribedData}
                        setTranscribedData={setTranscribedData}
                        isRunningAiJob = {!!aiJobId}
                    />
                    {isAiJobStarted && 
                        <div className="flex justify-center">
                            <Button
                            onClick={handleAiJob}
                            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                            Next
                            </Button>
                        </div>
                    }
                </div>

                {/* Refresh Button */}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{aiJobId && aiJobStatus?.jobStatus && "Processing Status"}</h2>
                </div>
                
                {/* Status Section */}
                {aiJobId && aiJobStatus?.jobStatus && (
                <div className="bg-card rounded-2xl border shadow-lg p-8 space-y-6">

                    {/* Task Status Display */}
                    <div className="bg-muted/30 rounded-xl border p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Task Status Overview
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Audio Extraction */}
                        <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border">
                        <span className="text-xs font-medium text-muted-foreground">Audio Extraction</span>
                        {getTaskStatusIcon(getTaskStatus(aiJobStatus?.jobStatus, "audioExtraction"))}
                        </div>

                        {/* Transcription */}
                        <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border">
                        <span className="text-xs font-medium text-muted-foreground">Transcription</span>
                        {getTaskStatusIcon(getTaskStatus(aiJobStatus?.jobStatus, "transcriptGeneration"))}
                        </div>

                        {/* Segmentation */}
                        <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border">
                        <span className="text-xs font-medium text-muted-foreground">Segmentation</span>
                        {getTaskStatusIcon(getTaskStatus(aiJobStatus?.jobStatus, "segmentation"))}
                        </div>

                        {/* Question Generation */}
                        <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border">
                        <span className="text-xs font-medium text-muted-foreground">Questions</span>
                        {getTaskStatusIcon(getTaskStatus(aiJobStatus?.jobStatus, "questionGeneration"))}
                        </div>

                        {/* Upload */}
                        <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border">
                        <span className="text-xs font-medium text-muted-foreground">Upload</span>
                        {getTaskStatusIcon(getTaskStatus(aiJobStatus?.jobStatus, "uploadContent"))}
                        </div>
                    </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    </div>
  )
}

const YoutubeIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="18" 
    height="18" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="text-red-500"
  >
    <path d="M23.498 6.186a2.998 2.998 0 0 0-2.115-2.122C19.397 3.5 12 3.5 12 3.5s-7.397 0-9.383.564A2.998 2.998 0 0 0 .502 6.186C0 8.17 0 12 0 12s0 3.83.502 5.814a2.998 2.998 0 0 0 2.115 2.122C4.603 20.5 12 20.5 12 20.5s7.397 0 9.383-.564a2.998 2.998 0 0 0 2.115-2.122C24 15.83 24 12 24 12s0-3.83-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"/>
  </svg>
);

const Stepper = React.memo(({ jobStatus, currentJobData }: { jobStatus: any, currentJobData: any }) => {

  const WORKFLOW_STEPS = [
    { key: 'audioExtraction', label: 'Audio Extraction', icon: <UploadCloud className="w-5 h-5" /> },
    { key: 'transcriptGeneration', label: 'Transcription', icon: <FileText className="w-5 h-5" /> },
    { key: 'segmentation', label: 'Segmentation', icon: <ListChecks className="w-5 h-5" /> },
    { key: 'questionGeneration', label: 'Question Generation', icon: <MessageSquareText className="w-5 h-5" /> },
    { key: 'uploadContent', label: 'Upload', icon: <UploadCloud className="w-5 h-5" /> },
  ];
  
  const getStepStatus = (currentJobData: any, stepKey: string) => {

    if (!currentJobData) return 'pending';
  
    const taskToStep: Record<string, string> = {
      'AUDIO_EXTRACTION': 'audioExtraction',
      'TRANSCRIPT_GENERATION': 'transcriptGeneration',
      'SEGMENTATION': 'segmentation',
      'QUESTION_GENERATION': 'questionGeneration',
      'UPLOAD_CONTENT': 'uploadContent',
    };
  
    const currentTaskStep = taskToStep[currentJobData.task] || null;
  
    if (!currentTaskStep) return 'pending';
  
    const stepOrder = ['audioExtraction', 'transcriptGeneration', 'segmentation', 'questionGeneration', 'uploadContent'];
  
    const stepIndex = stepOrder.indexOf(stepKey);
    const currentIndex = stepOrder.indexOf(currentTaskStep);
  
    if (stepIndex === -1 || currentIndex === -1) return 'pending';
  
    if (stepIndex < currentIndex) {
      return 'completed';
    } else if (stepIndex > currentIndex) {
      return 'pending';
    } else {
      // Current step
      let status = currentJobData.status?.toLowerCase() || 'pending';
      if (status === 'running') return 'active';
      if (status === 'completed') return 'completed';
      if (status === 'failed') return 'failed';
      if (status === 'stopped') return 'stopped';
      if (status === 'waiting' || status === 'pending') return 'pending';
      return 'pending';
    }
  }  



  console.log("Job status from stepper: ", jobStatus, 'Current status: ', currentJobData);
  const activeStep = React.useMemo(() => {
    if (!currentJobData) return null;

    if (currentJobData.task === 'AUDIO_EXTRACTION') {
      return 'audioExtraction';
    }
    if (currentJobData.task === 'TRANSCRIPT_GENERATION') {
      return 'transcriptGeneration';
    }
    if (currentJobData.task === 'SEGMENTATION') {
      return 'segmentation';
    }
    if (currentJobData.task === 'QUESTION_GENERATION') {
      return 'questionGeneration';
    }
    if (currentJobData.task === 'UPLOAD_CONTENT') {
      return 'uploadContent';
    }

    return null;
  }, [currentJobData]);

  return (
    <div className="flex items-center justify-between mb-8 px-2 relative animate-fade-in">
      {WORKFLOW_STEPS.map((step, idx) => {
        const status = getStepStatus(currentJobData, step.key);
        const isCurrent = step.key === activeStep;

        const isLast = idx === WORKFLOW_STEPS.length - 1;
        const isCompleted = status === 'completed';
        const isFailed = status === 'failed';
        const isStopped = status === 'stopped';
        const isActive = status === 'active' || (isCurrent && !isCompleted && !isFailed && !isStopped);

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center relative z-10 animate-step-appear">
              {/* Step Circle */}
              <div className={`
                stepper-step rounded-full p-3 mb-3 transition-all duration-500 ease-out transform hover:scale-110
                ${isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 ring-2 ring-green-500/20 animate-stepper-success-glow' :
                  isActive ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20 animate-stepper-glow' :
                    isFailed ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 ring-2 ring-red-500/20 animate-stepper-error-glow' :
                      isStopped ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 ring-2 ring-orange-500/20 animate-stepper-error-glow' :
                        'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground shadow-md ring-1 ring-border/50 hover:shadow-lg hover:shadow-lg hover:ring-2 hover:ring-primary/20'
                }`}
                style={{ minWidth: 48, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Animated Icons */}
                <div className="transition-all duration-300 ease-out flex items-center justify-center w-6 h-6">
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 animate-bounce" />
                  ) : isActive ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="w-6 h-6 animate-pulse" />
                  ) : isStopped ? (
                    <PauseCircle className="w-6 h-6 animate-pulse" />
                  ) : (
                    <div className="transition-all duration-300 hover:scale-110 flex items-center justify-center w-6 h-6">
                      {step.icon}
                    </div>
                  )}
                </div>
              </div>

              {/* Step Label */}
              <div className="text-center max-w-24">
                <span className={`
                  text-sm font-semibold transition-all duration-300 ease-out
                  ${isCompleted ? 'text-green-600 dark:text-green-400' :
                    isActive ? 'text-blue-600 dark:text-blue-400' :
                      isFailed ? 'text-red-600 dark:text-red-400' :
                        isStopped ? 'text-orange-600 dark:text-orange-400' :
                          'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>

                {/* Status Indicator */}
                {isActive && (
                  <div className="mt-1 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    <span className="ml-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Processing...
                    </span>
                  </div>
                )}
                {isCompleted && (
                  <div className="mt-1 flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      Complete
                    </span>
                  </div>
                )}
                {isFailed && (
                  <div className="mt-1 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="ml-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      Failed
                    </span>
                  </div>
                )}
                {isStopped && (
                  <div className="mt-1 flex items-center justify-center">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <span className="ml-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                      Stopped
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Connecting Line */}
            {!isLast && (
              <div className="flex-1 flex items-center justify-center relative z-0">
                <div className={`
                  stepper-line h-0.5 w-full mx-2 rounded-full transition-all duration-700 ease-out
                  ${isCompleted ? 'bg-green-500' : 'bg-muted'}
                `} style={{ minWidth: 32 }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default AiWorkflow
