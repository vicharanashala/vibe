import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiSectionAPI, Chunk, connectToLiveStatusUpdates, getApiUrl, JobStatus, QuestionGenerationParameters, SegmentationParameters } from '@/lib/genai-api';
import { useCourseStore } from '@/store/course-store';
import {  ArrowLeft, CheckCircle, Clock, FileText, HelpCircle, ListChecks, Loader2, MessageSquareText, PauseCircle, RefreshCw, Scissors, Sparkles, Upload, UploadCloud, XCircle, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner';
import { AudioTranscripter } from './AudioTranscripter';
import { TranscriberData } from '@/hooks/useTranscriber';
import { useNavigate } from '@tanstack/react-router';


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

    const [customSegmentationParams, setCustomSegmentationParams] =
    useState<SegmentationParameters>({
        lam: 4.5,
        runs: 25,
        noiseId: -1,
    });

    // Track AI job status
    const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null);
    const prevJobStatusRef = useRef<any>(null);
    const didMountRef = useRef(false);
    const navigate = useNavigate();
    const [taskRuns, setTaskRuns] = useState<TaskRuns>({
    transcription: [],
    segmentation: [],
    question: [],
    upload: [],
    });


    const [aiWorkflowStep, setAiWorkflowStep] = useState("");
    const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined);
    const errorRef = useRef<HTMLDivElement | null>(null);


    const [currentJob, setCurrentJob] = useState<{status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | "WAITING", task: any} | null>(null)
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAudioExtracting, setIsAudioExtracting] = useState(false);
    const [isAiJobStarted, setIsAiJobStarted] = useState(false); //will true once segmentation starts (backend)
    const [isURLValidated, setIsURLValidated] = useState(false); // will true once yt url is validated
    const [isLoading, setIsLoading] = useState(false); // mock loading for yt url
    const [progress, setProgress] = useState(0);
    const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
    const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null); // array of arrays of transcript chunks per segment
    const [segments, setSegments] = useState<any[]>([]);

    const [isTaskResultLoading, setIsTaskResultLoading] = useState(false);
    const [error, setError] = useState("");

    const handleShowHandleResult = async (task: string) => {
        if (!aiJobId) return;
        
        try {
            if (!task) {
            toast.error("No task found to show result!");
            return;
            }

            const token = localStorage.getItem("firebase-auth-token");
            const url = getApiUrl(`/genai/${aiJobId}/tasks/${task}/status`);
            console.log("Requested url: ", url);

            const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch task status");

            const data = await res.json();
            console.log("Data", data);
            handleExtractSegmentationResponse(data);
        } catch (error) {
            console.error("Error fetching task result:", error);
            toast.error("Failed to fetch task result");
        }
    };

    const handleExtractSegmentationResponse = async (response: any) => {
    try {
        const segData = Array.isArray(response) ? response[0] : null;

        if (
        segData &&
        segData.segmentationMap &&
        Array.isArray(segData.segmentationMap) &&
        segData.transcriptFileUrl
        ) {
        setSegmentationMap(segData.segmentationMap);

        const transcriptRes = await fetch(segData.transcriptFileUrl);
        if (!transcriptRes.ok)
            throw new Error("Failed to fetch transcript file");

        const transcriptData = await transcriptRes.json();
        const chunks = Array.isArray(transcriptData.chunks)
            ? transcriptData.chunks
            : [];
        const segMap = segData.segmentationMap;
        const grouped: any[][] = [];

        let segStart = 0;
        for (let i = 0; i < segMap.length; ++i) {
            const segEnd = segMap[i];
            const segChunks = chunks.filter(
            (chunk: { timestamp: [number, number]; text: string }) =>
                chunk.timestamp &&
                typeof chunk.timestamp[0] === "number" &&
                chunk.timestamp[0] >= segStart &&
                chunk.timestamp[0] < segEnd
            );
            grouped.push(segChunks);
            segStart = segEnd;
        }
        setSegmentationChunks(grouped);
        } else if (segData?.transcriptFileUrl) {
        const segs = await fetchSegmentationFromUrl(segData.transcriptFileUrl);
        console.log("Extracted segments: ", segs);
        setSegments(segs);
        setSegmentationMap(null);
        setSegmentationChunks(null);
        } else {
        setError("Segmentation data not found.");
        setSegmentationChunks(null);
        }
    } catch (error) {
        console.error("Error extracting segmentation response:", error);
    } finally {
        setIsTaskResultLoading(false);
    }
    };

    const fetchSegmentationFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch segmentation file");
    const data = await response.json();

    if (Array.isArray(data.segments)) {
        return data.segments;
    }
    if (Array.isArray(data.chunks)) {
        return data.chunks;
    }
    return data;
    };

    // Validation
    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };
  
  
    useEffect(() => {
        if (!aiJobId) return;

        const es = connectToLiveStatusUpdates(aiJobId, (incoming) => {
            console.log("Incoming >>>>", incoming)

            //  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

            //  const taskToStep: Record<string, string> = {
            //   'AUDIO_EXTRACTION': 'audioExtraction',
            //   'TRANSCRIPT_GENERATION': 'transcriptGeneration',
            //   'SEGMENTATION': 'segmentation',
            //   'QUESTION_GENERATION': 'questionGeneration',
            //   'UPLOAD_CONTENT': 'uploadContent',
            // };
        setCurrentJob({
            task: incoming.task,
            status: incoming.status
        })

        if(incoming.status == "COMPLETED"){
            handleShowHandleResult(incoming.task); // to show the result of the tasks
            setProgress(100);
            setTimeout(() => setIsLoading(false), 500);

            if(incoming.task == "SEGMENTATION"){
                toast.success("Segmentation completed!")
                setCurrentJob({task: "QUESTION_GENERATION", status: "WAITING"}) // Setting next task as waiting
            }
            else if (incoming.task == "QUESTION_GENERATION"){
                toast.success("Question generation completed!")
                setCurrentJob({task: "UPLOAD_CONTENT", status: "WAITING"})
            }

        }

        setAiJobStatus(() => {
            let next: any =  { ...incoming } ;
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

            return next;
        });
        });
        return () => es.close();

    }, [aiJobId]);

    useEffect(()=> {
        if(isAudioExtracting) 
            setCurrentJob({
                status: "RUNNING",
                task: 'AUDIO_EXTRACTION'
            });
        if (isTranscribing) {
            setIsLoading(true);
            setCurrentJob({
                status: "RUNNING",
                task: 'TRANSCRIPT_GENERATION'
            });
        }
        
        else if (!isTranscribing && transcribedData && !aiJobId) {
            handleCreateJob(); // creating ai job first, then only transcript will complete
        }

    }, [isTranscribing, isAudioExtracting]);

   useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLoading || isTranscribing) {
        interval = setInterval(() => {
        setProgress((prev) => {
            if (prev >= 98) return prev;

            let increment = Math.max(0.2, (98 - prev) / 25);

            if (isTranscribing || currentJob?.task === "QUESTION_GENERATION") {
            increment = Math.max(0.1, increment / 2);
            }

            return Math.min(prev + increment, 98);
        });
        }, 1200); 
    } else {
        setProgress(0);
    }

    return () => clearInterval(interval);
    }, [isLoading, isTranscribing, isTranscribing, currentJob?.task]);

  
    // Handlers
    const handleCreateJob = async () => {

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
        // }

        // Create AI Job
        const { jobId } = await aiSectionAPI.createJob(jobParams);
        setAiJobId(jobId);
        setIsAiJobStarted(true);
        toast.success("Transcription completed successfully!"); // Job will create only when transcription complete
        setCurrentJob({status: "COMPLETED", task: 'TRANSCRIPT_GENERATION'}); // setting transcription status as completed once ai job created
        setCurrentJob({status: "WAITING", task: 'SEGMENTATION'}); 

        } catch (error) {
            setCurrentJob({status: "FAILED", task: 'TRANSCRIPT_GENERATION'})
            toast.error("An error occured. Please try again!");
        } finally {
            setProgress(100);
            setTimeout(() => setIsLoading(false), 500);
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

    // ----------------------
    // Manual Handlers
    // ----------------------

    const handleValidateURL = () => {
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
        setIsLoading(true)

        setTimeout(() => {
            setIsURLValidated(true);
            setIsLoading(false); 
        }, 500); 
    }

    const handleRefreshStatus = async () => {
        if (!aiJobId) return;
        try {
            const status = await aiSectionAPI.getJobStatus(aiJobId);
            const currentTaskData = getCurrentTask(status.jobStatus);

            if (!currentTaskData) {
                toast.error("Current task is missing");
                return;
            }

            const currentTask = currentTaskData.task; 
            const currentStatus = currentTaskData.status;
            // const current
            setAiJobStatus( { ...status, task: currentTask, status: currentStatus  } );
            updateCurrentJob(currentTask, currentStatus);

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

    const updateCurrentJob = (
    task: "segmentation" | "questionGeneration" | "uploadContent",
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING",
    ) => {
        const taskMap: Record<string, string> = {
            segmentation: "SEGMENTATION",
            questionGeneration: "QUESTION_GENERATION",
            uploadContent: "UPLOAD_CONTENT",
        };

        setCurrentJob({
            status,
            task: taskMap[task],
        });
    };


    const handleApproveTask = async() => {
        try {

            if (!aiJobId) {
                toast.error("Job not found");
                return;
            }
            
            const status = await aiSectionAPI.getJobStatus(aiJobId);
            
            if(!status || !status.jobStatus){
                toast.error("Failed to fetch job status, Try again!");
                return;
            }
            
            const currentTaskData = getCurrentTask(status.jobStatus);

            if (!currentTaskData) {
                toast.error("Current task is missing");
                return;
            }

            const currentTask = currentTaskData.task; 
            const currentStatus = currentTaskData.status;

            setAiJobStatus( { ...status, task: currentTask, status: currentStatus  } );
 

            const customUploadParams = { 
                courseId: currentCourse?.courseId, 
                versionId: currentCourse?.versionId, 
                moduleId: currentCourse?.moduleId, 
                sectionId: currentCourse?.sectionId, 
                videoItemBaseName: uploadParams.videoItemBaseName, 
                quizItemBaseName: uploadParams.quizItemBaseName, questionsPerQuiz: uploadParams.questionsPerQuiz
            };

            let params: Record<string, any> | null = null;
            console.log("Segmentation params while approving: ", customSegmentationParams)

            switch (currentTask) {
                case 'segmentation':
                    params = {parameters: customSegmentationParams, usePrevious: 0, type: "SEGMENTATION"};
                    break;
                case 'questionGeneration':
                    params = { parameters: customQuestionParams, type: "QUESTION_GENERATION"};
                    break;
                case 'uploadContent': 
                    params = { parameters: customUploadParams , type: "UPLOAD_CONTENT", usePrevious: 0 };
                    break;
                default: 
                    console.error("Invalid current task", currentTask);
                    toast.error("Invalida current task");
                    return;
            }
            await aiSectionAPI.approveContinueTask(aiJobId);
            await aiSectionAPI.approveStartTask(aiJobId, params);
                    
            // updateCurrentJob(currentTask, currentStatus);
            toast.success("Task approved!");

            if(currentTask != "uploadContent"){
                setIsLoading(true);
            }
            else{
                handleRefreshStatus();
            }

        } catch(error) {
            toast.error("Failed to approve task");
            console.log("Failed to approve task", error);
            setIsLoading(false);
        } 
    }


  return (
    <div className='py-2'>
       <div className="mb-4"> 
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
            <CardHeader >
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
                </div>
            </CardHeader>
            {!isURLValidated ?
            <CardContent className="space-y-4">
                <div className="space-y-6">
                {/* {showAdvancedConfig && (
                    <div
                    className={`transition-all duration-500 ease-in-out overflow-hidden ${
                        showAdvancedConfig ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                    >
                        <Accordion type="multiple" className="border rounded-xl overflow-hidden">
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
                        <div className=" rounded-xl border p-6 space-y-4 pb-10 mt-5 ">
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
                        <div className="border-t dark:border-gray-800  border-gray-200 mt-6"></div>
                    </div>
                )} */}
                </div>
                    <div className="flex-1 w-full mt-5 space-y-3">
                        
                        <div className="relative w-full">
                        <div
                            className={`absolute left-3 top-1/2 -translate-y-1/2 text-red-500 transition-transform duration-300 ease-in-out ${
                            youtubeUrl ? "scale-110" : "scale-100"
                            }`}
                        >
                            <YoutubeIcon />
                        </div>

                        <Input
                            placeholder="Enter YouTube URL"
                            value={youtubeUrl}
                            onChange={(e) => {
                            setUrlError(null);
                            setYoutubeUrl(e.target.value);
                            }}
                            disabled={!!aiJobId}
                            onFocus={() => setShowAdvancedConfig(false)}
                            className={`pl-10 flex-1 w-full border rounded-lg py-2.5 focus:ring-2 focus:ring-primary/50 transition-all duration-300 ease-in-out ${
                            urlError ? "border-red-500" : "border-gray-300"
                            }`}
                        />

                        {urlError && (
                            <p 
                            ref={errorRef}
                            className="absolute left-0 mt-1 text-red-500 text-sm"
                            style={{ top: '100%' }} 
                            >
                            {urlError}
                            </p>
                        )}
                        </div>

                        {/* Confirm Button */}
                        <Button
                            onClick={handleValidateURL}
                            variant="default"
                            disabled={isLoading}
                            className="flex items-center gap-2 w-full mx-auto mt-5 sm:w-auto bg-primary text-black hover:bg-primary/90 font-medium px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-transform duration-300 hover:scale-105"
                            >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" /> 
                            ) : (
                                <CheckCircle className="w-5 h-5" />
                            )}
                            {isLoading ? "Validating..." : "Confirm URL"}
                        </Button>
                    </div>
            </CardContent>:
        <div className=" bg-gradient-to-br from-background to-muted/20 ">
            
            {isURLValidated && <Stepper currentJobData={currentJob}/> }

            {isLoading && (
                <div className="space-y-2  bg-card w-full">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                        className="bg-yellow-500 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                    </div>

                    <div className="text-sm text-gray-600 font-medium text-center">
                    {progress.toFixed(2)}% Completed
                    </div>
                </div>
            )}
            <div className="mx-auto">
                <div className="bg-card shadow-lg p-8 space-y-6">
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/20">
                    <div className="flex items-center gap-3 pb-2">
                        {currentJob?.task === "SEGMENTATION" ? (
                        <>
                            <Scissors className="w-6 h-6 dark:text-white" />
                            <h2 className="text-xl font-bold">Segmenting Content</h2>
                        </>
                        ) : currentJob?.task === "QUESTION_GENERATION" ? (
                        <>
                            <HelpCircle className="w-6 h-6 dark:text-white" />
                            <h2 className="text-xl font-bold">Generating Questions</h2>
                        </>
                        ) : currentJob?.task === "UPLOAD_CONTENT" ? (
                        <>
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            <h2 className="text-xl font-bold">Course Upload</h2>
                        </>
                        ) : (
                        <>
                            <Upload className="w-6 h-6 dark:text-white" />
                            <h2 className="text-xl font-bold">Upload Audio</h2>
                        </>
                        )}
                    </div>
                    <Button
                        onClick={handleRefreshStatus}
                        variant="outline"
                        className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 mb-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    </div>

                    {/* Dynamic Content */}
                    {currentJob?.task === "SEGMENTATION" ? (
                        <SegmentationView
                            isLoading={isLoading || isTaskResultLoading}
                            error={error}
                            segmentationMap={segmentationMap}
                            segmentationChunks={segmentationChunks}
                            segments={segments}
                            isAiJobStarted={isAiJobStarted}
                            aiJobId={aiJobId}
                            handleApproveTask={handleApproveTask}
                            currentJobStatus = {currentJob.status}
                            setCustomSegmentationParams ={setCustomSegmentationParams}
                            customSegmentationParams = {customSegmentationParams}
                        />
                    ) : currentJob?.task === "QUESTION_GENERATION" ? (
                    <div className="py-12 text-center text-gray-500">
                        {isLoading || isTaskResultLoading ? "Generating questions..." : "Question generation content goes here"}
                        {isAiJobStarted && aiJobId && (
                        <div className="flex justify-center">
                            <Button
                                disabled={isLoading}
                                onClick={handleApproveTask}
                                className="w-full sm:w-auto mt-5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                Generate question
                                <Zap className="w-5 h-5" />
                            </Button>
                        </div>)}
                    </div>
                    ) : currentJob?.task === "UPLOAD_CONTENT" ? (
                        <UploadContentView
                            currentJobStatus = {currentJob.status} 
                            setUploadParams = {setUploadParams}
                            uploadParams = {uploadParams} 
                            handleApproveTask = {handleApproveTask} 
                            isLoading = {isLoading}
                        />
                    ) : (
                    <>
                        <p className="text-md text-gray-600 dark:text-gray-200">
                        Select your preferred method to upload audio — via File, Link, or Recording.
                        </p>
                        <AudioTranscripter
                            setIsAudioExtracting={setIsAudioExtracting}
                            setIsTranscribing={setIsTranscribing}
                            transcribedData={transcribedData}
                            setTranscribedData={setTranscribedData}
                            isRunningAiJob={!!aiJobId}
                        />
                        {isAiJobStarted && aiJobId && (
                        <div className="flex justify-center">
                            <Button
                            onClick={handleApproveTask}
                            disabled={isLoading}
                            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                            Next
                            </Button>
                        </div>
                        )}
                    </>
                    )}
                </div>
            </div>

        </div>
        }
    </Card>
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

const Stepper = React.memo(({  currentJobData }: {  currentJobData: any }) => {

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
      if (status === 'waiting' ) return 'waiting';
      return 'pending';
    }
  }  



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
    <div className=" bg-card pb-3">
        <div className="flex items-center justify-between  px-8 relative animate-fade-in ">
        {WORKFLOW_STEPS.map((step, idx) => {
            const status = getStepStatus(currentJobData, step.key);
            const isCurrent = step.key === activeStep;

            const isLast = idx === WORKFLOW_STEPS.length - 1;
            const isCompleted = status === 'completed';
            const isFailed = status === 'failed';
            const isStopped = status === 'stopped' ;
            const isWaiting = status == 'waiting';
            const isActive = status === 'active' || (isCurrent && !isCompleted && !isFailed && !isStopped && !isWaiting);

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
                    isWaiting ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-500/20 animate-stepper-pending-glow':
                    'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground shadow-md ring-1 ring-border/50 hover:shadow-lg hover:ring-2 hover:ring-primary/20'
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
                    ) : isWaiting ? (
                        <Clock className="w-6 h-6 animate-pulse" />
                    )
                     : (
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
                        isWaiting ? 'text-purple-600 dark:text-purple-400 animate-pulse':
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
                   {isWaiting && (
                    <div className="mt-1 flex items-center justify-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                        <span className="ml-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                         Wating ...
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
    </div>
  );
});

const SegmentationView = ({
  isLoading,
  error,
  segmentationMap,
  segmentationChunks,
  segments,
  isAiJobStarted,
  aiJobId,
  handleApproveTask,
  currentJobStatus,
  customSegmentationParams,
  setCustomSegmentationParams
}: any) => {
  const isAnyLoading = isLoading;
  const hasSegmentationData = segmentationMap?.length > 0 && segmentationChunks;
  const hasFallbackSegments = segments.length > 0 && (!segmentationMap?.length || !segmentationChunks);

  return (
    <div className={`${currentJobStatus!="WAITING" && "py-12"} text-center text-gray-500`}>
      {isAnyLoading ? (
        "Loading segmentation..."
      ) : hasSegmentationData ? (
        <ol className="mt-2 space-y-4">
          {segmentationMap.map((end: any, idx: any) => {
            const start = idx === 0 ? 0 : segmentationMap[idx - 1];
            const segChunks = segmentationChunks[idx] || [];
            return (
              <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-2">
                <div>
                  <b>Segment {idx + 1}:</b> {start.toFixed(2)}s – {end.toFixed(2)}
                </div>
                {segChunks.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {segChunks.map((chunk: { text: string }) => chunk.text).join(' ')}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : hasFallbackSegments ? (
        <ol className="mt-2 space-y-2">
          {segments.map((seg: any, idx: any) => (
            <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-1">
              <div>
                <b>Segment {idx + 1}</b> ({seg.startTime ?? seg.timestamp?.[0]}s - {seg.endTime ?? seg.timestamp?.[1]}s)
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">{seg.text}</div>
            </li>
          ))}
        </ol>
      ) : null}
    {currentJobStatus != "WAITING" && !isAnyLoading && !error && (!segmentationMap || segmentationMap.length === 0) && segments.length === 0 && <div className="mt-2">No segments found.</div>}

        {currentJobStatus === "WAITING" && (
            <div className="px-6 py-4 flex items-center justify-between gap-6 border rounded-lg shadow-sm bg-card">
                <div className="flex-1">
                <Label className="text-sm font-medium dark:text-gray-200 text-gray-800">
                    Segmentation Frequency
                </Label>
                <Select
                    onValueChange={(value) => {
                    setCustomSegmentationParams((prev: any) => ({
                        ...prev,
                        lam: parseFloat(value),
                    }));
                    }}
                    value={customSegmentationParams.lam.toString()}
                >
                    <SelectTrigger className="mt-2 h-10 w-full md:w-64">
                    <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="0.5">Very Frequent</SelectItem>
                    <SelectItem value="2">Frequent</SelectItem>
                    <SelectItem value="4.5">Normal</SelectItem>
                    <SelectItem value="5.5">Less Frequent</SelectItem>
                    <SelectItem value="7">Very Less Frequent</SelectItem>
                    </SelectContent>
                </Select>
                </div>

                <div className="mt-7 text-sm dark:text-gray-200 text-gray-900 max-w-xs transition-opacity duration-300">
                {customSegmentationParams.lam === 0.5 &&
                    "Segments will be created very frequently, providing high detail and precision."}
                {customSegmentationParams.lam === 2 &&
                    "Segments will be created frequently, offering a balance between detail and performance."}
                {customSegmentationParams.lam === 4.5 &&
                    "Normal segmentation – balanced detail and efficiency for general use cases."}
                {customSegmentationParams.lam === 5.5 &&
                    "Less frequent segmentation – fewer segments, faster processing but lower detail."}
                {customSegmentationParams.lam === 7 &&
                    "Very minimal segmentation – ideal for large datasets where performance is critical."}
                </div>
            </div>
        )}

      {isAiJobStarted && aiJobId && (
        <div className="flex justify-center">
          <Button
            disabled={isLoading}
            onClick={handleApproveTask}
            className="w-full sm:w-auto mt-8 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
            Confirm
            <CheckCircle className="w-5 h-5" />
        </Button>
        </div>
      )}
    </div>
  );
};

interface UploadParams {
  videoItemBaseName: string;
  quizItemBaseName: string;
  questionsPerQuiz: number;
}

interface UploadContentProps {
  currentJobStatus: string;
  uploadParams: UploadParams;
  setUploadParams: React.Dispatch<React.SetStateAction<UploadParams>>;
  isLoading: boolean;
  handleApproveTask: () => void
}

const UploadContentView: React.FC<UploadContentProps> = ({
  currentJobStatus,
  uploadParams,
  setUploadParams,
  isLoading, 
  handleApproveTask
}) => {
  const navigate = useNavigate();

  if(currentJobStatus == "WAITING") { 
    return(<div className="space-y-6">
        {/* Upload Parameters */}
        <div className="rounded-xl border p-6 space-y-4 pb-10 mt-5">
        <h4 className="font-semibold text-base text-foreground mb-4">Upload Parameters</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
            <Label htmlFor="video-base-name" className="text-sm font-medium">
                Video Item Name
            </Label>
            <Input
                id="video-base-name"
                value={uploadParams.videoItemBaseName}
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, videoItemBaseName: e.target.value }))
                }
                placeholder="video_item"
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
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, quizItemBaseName: e.target.value }))
                }
                placeholder="quiz_item"
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
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, questionsPerQuiz: Number(e.target.value) }))
                }
                className="h-10"
            />
            </div>
        </div>
        </div>

        {/* Centered Next Button */}
        <div className="flex justify-center">
        <Button
            onClick={handleApproveTask}
            disabled={isLoading}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
            Upload Content
            <UploadCloud className="w-5 h-5" />
        </Button>
        </div>
    </div>)
    }


  return (
    <div className="text-center py-8">
      <p className="text-lg font-medium text-green-600">Course uploaded successfully!</p>
      <Button
        className="mt-4 px-6 py-2 bg-primary text-black rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
        onClick={() => navigate({ to: "/teacher/courses/view" })}
      >
        View Course
      </Button>
    </div>
  );
};


export default AiWorkflow

