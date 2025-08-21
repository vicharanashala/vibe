import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { aiSectionAPI, Chunk, getApiUrl, JobStatus, QuestionGenerationParameters, SegmentationParameters, TranscriptParameters } from '@/lib/genai-api';
import { useCourseStore } from '@/store/course-store';
import {  AlertTriangle, Ban, CheckCircle, Clock, FileText, ListChecks, Loader2, MessageSquareText, PauseCircle, RefreshCw, Settings, Upload, UploadCloud, XCircle, Zap } from 'lucide-react';
import { useRef, useState } from 'react'
import { toast } from 'sonner';
import { AudioTranscripter, validateTranscript } from './AudioTranscripter';
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

    // State
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [aiJobId, setAiJobId] = useState<string | null>(null);

    // Upload parameters
    const [uploadParams, setUploadParams] = useState({
    videoItemBaseName: "video_item",
    quizItemBaseName: "quiz_item",
    questionsPerQuiz: 1,
    });

    // Workflow configuration state
    const [selectedTasks, setSelectedTasks] = useState({
    transcription: true,
    segmentation: true,
    questions: true,
    upload: false,
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

    const errorRef = useRef<HTMLDivElement | null>(null);

    // Validation
    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };
  

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
        if (selectedTasks.transcription) {
            jobParams.transcriptParameters = {
                language: customTranscriptParams.language || "en",
                modelSize: customTranscriptParams.modelSize || "large",
            };
        }

        if (selectedTasks.segmentation) {
        jobParams.segmentationParameters = {
            lam: customSegmentationParams.lam ?? 4.6,
            runs: customSegmentationParams.runs ?? 25,
            noiseId: customSegmentationParams.noiseId ?? -1,
        };
        }

        if (selectedTasks.questions) {
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
        }

        // Create AI Job
        const { jobId } = await aiSectionAPI.createJob(jobParams);
        setAiJobId(jobId);
        console.log("[handleCreateJob] Set aiJobId:", jobId);

        // Success message
        const enabledTasksCount = Object.values(selectedTasks).filter(Boolean).length;
        const taskNames = Object.entries(selectedTasks)
        .filter(([, enabled]) => enabled)
        .map(([task]) => (task === "questions" ? "question generation" : task))
        .join(", ");

        if (enabledTasksCount > 0) {
        toast.success(`AI job created with automated ${taskNames}!`);
        } else {
        toast.success("AI job created successfully!");
        }

        // Note: Do NOT start audio extraction here. Wait for manual trigger.
        } catch (error) {
            toast.error("Failed to create AI job. Please try again.");
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

    /**
     * Handle task selection with automatic dependency management
     */
    const handleTaskSelection = (
    taskKey: keyof typeof selectedTasks,
    checked: boolean
    ) => {
    const newSelectedTasks = { ...selectedTasks };
    const taskIndex = taskOrder.indexOf(taskKey);

    if (checked) {
        // Enable all tasks up to and including the selected one
        for (let i = 0; i <= taskIndex; i++) {
        newSelectedTasks[taskOrder[i]] = true;
        }
    } else {
        // Disable this task and all subsequent tasks
        for (let i = taskIndex; i < taskOrder.length; i++) {
        newSelectedTasks[taskOrder[i]] = false;
        }
    }

    setSelectedTasks(newSelectedTasks);
    };


    // ----------------------
    // Manual Refresh Handler
    // ----------------------

    const handleRefreshStatus = async () => {
    if (!aiJobId) return;

    try {
        const status = await aiSectionAPI.getJobStatus(aiJobId);
        setAiJobStatus(status);

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
        <Card className="mb-2">
            <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <CardTitle className="flex items-center gap-3 text-xl">
                    <Settings className="w-6 h-6" />
                    AI Workflow Tasks
                    </CardTitle>
                    <CardDescription className="text-base">
                    Select which tasks to run automatically. Dependencies are handled automatically.
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

            <CardContent className="space-y-8">
                <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {taskOrder.map((task, index) => {
                    const isSelected = selectedTasks[task]
                    const isDependency = index > 0 && selectedTasks[taskOrder[index - 1]]
                    const taskLabels = {
                        transcription: "Transcription",
                        segmentation: "Segmentation",
                        questions: "Question Generation",
                        upload: "Upload to Course",
                    }
                    const taskIcons = {
                        transcription: <FileText className="w-5 h-5" />,
                        segmentation: <ListChecks className="w-5 h-5" />,
                        questions: <MessageSquareText className="w-5 h-5" />,
                        upload: <UploadCloud className="w-5 h-5" />,
                    }

                    return (
                        <div
                        key={task}
                        className={`
                        relative p-6 border rounded-xl transition-all duration-300 hover:shadow-md
                        ${
                            isSelected
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 shadow-sm"
                            : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }
                        ${isDependency ? "ring-2 ring-blue-300 dark:ring-blue-700" : ""}
                        `}
                        >
                        <div className="flex items-start space-x-4">
                            <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleTaskSelection(task, !!checked)}
                            disabled={!!aiJobId}
                            className="mt-1.5"
                            />
                            <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-3">
                                <div
                                className={`p-1.5 rounded-lg ${isSelected ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-200 dark:bg-gray-700"}`}
                                >
                                {taskIcons[task]}
                                </div>
                                <Label className="font-semibold text-base cursor-pointer leading-tight">
                                {taskLabels[task]}
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {task === "transcription" && "Convert audio to text with high accuracy"}
                                {task === "segmentation" && "Split content into logical segments"}
                                {task === "questions" && "Generate comprehensive quiz questions"}
                                {task === "upload" && "Upload processed content to course"}
                            </p>
                            {isDependency && (
                                <div className="pt-2">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Auto-selected
                                </span>
                                </div>
                            )}
                            </div>
                        </div>
                        </div>
                    )
                    })}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-blue-800 dark:text-blue-200 text-base">Smart Dependencies</p>
                        <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                        Tasks run in sequence: Transcription → Segmentation → Questions → Upload. Selecting a later task
                        automatically enables all previous required tasks.
                        </p>
                    </div>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border p-6 space-y-4">
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

                {showAdvancedConfig && (
                    <Accordion type="multiple" className="border rounded-xl overflow-hidden">
                    {selectedTasks.transcription && (
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
                    )}

                    {selectedTasks.segmentation && (
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
                    )}

                    {selectedTasks.questions && (
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
                    )}
                    </Accordion>
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

                        <input
                            placeholder="YouTube URL"
                            value={youtubeUrl}
                            onChange={(e) => {
                            setUrlError(null);
                            setYoutubeUrl(e.target.value);
                            }}
                            disabled={!!aiJobId}
                            className={`pl-10 flex-1 w-full border rounded-md py-2 transition-all duration-300 ease-in-out ${
                            urlError ? "border-red-500" : "border-blue-600"
                            } focus:border-blue-500 focus:ring-2 focus:ring-blue-800 outline-none`}
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
                        <Button
                            onClick={handleRefreshStatus}
                            variant="outline"
                            className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                            >
                            <RefreshCw className="w-4 h-4 mr-2" />
                             Refresh Status
                         </Button>
                    </div>

                    <p className="text-md text-gray-600 dark:text-gray-200">
                        Select your preferred method to upload audio — via File, Link, or Recording.
                    </p>

                    {/* Transcribe component */}

                    <AudioTranscripter 
                        // onSave={setTranscribedData}
                        transcribedData = {transcribedData}
                        setTranscribedData={setTranscribedData}
                    />

                    <div className="flex justify-center">
                        <Button
                        onClick={handleCreateJob}
                        disabled={!!aiJobId}
                        className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                        {aiJobId
                            ? "Job Created"
                            : (() => {
                                const enabledCount = Object.values(selectedTasks).filter(Boolean).length
                                const enabledTaskNames = Object.entries(selectedTasks)
                                .filter(([, enabled]) => enabled)
                                .map(([task]) => {
                                    const labels = {
                                    transcription: "Transcription",
                                    segmentation: "Segmentation",
                                    questions: "Questions",
                                    upload: "Upload",
                                    }
                                    return labels[task as keyof typeof labels]
                                })

                                if (enabledCount === 0) {
                                return "Create AI Job"
                                } else if (enabledCount <= 2) {
                                return `Start AI Job (${enabledTaskNames.join(" + ")})`
                                } else {
                                return `Start AI Job (${enabledCount} tasks)`
                                }
                            })()}
                        </Button>
                    </div>
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

export default AiWorkflow
