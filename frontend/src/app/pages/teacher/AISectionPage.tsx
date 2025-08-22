import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI, connectToLiveStatusUpdates, JobStatus,getApiUrl } from "@/lib/genai-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Loader2,
  Play,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  XCircle,
  PauseCircle,
  UploadCloud,
  FileText,
  ListChecks,
  MessageSquareText
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCourseStore } from "@/store/course-store";

// Enhanced question types to match backend
type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed" | "stopped";
  result?: JobStatus;
  parameters?: Record<string, unknown>;
}

interface TaskRuns {
  transcription: TaskRun[];
  segmentation: TaskRun[];
  question: TaskRun[];
  upload: TaskRun[];
}

interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: number | number[] | string[] | number | string; // Varies by type
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  points: number;
  timeLimit?: number;
  hint?: string;
  decimalPrecision?: number; // For numeric questions
  expression?: string; // For numeric questions
}

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  questions: Question[];
}

interface VideoData {
  _id: string;
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  status: string;
  progress: number;
  currentStep: string;
  uploadDate: string;
  transcript: string;
  segments: Segment[];
  createdAt: string;
  updatedAt: string;
  duration: number;
}

type QuestionGenParams = {
  model: string;
  SQL: number;
  SML: number;
  NAT: number;
  DES: number;
  prompt: string;
};

// Stepper icons

const WORKFLOW_STEPS = [
  { key: 'audioExtraction', label: 'Audio Extraction', icon: <UploadCloud className="w-5 h-5" /> },
  { key: 'transcriptGeneration', label: 'Transcription', icon: <FileText className="w-5 h-5" /> },
  { key: 'segmentation', label: 'Segmentation', icon: <ListChecks className="w-5 h-5" /> },
  { key: 'questionGeneration', label: 'Question Generation', icon: <MessageSquareText className="w-5 h-5" /> },
  { key: 'uploadContent', label: 'Upload', icon: <UploadCloud className="w-5 h-5" /> },
];

const getStepStatus = (jobStatus: any, stepKey: string) => {
  if (!jobStatus) return 'pending';

  const taskToStep: Record<string, string> = {
    'AUDIO_EXTRACTION': 'audioExtraction',
    'TRANSCRIPT_GENERATION': 'transcriptGeneration',
    'SEGMENTATION': 'segmentation',
    'QUESTION_GENERATION': 'questionGeneration',
    'UPLOAD_CONTENT': 'uploadContent',
  };

  const currentTaskStep = taskToStep[jobStatus.task] || null;

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
    let status = jobStatus.status?.toLowerCase() || 'pending';
    if (status === 'running') return 'active';
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (status === 'stopped') return 'stopped';
    if (status === 'waiting' || status === 'pending') return 'pending';
    return 'pending';
  }
}


const Stepper = React.memo(({ jobStatus }: { jobStatus: any }) => {

  const activeStep = React.useMemo(() => {
    if (!jobStatus) return null;

    if (jobStatus.task === 'AUDIO_EXTRACTION') {
      return 'audioExtraction';
    }
    if (jobStatus.task === 'TRANSCRIPT_GENERATION') {
      return 'transcriptGeneration';
    }
    if (jobStatus.task === 'SEGMENTATION') {
      return 'segmentation';
    }
    if (jobStatus.task === 'QUESTION_GENERATION') {
      return 'questionGeneration';
    }
    if (jobStatus.task === 'UPLOAD_CONTENT') {
      return 'uploadContent';
    }

    return null;
  }, [jobStatus]);

  return (
    <div className="flex items-center justify-between mb-8 px-2 relative animate-fade-in">
      {WORKFLOW_STEPS.map((step, idx) => {
        const status = getStepStatus(jobStatus, step.key);
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



export default function AISectionPage() {
  // AI Section workflow state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [segParams, setSegParams] = useState({ lam: 4.6, runs: 25, noiseId: -1 });
  const [taskRuns, setTaskRuns] = useState<TaskRuns>({
    transcription: [],
    segmentation: [],
    question: [],
    upload: [],
  });
  const [acceptedRuns, setAcceptedRuns] = useState<Partial<Record<keyof TaskRuns, string>>>({});



  // // Drag and drop handlers for ORDER_THE_LOTS questions (unchanged)
  // const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
  //   e.dataTransfer.setData('text/plain', index.toString());
  //   e.dataTransfer.effectAllowed = 'move';
  // }, []);
  // const handleDragOver = useCallback((e: React.DragEvent) => {
  //   e.preventDefault();
  //   e.dataTransfer.dropEffect = 'move';
  // }, []);
  // const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
  //   e.preventDefault();
  //   const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
  //   if (dragIndex === dropIndex) return;
  //   setEditedQuestion(prev => {
  //     const currentOptions = [...(prev.options || [])];
  //     const dragItem = currentOptions[dragIndex];
  //     currentOptions.splice(dragIndex, 1);
  //     currentOptions.splice(dropIndex, 0, dragItem);
  //     return { ...prev, options: currentOptions };
  //   });
  // }, []);

  // New: Track current AI job status for manual refresh
  const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null);
  const [aiWorkflowStep, setAiWorkflowStep] = useState<'idle' | 'audio_extraction' | 'audio_extraction_done' | 'transcription' | 'transcription_done' | 'error'>('idle');
  // New: Track if approveContinueTask has been called for current job's WAITING state
  const [approvedForCurrentJob, setApprovedForCurrentJob] = useState(false);
  // New: Track if continue+start for transcript has been triggered for the current job
  const [transcriptStartedForCurrentJob, setTranscriptStartedForCurrentJob] = useState(false);
  // New: Parameters for rerun
  const [rerunParams, setRerunParams] = useState({ language: 'en', model: 'default' });

  // Add state for question generation parameters
  const [questionGenParams, setQuestionGenParams] = useState<QuestionGenParams>({
    model: 'deepseek-r1:70b',
    SQL: 1,
    SML: 0,
    NAT: 0,
    DES: 0,
    prompt: `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`
  });

  // AI Section Handlers
  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  };



  const handleCreateJob = async () => {
    if (!youtubeUrl.trim()) {
      setUrlError("YouTube URL is required");
      return;
    }
    if (!isValidYouTubeUrl(youtubeUrl.trim())) {
      setUrlError("Please enter a valid YouTube URL");
      return;
    }
    setUrlError(null);
    // Get courseId and versionId from store
    const { currentCourse } = useCourseStore.getState();
    if (!currentCourse?.courseId || !currentCourse?.versionId) {
      toast.error("Missing course or version information");
      return;
    }
    try {
      const { jobId } = await aiSectionAPI.createJob({
        videoUrl: youtubeUrl,
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId,
        moduleId: currentCourse.moduleId,
        sectionId: currentCourse.sectionId,
        videoItemBaseName: 'video_item',
        quizItemBaseName: 'quiz_item',
      });
      setAiJobId(jobId);
      toast.success("AI job created successfully!");
      // Do NOT start audio extraction here. Wait for user to click Transcription button.
    } catch (error) {
      toast.error("Failed to create AI job. Please try again.");
    }
  };

  // Refactored handleTask for transcription (no polling)
  const handleTask = async (task: keyof typeof taskRuns, segParams: any, questionGenParams: any) => {

    if (!aiJobId) {
      toast.error("Please create an AI job first");
      return;
    }
    const runId = `run-${Date.now()}-${Math.random()}`;
    const newRun: TaskRun = {
      id: runId,
      timestamp: new Date(),
      status: "loading",
      parameters: task === "segmentation" ? { ...segParams } : undefined,
    };
    try {
      if (task === "transcription") {
        const hasStoppedRun = taskRuns.transcription.some(r => r.status === 'stopped');
        if (hasStoppedRun) {
          setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
          await aiSectionAPI.postJobTask(aiJobId, 'AUDIO_EXTRACTION');
          setAiWorkflowStep('audio_extraction');
          toast.success("Transcription restarted. Click Refresh to check status.");
          await handleRefreshStatus();
          return;
        }
        
        if (aiJobStatus?.jobStatus?.transcriptGeneration === 'COMPLETED') {
          // Rerun transcription with selected parameters
          await aiSectionAPI.rerunJobTask(aiJobId, 'TRANSCRIPT_GENERATION', rerunParams);
          setAiWorkflowStep('transcription');
          toast.success("Transcription rerun started. Click Refresh to check status.");
          setTaskRuns(prev => ({
            ...prev,
            transcription: [...prev.transcription, {
              id: runId,
              timestamp: new Date(),
              status: "loading",
              parameters: { ...rerunParams }
            }]
          }));
          await handleRefreshStatus();
          return;
        }
        // Only start audio extraction, do not poll
        setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
        await aiSectionAPI.postJobTask(aiJobId, 'AUDIO_EXTRACTION');
        setAiWorkflowStep('audio_extraction');
        toast.success("Audio extraction started. Click Refresh to check status.");
        setTaskRuns(prev => ({
          ...prev,
          [task]: prev[task].map(run =>
            run.id === runId ? { ...run, status: "loading", result: undefined } : run
          ),
        }));
        await handleRefreshStatus();
        return;
      }
      let taskType = "";
      let params: Record<string, any> | undefined = undefined;
      switch (task) {
        case "segmentation": {
          taskType = "SEGMENTATION";
          const hasStoppedRun = taskRuns.segmentation.some(r => r.status === 'stopped');
          if (hasStoppedRun) {
            setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
            await aiSectionAPI.approveContinueTask(aiJobId);
            params = { lam: segParams.lam, runs: segParams.runs, noiseId: segParams.noiseId };
            await aiSectionAPI.postJobTask(aiJobId, taskType, params, 0);
            toast.success("Segmentation restarted. Click Refresh to check status.");
            await handleRefreshStatus();
            return;
          }
          
          // Add a new loading run
          const runId = `run-${Date.now()}-${Math.random()}`;
          const newRun: TaskRun = {
            id: runId,
            timestamp: new Date(),
            status: "loading",
            parameters: { ...segParams }
          };
          setTaskRuns(prev => ({
            ...prev,
            segmentation: [...prev.segmentation, newRun]
          }));
          // Approve transcript before starting segmentation
          await aiSectionAPI.approveContinueTask(aiJobId);
          // Find the accepted transcript run index (0-based)
          const acceptedTranscriptId = acceptedRuns.transcription;
          // Always use usePrevious = 0 as per user request
          const usePrevious = 0;
          // Always use the latest values from segParams for the payload
          params = { lam: segParams.lam, runs: segParams.runs, noiseId: segParams.noiseId };
          await aiSectionAPI.postJobTask(aiJobId, taskType, params, usePrevious);
          await handleRefreshStatus();
          return;
        }
        case "question":
          taskType = "QUESTION_GENERATION";
          const hasStoppedQuestionRun = taskRuns.question.some(r => r.status === 'stopped');
          if (hasStoppedQuestionRun) {
            setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
            params = { ...questionGenParams };
            await aiSectionAPI.postJobTask(aiJobId, taskType, params);
            toast.success("Question generation restarted. Click Refresh to check status.");
            await handleRefreshStatus();
            return;
          }
          params = { ...questionGenParams };
          break;

        case "upload":
          taskType = "UPLOAD_TO_COURSE";
          break;
        default:
          throw new Error(`Unknown task: ${task}`);
      }
      setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
      await aiSectionAPI.postJobTask(aiJobId, taskType, params);

      if (task === "upload") {
        setTaskRuns(prev => ({
          ...prev,
          [task]: prev[task].map(run =>
            run.id === runId ? { ...run, status: "done" } : run
          ),
        }));
        toast.success("Section successfully added to course!");
        setTimeout(() => {
          setYoutubeUrl("");
          setAiJobId(null);
          setTaskRuns({
            transcription: [],
            segmentation: [],
            question: [],
            upload: [],
          });
        }, 1500);
      }
      await handleRefreshStatus();
    } catch (error) {
      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run =>
          run.id === runId ? { ...run, status: "failed" } : run
        ),
      }));
      setAiWorkflowStep('error');
      toast.error(`Task ${task} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      await handleRefreshStatus();
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

  // Remove handleSegParamChange and any reference to segParams.segments

  const canRunTask = (task: keyof typeof taskRuns): boolean => {
    switch (task) {
      case "transcription":
        return !!aiJobId && !taskRuns.transcription.some(r => r.status === 'loading');
      case "segmentation":
        return !!acceptedRuns.transcription && !taskRuns.segmentation.some(r => r.status === 'loading');
      case "question":
        return !!acceptedRuns.segmentation && !taskRuns.question.some(r => r.status === 'loading');
      case "upload":
        return !!acceptedRuns.question && !taskRuns.upload.some(r => r.status === 'loading');
      default:
        return false;
    }
  };

  // Helper to map status to icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
      case 'RUNNING':
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Loader2 className="animate-spin text-blue-500" /></span></TooltipTrigger><TooltipContent>Running</TooltipContent></Tooltip></TooltipProvider>;
      case 'done':
      case 'COMPLETED':
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><CheckCircle className="text-green-600" /></span></TooltipTrigger><TooltipContent>Completed</TooltipContent></Tooltip></TooltipProvider>;
      case 'FAILED':
      case 'failed':
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><XCircle className="text-red-600" /></span></TooltipTrigger><TooltipContent>Failed</TooltipContent></Tooltip></TooltipProvider>;
      case 'stopped':
      case 'STOPPED':
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><PauseCircle className="text-orange-500" /></span></TooltipTrigger><TooltipContent>Stopped</TooltipContent></Tooltip></TooltipProvider>;
      case 'WAITING':
      case 'PENDING':
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><PauseCircle className="text-yellow-500" /></span></TooltipTrigger><TooltipContent>Waiting/Pending</TooltipContent></Tooltip></TooltipProvider>;
      default:
        return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Play className="text-gray-400" /></span></TooltipTrigger><TooltipContent>Unknown</TooltipContent></Tooltip></TooltipProvider>;
    }
  };

  // Helper to map workflow step to user-friendly message
  const getWorkflowStepMessage = (step: string) => {
    switch (step) {
      case 'transcription_done':
        return 'Transcription Completed';
      case 'audio_extraction_done':
        return 'Audio Extraction Completed';
      case 'transcription':
        return 'Transcription In Progress';
      case 'audio_extraction':
        return 'Audio Extraction In Progress';
      case 'idle':
        return 'Idle';
      case 'error':
        return 'Error';
      default:
        return step;
    }
  };

  const TaskAccordion = React.memo(({ 
    task, 
    title, 
    jobStatus,
    taskRuns,
    acceptedRuns,
    aiJobId,
    aiJobStatus: accordionAiJobStatus,
    segParams,
    questionGenParams,
    rerunParams,
    handleTask,
    handleAcceptRun,
    canRunTask,
    setTaskRuns,
    setQuestionGenParams,
    setSegParams,
    setRerunParams,
    handleStartTranscription,
    getStatusIcon,
    handleStopTask
  }: { 
    task: keyof typeof taskRuns; 
    title: string; 
    jobStatus?: any;
    taskRuns: TaskRuns;
    acceptedRuns: Partial<Record<keyof TaskRuns, string>>;
    aiJobId: string | null;
    aiJobStatus: any;
    segParams: { lam: number; runs: number; noiseId: number };
    questionGenParams: QuestionGenParams;
    rerunParams: { language: string; model: string };
    handleTask: (task: keyof TaskRuns, segParams: any, questionGenParams: any) => Promise<void>;
    handleAcceptRun: (task: keyof TaskRuns, runId: string) => Promise<void>;
    canRunTask: (task: keyof TaskRuns) => boolean;
    setTaskRuns: React.Dispatch<React.SetStateAction<TaskRuns>>;
    setQuestionGenParams: React.Dispatch<React.SetStateAction<QuestionGenParams>>;
    setSegParams: React.Dispatch<React.SetStateAction<{ lam: number; runs: number; noiseId: number }>>;
    setRerunParams: React.Dispatch<React.SetStateAction<{ language: string; model: string }>>;
    handleStartTranscription: () => Promise<void>;
    getStatusIcon: (status: string) => React.ReactNode;
    handleStopTask: (task: keyof TaskRuns) => Promise<void>;
  }) => {
    const runs = taskRuns[task];
    const acceptedRunId = acceptedRuns[task];
    const { currentCourse } = useCourseStore();
    // Add state for upload parameters
    const [videoItemBaseName, setVideoItemBaseName] = useState("video_item");
    const [quizItemBaseName, setQuizItemBaseName] = useState("quiz_item");
    const [questionsPerQuiz, setQuestionsPerQuiz] = useState(1);

    const [localParams, setLocalParams] = useState(questionGenParams);

    const [localSegParams, setLocalSegParams] = useState(segParams);

    const fields = React.useMemo<(keyof Pick<QuestionGenParams, "SQL" | "SML" | "NAT" | "DES">)[]>(() =>
      ["SQL", "SML", "NAT", "DES"],
      [],);

    const segFields: { key: "lam" | "runs" | "noiseId", type: 'float' | "int" }[] = [
      { key: 'lam', type: 'float' },
      { key: 'runs', type: 'int' },
      { key: 'noiseId', type: 'int' }
    ];

    const handleSegParamChange = useCallback(
      <K extends keyof typeof segParams>(field: K, value: typeof segParams[K]) => {
        setLocalSegParams(prev => ({
          ...prev,
          [field]: value
        }));
      },
      []
    );

    const handleParamChange = useCallback(<K extends keyof QuestionGenParams>(
      field: K,
      value: QuestionGenParams[K]
    ) => {
      setLocalParams(prev => ({
        ...prev,
        [field]: value
      }));
    }, []);

    return (
      <div className="space-y-3">
        {/* Always show transcription parameter inputs for 'transcription' task */}
        {task === 'transcription' && (
          <div className="flex flex-row gap-4 mb-2">
            <div className="flex-1 flex flex-col items-start">
              <label className="mb-1">Language:</label>
              <select
                value={rerunParams.language}
                onChange={e => setRerunParams(p => ({ ...p, language: e.target.value }))}
                className="w-full px-2 py-1 rounded"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col items-start">
              <label className="mb-1">Model:</label>
              <select
                value={rerunParams.model}
                onChange={e => setRerunParams(p => ({ ...p, model: e.target.value }))}
                className="w-full px-2 py-1 rounded"
              >
                <option value="default">default</option>
                {/* Add more models as needed */}
              </select>
            </div>
          </div>
        )}
        {/* Show Start Transcription button for transcription task when audio extraction is completed */}
        {task === 'transcription' && accordionAiJobStatus?.status === 'COMPLETED' && accordionAiJobStatus?.task === 'AUDIO_EXTRACTION' && (
          <div className="mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleStartTranscription}
                    variant="default"
                    disabled={accordionAiJobStatus?.status !== 'COMPLETED' || accordionAiJobStatus?.task !== 'AUDIO_EXTRACTION'}
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
                  >
                    Start Transcription Task
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {(accordionAiJobStatus?.task as string) === "TRANSCRIPT_GENERATION" && (accordionAiJobStatus?.status as string) === 'PENDING' && (
                    <span>
                      Approves the transcript task. Click again when status is <b>WAITING</b> to actually start transcription.
                    </span>
                  )}
                  {(accordionAiJobStatus?.task as string) === "TRANSCRIPT_GENERATION" && (accordionAiJobStatus?.status as string) === 'WAITING' && (
                    <span>
                      Starts the transcript generation task. Status will move to <b>RUNNING</b>.
                    </span>
                  )}
                  {(accordionAiJobStatus?.task as string) === "TRANSCRIPT_GENERATION" && (accordionAiJobStatus?.status as string) !== 'PENDING' && (accordionAiJobStatus?.status as string) !== 'WAITING' && (
                    <span>
                      Transcript generation is not ready to start yet.
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {/* Always show question generation parameter inputs for 'question' task */}
        {task === 'question' && (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex flex-row gap-2">
              <div className="flex-1 flex flex-col">
                <label>Model:</label>
                <Input
                  type="text"
                  value={localParams.model}
                  onChange={e => handleParamChange("model", e.target.value)}
                  className="w-full"
                />
              </div>
              {fields.map(field => (
                <div key={field} className="flex-1 flex flex-col">
                  <label>{field}:</label>
                  <Input
                    key={`input-${field}`}
                    type="number"
                    min={0}
                    value={localParams[field]}
                    onChange={e => handleParamChange(field, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col mt-2">
              <label>prompt:</label>
              <Textarea
                value={localParams.prompt}
                onChange={e => setLocalParams(p => ({ ...p, prompt: e.target.value }))}
                className="w-full min-h-[80px]"
              />
            </div>
          </div>
        )}
        {/* Upload to Course input fields */}
        {task === 'upload' && (
          <div className="flex flex-col gap-2 mb-2">
            <label className="font-medium">Video Item Base Name</label>
            <Input
              value={videoItemBaseName}
              onChange={e => setVideoItemBaseName(e.target.value)}
              placeholder="video_item"
              className="w-full"
            />
            <label className="font-medium">Quiz Item Base Name</label>
            <Input
              value={quizItemBaseName}
              onChange={e => setQuizItemBaseName(e.target.value)}
              placeholder="quiz_item"
              className="w-full"
            />
            <label className="font-medium">Questions Per Quiz</label>
            <Input
              type="number"
              min={1}
              value={questionsPerQuiz}
              onChange={e => setQuestionsPerQuiz(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              setQuestionGenParams(localParams);
              setSegParams(localSegParams);
              if (task === 'upload') {
                // Use values from store and input fields
                if (!aiJobId) return;
                if (!currentCourse?.courseId || !currentCourse?.versionId || !currentCourse?.moduleId || !currentCourse?.sectionId) {
                  toast.error('Missing course/module/section info');
                  return;
                }
                const params = {
                  courseId: currentCourse.courseId,
                  versionId: currentCourse.versionId,
                  moduleId: currentCourse.moduleId,
                  sectionId: currentCourse.sectionId,
                  videoItemBaseName,
                  quizItemBaseName,
                  questionsPerQuiz,
                };
                setTaskRuns(prev => ({ ...prev, upload: [...prev.upload, { id: `run-${Date.now()}-${Math.random()}`, timestamp: new Date(), status: 'loading', parameters: params }] }));
                try {
                  await aiSectionAPI.postJobTask(aiJobId, 'UPLOAD_CONTENT', params);
                  setTaskRuns(prev => ({ ...prev, upload: prev.upload.map(run => run.status === 'loading' ? { ...run, status: 'done' } : run) }));
                  toast.success('Section successfully uploaded to course!');
                } catch (error) {
                  setTaskRuns(prev => ({ ...prev, upload: prev.upload.map(run => run.status === 'loading' ? { ...run, status: 'failed' } : run) }));
                  toast.error('Upload to course failed.');
                }
                return;
              }
              if (runs.some(r => r.status === 'stopped')) {
                if (!aiJobId) {
                  toast.error("No AI job ID available");
                  return;
                }
                const runId = `run-${Date.now()}-${Math.random()}`;
                const newRun: TaskRun = {
                  id: runId,
                  timestamp: new Date(),
                  status: "loading",
                  parameters: task === "segmentation" ? { ...localSegParams } : task === "question" ? { ...localParams } : task === "transcription" ? { ...rerunParams } : undefined,
                };
                setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
                try {
                  let taskType: string;
                  switch (task) {
                    case "transcription":
                      taskType = "AUDIO_EXTRACTION";
                      break;
                    case "segmentation":
                      taskType = "SEGMENTATION";
                      break;
                    case "question":
                      taskType = "QUESTION_GENERATION";
                      break;
                    case "upload":
                      taskType = "UPLOAD_CONTENT";
                      break;
                    default:
                      throw new Error(`Unsupported task type: ${task}`);
                  }
                  const response = await aiSectionAPI.rerunJobTask(aiJobId, taskType, newRun.parameters);
                  if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                  }
                  toast.success(`${title} restarted. Click Refresh to check status.`);
                  await handleRefreshStatus();
                } catch (error) {
                  setTaskRuns(prev => ({
                    ...prev,
                    [task]: prev[task].map(run => run.id === runId ? { ...run, status: "failed" } : run),
                  }));
                  toast.error(`Failed to restart ${title}: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
                return;
              }
              handleTask(task, localSegParams, localParams);
            }}
            disabled={!canRunTask(task) || runs.some(r => r.status === "loading")}
            className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
          >
            {runs.some(r => r.status === 'stopped') ? `Restart ${title}` : title}
          </Button>
          
          {aiJobId && (
            runs.some(r => r.status === "loading") || 
            runs.some(r => r.status === "stopped") ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.audioExtraction === 'RUNNING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'PENDING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'WAITING')) ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'WAITING')) ||
            (task === 'segmentation' && (accordionAiJobStatus?.jobStatus?.segmentation === 'RUNNING' || accordionAiJobStatus?.jobStatus?.segmentation === 'PENDING' || accordionAiJobStatus?.jobStatus?.segmentation === 'WAITING')) ||
            (task === 'question' && (accordionAiJobStatus?.jobStatus?.questionGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'WAITING')) ||
            (task === 'upload' && (accordionAiJobStatus?.jobStatus?.uploadContent === 'RUNNING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'PENDING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'WAITING'))
          ) && (
            <Button
              onClick={() => handleStopTask(task)}
              variant="outline"
              disabled={runs.some(r => r.status === "stopped")}
              className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-4 h-4 mr-2" />
              {runs.some(r => r.status === "stopped") ? "Task Stopped" : "Stop Task"}
            </Button>
          )}
          {/* Add three input boxes for segmentation parameters beside the Segmentation button */}
          {task === 'segmentation' && (
            <div className="flex flex-row gap-3 items-center ml-4 bg-gray-100 dark:bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700">
              {segFields.map(({ key, type }) => (
                <div key={key} className="flex flex-col items-start min-w-[80px]">
                  <label
                    htmlFor={`seg-${key}`}
                    className="text-[11px] font-semibold mb-1 text-gray-700 dark:text-gray-300"
                  >
                    {key}
                  </label>
                  <input
                    id={`seg-${key}`}
                    type="text"
                    value={localSegParams[key as keyof typeof segParams]}
                    onChange={(e) => handleSegParamChange(key, type === 'float'
                      ? parseFloat(e.target.value) || 0
                      : parseInt(e.target.value) || 0)}
                    className="w-20 h-9 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    style={{ fontSize: '15px' }}
                  />
                </div>
              ))}
            </div>
          )}
          {/* Add Re-run Transcription button */}
          {task === 'transcription' && jobStatus?.task === 'TRANSCRIPT_GENERATION' && jobStatus?.status === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!aiJobId) return;
                try {
                  const params = rerunParams;
                  await aiSectionAPI.rerunJobTask(aiJobId, 'TRANSCRIPT_GENERATION', params);
                  toast.success('Transcription rerun started. Click Refresh to check status.');
                  setTaskRuns(prev => ({
                    ...prev,
                    transcription: [
                      ...prev.transcription,
                      {
                        id: `run-${Date.now()}-${Math.random()}`,
                        timestamp: new Date(),
                        status: "loading",
                        parameters: { ...params }
                      }
                    ]
                  }));
                } catch (e: any) {
                  toast.error('Failed to rerun transcription.');
                }
              }}
              disabled={runs.some(r => r.status === "loading")}
              className="flex-1"
            >
              Re-run Transcription
            </Button>
          )}
          {/* Add Re-run Question Generation button */}
          {task === 'question' && jobStatus?.task === 'QUESTION_GENERATION' && jobStatus?.status === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!aiJobId) return;
                try {
                  // Use the current values from the parameter inputs
                  // const params = questionGenParams;

                  await aiSectionAPI.rerunJobTask(aiJobId, 'QUESTION_GENERATION', localParams);
                  toast.success('Question generation rerun started. Click Refresh to check status.');
                  setTaskRuns(prev => ({
                    ...prev,
                    question: [
                      ...prev.question,
                      {
                        id: `run-${Date.now()}-${Math.random()}`,
                        timestamp: new Date(),
                        status: "loading",
                        parameters: { ...localParams }
                      }
                    ]
                  }));
                } catch (e: any) {
                  toast.error('Failed to rerun question generation.');
                }
              }}
              disabled={runs.some(r => r.status === "loading")}
              className="flex-1"
            >
              Re-run Question Generation
            </Button>
          )}

          {task === 'segmentation' && jobStatus?.task === 'SEGMENTATION' && jobStatus?.status === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!aiJobId) return;
                try {
                  // Always use the latest values from segParams for the payload

                  const params = { lam: localSegParams.lam, runs: localSegParams.runs, noiseId: localSegParams.noiseId };
                  await aiSectionAPI.rerunJobTask(aiJobId, 'SEGMENTATION', params);
                  toast.success('Segmentation rerun started. Click Refresh to check status.');
                  setTaskRuns(prev => ({
                    ...prev,
                    segmentation: [
                      ...prev.segmentation,
                      {
                        id: `run-${Date.now()}-${Math.random()}`,
                        timestamp: new Date(),
                        status: "loading",
                        parameters: { ...params }
                      }
                    ]
                  }));
                } catch (e: any) {
                  toast.error('Failed to rerun segmentation.');
                }
              }}
              disabled={runs.some(r => r.status === "loading")}
              className="flex-1"
            >
              Re-run Segmentation
            </Button>
          )}
        </div>
        {runs.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {runs.map((run: any, index) => {
              // Declare segParamsNodes for this run
              const segParamsNodes: React.ReactNode[] =
                task === "segmentation" && run.parameters
                  ? [
                    run.parameters.lam !== undefined ? (<span key="lam"><strong>Lambda:</strong> {run.parameters.lam}</span>) : undefined,
                    run.parameters.runs !== undefined ? (<span key="runs"><strong>Runs:</strong> {run.parameters.runs}</span>) : undefined,
                    run.parameters.noiseId !== undefined ? (<span key="noiseId"><strong>Noise ID:</strong> {run.parameters.noiseId}</span>) : undefined,
                  ].filter((x): x is React.ReactElement => x != null)
                  : [];
              // --- Fix for readable parameters display for question task ---
              let readableParams: React.ReactNode = null;
              if (task === "question" && run.parameters && typeof run.parameters === 'object') {
                const paramKeys = Object.keys(run.parameters);
                const mainKeys = ["model", "SQL", "SML", "NAT", "DES"];
                const promptKey = paramKeys.find(k => k.toLowerCase() === "prompt");
                readableParams = (
                  <div className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', marginBottom: '0.5rem' }}>
                      {mainKeys.map(key =>
                        key in run.parameters ? (
                          <div key={key}><strong>{key}:</strong> {run.parameters[key]}</div>
                        ) : null
                      )}
                    </div>
                    {promptKey && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <strong>prompt:</strong> {run.parameters[promptKey]}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <AccordionItem key={run.id} value={run.id} className="border rounded my-2 last:border-b">
                  <AccordionTrigger className="flex items-center gap-2 px-2 py-1">
                    <span>Run {index + 1}</span>
                    <span className="text-sm text-gray-600 dark:text-muted-foreground">{run.timestamp.toLocaleTimeString()}</span>
                    {getStatusIcon(run.status)}
                    {acceptedRunId === run.id && <span className="text-blue-500">Accepted</span>}
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-2">
                    {run.parameters && (
                      <div className="text-sm text-gray-600 dark:text-muted-foreground flex flex-wrap gap-4 mb-2">
                        {task === "segmentation" ? segParamsNodes : readableParams || (
                          <span><strong>Parameters:</strong> {JSON.stringify(run.parameters)}</span>
                        )}
                      </div>
                    )}
                    {run.status === "done" && (
                      task === "segmentation"
                        ? <>
                          <RunSegmentationSection aiJobId={aiJobId} run={run} acceptedRunId={acceptedRunId} onAccept={() => handleAcceptRun(task, run.id)} runIndex={index} />
                          <EditSegmentsModalButton aiJobId={aiJobId} run={run} runIndex={index} />
                        </>
                        : task === "question"
                          ? <RunQuestionSection aiJobId={aiJobId} run={run} acceptedRunId={acceptedRunId} onAccept={() => handleAcceptRun(task, run.id)} runIndex={index} />
                          : <RunTranscriptSection aiJobId={aiJobId} run={run} acceptedRunId={acceptedRunId} onAccept={() => handleAcceptRun(task, run.id)} runIndex={index} />
                    )}
                    {run.status === "failed" && (
                      <div className="text-sm text-red-600 dark:text-red-500">
                        This run failed. Try running the task again.
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    );
  });

  // const getDifficultyColor = (difficulty: Question['difficulty']): string => {
  //   switch (difficulty) {
  //     case 'easy': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
  //     case 'medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
  //     case 'hard': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
  //     default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
  //   }
  // };

  // const getQuestionTypeColor = (type: QuestionType): string => {
  //   switch (type) {
  //     case 'SELECT_ONE_IN_LOT': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
  //     case 'SELECT_MANY_IN_LOT': return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20';
  //     case 'ORDER_THE_LOTS': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
  //     case 'NUMERIC_ANSWER_TYPE': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
  //     case 'DESCRIPTIVE': return 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20';
  //     default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
  //   }
  // };

  // const getQuestionTypeLabel = (type: QuestionType): string => {
  //   switch (type) {
  //     case 'SELECT_ONE_IN_LOT': return 'Single Select';
  //     case 'SELECT_MANY_IN_LOT': return 'Multiple Select';
  //     case 'ORDER_THE_LOTS': return 'Drag & Drop';
  //     case 'NUMERIC_ANSWER_TYPE': return 'Numeric';
  //     case 'DESCRIPTIVE': return 'Descriptive';
  //     default: return 'Question';
  //   }
  // };

  // const handleEditClick = (segmentId: string, question: Question) => {
  //   setEditingQuestion({ segmentId, questionId: question.id });
  //   setEditedQuestion({ ...question });
  // };

  // const handleSaveEdit = (segmentId: string, questionId: string) => {
  //   setVideoDataState(prev => {
  //     if (!prev) return prev;
  //     const newSegments = prev.segments.map(segment => {
  //       if (segment.id !== segmentId) return segment;
  //       return {
  //         ...segment,
  //         questions: segment.questions.map(q =>
  //           q.id === questionId ? { ...q, ...editedQuestion } as Question : q
  //         ),
  //       };
  //     });
  //     return { ...prev, segments: newSegments } as VideoData;
  //   });
  //   setEditingQuestion(null);
  //   setEditedQuestion({});
  //   toast.success("Question updated successfully!");
  // };

  // const handleCancelEdit = () => {
  //   setEditingQuestion(null);
  //   setEditedQuestion({});
  // };

  // const handleAddOption = () => {
  //   setEditedQuestion(prev => ({
  //     ...prev,
  //     options: [...(prev.options || []), `Option ${(prev.options?.length || 0) + 1}`]
  //   }));
  // };
  // 
  // const handleRemoveOption = (index: number) => {
  //   setEditedQuestion(prev => ({
  //     ...prev,
  //     options: prev.options?.filter((_, i) => i !== index)
  //   }));
  // };

  // Question Edit Form Component
  const QuestionEditForm = ({ question, onSave, onCancel }: {
    question: any;
    onSave: (edited: any) => void;
    onCancel: () => void;
  }) => {


    // Normalize question object to handle both flat and nested (with .question and .solution)
    const typeMap: Record<string, string> = {
      SOL: 'SELECT_ONE_IN_LOT',
      MUL: 'SELECT_MANY_IN_LOT',
      // Add more mappings if needed
    };

    const normalized = React.useMemo(() => {
      if ('question' in question && typeof question.question === 'object') {
        const mappedType = typeMap[question.question.type] || question.question.type;
        return {
          ...question.question,
          type: mappedType,
          solution: question.solution,
        };
      }
      // If already flat, also map type
      return {
        ...question,
        type: typeMap[question.type] || question.type,
      };
    }, [question]);

    const initialOptions = React.useMemo(() => {
      if (normalized.solution) {
        // Handle both correctLotItem (single correct) and correctLotItems (multiple correct)
        const correct = normalized.solution.correctLotItems
          ? normalized.solution.correctLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: true }))
          : normalized.solution.correctLotItem
            ? [{ text: normalized.solution.correctLotItem.text, explaination: normalized.solution.correctLotItem.explaination, correct: true }]
            : [];
        const incorrect = normalized.solution.incorrectLotItems
          ? normalized.solution.incorrectLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: false }))
          : [];
        // Combine (correct first, then incorrect)
        return [...correct, ...incorrect];
      }
      // fallback: if options array exists (for generated questions)
      if (Array.isArray(normalized.options)) {
        let correctIndices: number[] = [];
        if (normalized.type === 'SELECT_ONE_IN_LOT' && typeof normalized.correctAnswer === 'number') {
          correctIndices = [normalized.correctAnswer];
        } else if (normalized.type === 'SELECT_MANY_IN_LOT' && Array.isArray(normalized.correctAnswer)) {
          correctIndices = normalized.correctAnswer;
        }
        return normalized.options.map((opt: string, idx: number) => ({
          text: opt,
          explaination: '',
          correct: correctIndices.includes(idx),
        }));
      }
      return [];
    }, [normalized]);

    const [questionText, setQuestionText] = React.useState(normalized.text || normalized.question || '');
    const [options, setOptions] = React.useState(initialOptions);

    // Sync state with normalized question
    React.useEffect(() => {
      setQuestionText(normalized.text || normalized.question || '');
      setOptions(initialOptions);
    }, [normalized, initialOptions]);

    const handleOptionText = (idx: number, value: string) => setOptions((opts: any[]) => opts.map((o, i) => i === idx ? { ...o, text: value } : o));
    const handleOptionExplain = (idx: number, value: string) => setOptions((opts: any[]) => opts.map((o, i) => i === idx ? { ...o, explaination: value } : o));
    const handleCorrect = (idx: number, checked: boolean) => {
      setOptions((opts: any[]) => opts.map((o, i) =>
        normalized.type === 'SELECT_ONE_IN_LOT'
          ? { ...o, correct: i === idx }
          : i === idx ? { ...o, correct: checked } : o
      ));
    };
    const handleAddOption = () => setOptions((opts: any[]) => [...opts, { text: '', explaination: '', correct: false }]);
    const handleRemoveOption = (idx: number) => setOptions((opts: any[]) => opts.filter((_, i) => i !== idx));

    const canSave = questionText.trim() && options.length >= 2 && options.every((o: any) => o.text.trim() && o.explaination.trim()) && options.some((o: any) => o.correct);

    const buildSolution = () => {
      const correctOpts = options.filter((o: any) => o.correct).map((o: any) => ({ text: o.text, explaination: o.explaination }));
      const incorrectOpts = options.filter((o: any) => !o.correct).map((o: any) => ({ text: o.text, explaination: o.explaination }));
      if (normalized.type === 'SELECT_ONE_IN_LOT') {
        return {
          correctLotItem: correctOpts[0] || { text: '', explaination: '' },
          incorrectLotItems: incorrectOpts,
        };
      } else if (normalized.type === 'SELECT_MANY_IN_LOT') {
        return {
          correctLotItems: correctOpts,
          incorrectLotItems: incorrectOpts,
        };
      }
      return undefined;
    };

    return (
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <Label htmlFor="question-text">Question Text</Label>
          <Textarea
            id="question-text"
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="Enter question text"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Options</Label>
          <div className="space-y-2 mt-2 max-h-[50vh] overflow-y-auto pr-2">
            {options.map((option: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-1 border rounded p-2 bg-background">
                <div className="flex items-center gap-2">
                  {normalized.type === 'SELECT_ONE_IN_LOT' ? (
                    <input type="radio" checked={option.correct} onChange={() => handleCorrect(idx, true)} />
                  ) : (
                    <input type="checkbox" checked={option.correct} onChange={e => handleCorrect(idx, e.target.checked)} />
                  )}
                  <Input
                    value={option.text}
                    onChange={e => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(idx)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Textarea
                  value={option.explaination}
                  onChange={e => handleOptionExplain(idx, e.target.value)}
                  placeholder="Explanation for this option (why correct/incorrect)"
                  className="mt-1"
                  rows={2}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddOption} className="w-full"><Plus className="h-4 w-4 mr-2" />Add Option</Button>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button onClick={() => {
            const solution = buildSolution();
            onSave({ text: questionText, solution });
          }} className="flex-1" disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  // Track previous job status for transition detection
  const prevJobStatusRef = useRef<any>(null);
  // Track if this is the first status fetch after mount
  const didMountRef = useRef(false);
  // Track an optimistic failed task for stepper (e.g., after Stop)
  const optimisticFailedTaskRef = useRef<string | null>(null);

  // New: Manual refresh handler
  const handleRefreshStatus = async () => {
    if (!aiJobId) return;
    try {
      // const status = await aiSectionAPI.getJobStatus(aiJobId);
      // setAiJobStatus(status);
      const status: any = aiJobStatus;
      console.log(aiJobStatus)
      const prevJobStatus = prevJobStatusRef.current;
      // Only show toast if transitioning to COMPLETED and not on first mount
      if (
        didMountRef.current &&
        status?.task === 'AUDIO_EXTRACTION' && status?.status === 'COMPLETED'
      ) {
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.transcription].reverse().findIndex(run => run.status === 'loading');
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
      if (
        didMountRef.current &&
        status?.task === 'SEGMENTATION' && status?.status === 'COMPLETED'
      ) {
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.segmentation].reverse().findIndex(run => run.status === 'loading');
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
      if (
        didMountRef.current &&
        status?.task === 'QUESTION_GENERATION' && status?.status === 'COMPLETED'
      ) {
        // Fetch QUESTION_GENERATION task status for fileUrl
        const token = localStorage.getItem('firebase-auth-token');
        const backendUrl = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
        let res = await fetch(backendUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          res = await fetch(backendUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        }
        if (res.ok) {
          const arr = await res.json();
          setTaskRuns(prev => {
            const lastLoadingIdx = [...prev.question].reverse().findIndex(run => run.status === 'loading');
            const lastDoneIdx = [...prev.question].reverse().findIndex(run => run.status === 'done');
            let idxToUpdate = lastLoadingIdx !== -1 ? prev.question.length - 1 - lastLoadingIdx : (lastDoneIdx !== -1 ? prev.question.length - 1 - lastDoneIdx : -1);
            if (idxToUpdate === -1) return prev;
            return {
              ...prev,
              question: prev.question.map((run, idx) => {
                if (idx === idxToUpdate) {
                  const { id, timestamp, result, parameters } = run;
                  return { id, timestamp, status: 'done', result: { ...result, questionTaskStatus: arr }, parameters } as TaskRun;
                }
                return run;
              }),
            };
          });
          toast.success('Questions generated!');
        }
      }
      // Always update previous job status at the end
      prevJobStatusRef.current = status?.status;
      // Mark didMount after first fetch
      if (!didMountRef.current) didMountRef.current = true;
      if (status?.task === 'TRANSCRIPT_GENERATION' && status?.status === 'COMPLETED') {
        setAiWorkflowStep('transcription_done');
        return;
      }
      if (status?.task === 'AUDIO_EXTRACTION' && status?.status === 'COMPLETED') {
        setAiWorkflowStep('audio_extraction_done');
        return;
      }
      if ((status?.task === 'AUDIO_EXTRACTION' && status?.status === 'FAILED') || (status?.task === 'TRANSCRIPT_GENERATION' && status?.status === 'FAILED')) {
        setAiWorkflowStep('error');
        toast.error('A step failed.');
        return;
      }
      if ((status?.task === 'AUDIO_EXTRACTION' && status?.status === 'STOPPED') || (status?.task === 'TRANSCRIPT_GENERATION' && status?.status === 'STOPPED')) {
        setAiWorkflowStep('idle');
        toast.info('A step was stopped. You can restart it.');
        return;
      }
    } catch (error) {
      setAiWorkflowStep('error');
      toast.error('Failed to refresh status.');
    }
  };

  const handleStopTask: (task?: keyof typeof taskRuns) => Promise<void> = async (task?) => {
    if (!aiJobId) return;
    if (!aiSectionAPI.stopJobTask) {
      toast.error('Stop task functionality not available');
      return;
    }
    try {
      const response: any = await aiSectionAPI.stopJobTask(aiJobId);
      if (response?.ok) {
        toast.success('Stopped task successfully.');
      } else {
        toast.error('Failed to stop task.');
      }
    } catch (error) {
      setAiWorkflowStep('error');
      toast.error('Failed to stop task.');
    } finally {
      const createStoppedRun = (): TaskRun => ({ id: `run-${Date.now()}-${Math.random()}`, timestamp: new Date(), status: 'stopped' });
      if (task) {
        setTaskRuns(prev => {
          const runs = prev[task];
          const hasLoading = runs.some(r => r.status === 'loading');
          const updated = hasLoading
            ? runs.map(r => (r.status === 'loading' ? { ...r, status: 'stopped' } : r))
            : [...runs, createStoppedRun()];
          return { ...prev, [task]: updated } as TaskRuns;
        });
      } else {
        setTaskRuns(prev => ({
          ...prev,
          transcription: prev.transcription.some(r => r.status === 'loading')
            ? prev.transcription.map(r => (r.status === 'loading' ? { ...r, status: 'stopped' } : r))
            : [...prev.transcription, createStoppedRun()],
          segmentation: prev.segmentation.some(r => r.status === 'loading')
            ? prev.segmentation.map(r => (r.status === 'loading' ? { ...r, status: 'stopped' } : r))
            : [...prev.segmentation, createStoppedRun()],
          question: prev.question.some(r => r.status === 'loading')
            ? prev.question.map(r => (r.status === 'loading' ? { ...r, status: 'stopped' } : r))
            : [...prev.question, createStoppedRun()],
          upload: prev.upload.some(r => r.status === 'loading')
            ? prev.upload.map(r => (r.status === 'loading' ? { ...r, status: 'stopped' } : r))
            : [...prev.upload, createStoppedRun()],
        }));
      }

      setAiJobStatus(prev => {
        if (!prev) return prev;
        const next = { ...prev } as any;
        const setTop = (taskStr: string) => {
          next.task = taskStr;
          next.status = 'STOPPED';
        };
        const ensureJobStatus = () => { next.jobStatus = { ...(next.jobStatus || {}) }; };
        const isActive = (v?: string) => v === 'RUNNING' || v === 'PENDING' || v === 'WAITING';
        if (task === 'transcription') {
          let stoppingTask = next.task;
          if (stoppingTask !== 'AUDIO_EXTRACTION' && stoppingTask !== 'TRANSCRIPT_GENERATION') {
            const js = next.jobStatus || {};
            if (isActive(js?.transcriptGeneration)) stoppingTask = 'TRANSCRIPT_GENERATION';
            else if (isActive(js?.audioExtraction)) stoppingTask = 'AUDIO_EXTRACTION';
            else stoppingTask = 'TRANSCRIPT_GENERATION';
          }
          setTop(stoppingTask);
          ensureJobStatus();
          if (stoppingTask === 'TRANSCRIPT_GENERATION') next.jobStatus.transcriptGeneration = 'STOPPED';
          if (stoppingTask === 'AUDIO_EXTRACTION') next.jobStatus.audioExtraction = 'STOPPED';
          optimisticFailedTaskRef.current = null;
          return next;
        }
        if (task === 'segmentation') {
          setTop('SEGMENTATION');
          ensureJobStatus();
          next.jobStatus.segmentation = 'STOPPED';
          optimisticFailedTaskRef.current = null;
          return next;
        }
        if (task === 'question') {
          setTop('QUESTION_GENERATION');
          ensureJobStatus();
          next.jobStatus.questionGeneration = 'STOPPED';
          optimisticFailedTaskRef.current = null;
          return next;
        }
        if (task === 'upload') {
          setTop('UPLOAD_CONTENT');
          ensureJobStatus();
          next.jobStatus.uploadContent = 'STOPPED';
          optimisticFailedTaskRef.current = null;
          return next;
        }
        setTop(next.task);
        optimisticFailedTaskRef.current = null;
        return next;
      });
      await handleRefreshStatus();
    }
  };

  useEffect(() => {
    if (!aiJobId) return;

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
        return next;
      });
    });
    return () => es.close();

  }, [aiJobId]);

  useEffect(() => {
    if (!aiJobStatus) return;

    handleRefreshStatus();
  }, [aiJobStatus])

  // New: Manual trigger for transcript generation
  const handleStartTranscription = async () => {
    if (!aiJobId) return;
    try {
      let status = await aiSectionAPI.getJobStatus(aiJobId);
      if (status.jobStatus?.transcriptGeneration === 'PENDING') {
        await aiSectionAPI.approveContinueTask(aiJobId);
        toast.success('Approved transcript task.');
        // Immediately check status and start if now WAITING
        status = await aiSectionAPI.getJobStatus(aiJobId);
        if (status.jobStatus?.transcriptGeneration === 'WAITING') {
          await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION');
          setAiWorkflowStep('transcription');
          toast.success('Transcript generation started. Click Refresh to check status.');
          await handleRefreshStatus();
        } else {
          toast.info('Transcript generation is not ready to start yet.');
        }
      } else if (status.jobStatus?.transcriptGeneration === 'WAITING') {
        await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION');
        setAiWorkflowStep('transcription');
        toast.success('Transcript generation started. Click Refresh to check status.');
        await handleRefreshStatus();
      } else {
        toast.info('Transcript generation is not ready to start.');
      }
    } catch (error) {
      setAiWorkflowStep('error');
      toast.error('Failed to start transcript generation.');
      await handleRefreshStatus();
    }
  };

  // Helper to fetch transcript file from fileUrl
  const fetchTranscriptFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch transcript file');
    const data = await response.json();
    if (Array.isArray(data.chunks)) {
      // Join all text chunks for display
      return data.chunks.map((chunk: { text: string }) => chunk.text).join('\n');
    }
    // Fallback to raw JSON
    return JSON.stringify(data, null, 2);
  };

  // Helper to fetch transcriptGeneration task status and get fileUrl
  const fetchTranscriptForRun = async (jobId: string, setTranscript: (t: string) => void, setLoading: (b: boolean) => void, setError: (e: string) => void) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('firebase-auth-token');
      const url = getApiUrl(`/genai/${jobId}/tasks/TRANSCRIPT_GENERATION/status`);
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch task status');
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0 && arr[0].fileUrl) {
        const transcript = await fetchTranscriptFromUrl(arr[0].fileUrl);
        setTranscript(transcript);
      } else {
        setError('Transcript file URL not found.');
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Helper to fetch segmentation file from fileUrl
  const fetchSegmentationFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch segmentation file');
    const data = await response.json();
    // Assume data.segments or data.chunks or similar
    if (Array.isArray(data.segments)) {
      return data.segments;
    }
    if (Array.isArray(data.chunks)) {
      // fallback for chunked format
      return data.chunks;
    }
    return data;
  };

  // Helper to fetch segmentation task status and get fileUrl
  const fetchSegmentationForRun = async (jobId: string, setSegments: (s: any[]) => void, setLoading: (b: boolean) => void, setError: (e: string) => void) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('firebase-auth-token');
      const url = getApiUrl(`/genai/${jobId}/tasks/SEGMENTATION/status`);
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch task status');
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0 && arr[0].fileUrl) {
        const segments = await fetchSegmentationFromUrl(arr[0].fileUrl);
        setSegments(segments);
      } else {
        setError('Segmentation file URL not found.');
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Component to show transcript for a run
  function RunTranscriptSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showTranscript, setShowTranscript] = useState(false);
    const [transcript, setTranscript] = useState<string>("");
    const [transcriptChunks, setTranscriptChunks] = useState<{ text: string }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editChunks, setEditChunks] = useState<{ timestamp: [number, number]; text: string }[]>([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    const handleShowTranscript = async () => {
      if (!aiJobId) return;
      if (!showTranscript) {
        setLoading(true);
        setError("");
        try {
          // Fetch transcript status as before
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/TRANSCRIPT_GENERATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > runIndex && arr[runIndex].fileUrl) {
            const transcriptRes = await fetch(arr[runIndex].fileUrl);
            if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
            const data = await transcriptRes.json();
            if (Array.isArray(data.chunks)) {
              setTranscriptChunks(data.chunks);
              setTranscript(data.chunks.map((chunk: { text: string }) => chunk.text).join(' '));
            } else {
              setTranscriptChunks(null);
              setTranscript(typeof data === 'string' ? data : JSON.stringify(data));
            }
          } else {
            setTranscriptChunks(null);
            setTranscript('Transcript file URL not found.');
          }
        } catch (e: any) {
          setTranscriptChunks(null);
          setTranscript(e.message || 'Unknown error');
        } finally {
          setLoading(false);
        }
      }
      setShowTranscript(v => !v);
    };

    // Fetch transcript chunks when modal opens
    useEffect(() => {
      if (editModalOpen && aiJobId) {
        setEditLoading(true);
        setEditError('');
        (async () => {
          try {
            const token = localStorage.getItem('firebase-auth-token');
            const url = getApiUrl(`/genai/${aiJobId}/tasks/TRANSCRIPT_GENERATION/status`);
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to fetch task status');
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > runIndex && arr[runIndex].fileUrl) {
              const transcriptRes = await fetch(arr[runIndex].fileUrl);
              if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
              const data = await transcriptRes.json();
              if (Array.isArray(data.chunks)) {
                setEditChunks(data.chunks.map((chunk: any) => ({ ...chunk })));
              } else {
                setEditError('Transcript format not recognized.');
              }
            } else {
              setEditError('Transcript file URL not found.');
            }
          } catch (e: any) {
            setEditError(e.message || 'Unknown error');
          } finally {
            setEditLoading(false);
          }
        })();
      }
    }, [editModalOpen, aiJobId, runIndex]);

    // Handler for saving edited transcript
    const handleSaveEditTranscript = async () => {
      if (!aiJobId) return;
      try {
        setEditLoading(true);
        setEditError('');
        if (typeof aiSectionAPI.editTranscriptData === 'function') {
          await aiSectionAPI.editTranscriptData(aiJobId, runIndex, { chunks: editChunks });
          toast.success('Transcript updated successfully!');
          setEditModalOpen(false);
        } else {
          setEditError('Transcript editing API not available.');
        }
      } catch (e: any) {
        setEditError(e.message || 'Failed to update transcript');
      } finally {
        setEditLoading(false);
      }
    };

    return (
      <div className="space-y-2">
        <Button size="sm" variant="secondary" onClick={handleShowTranscript} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </Button>
        {/* Edit button for transcript run */}
        <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          Edit
        </Button>
        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Transcript</DialogTitle>
            </DialogHeader>
            {editLoading && <div>Loading transcript...</div>}
            {editError && <div className="text-red-500">{editError}</div>}
            {!editLoading && !editError && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {editChunks.map((chunk, idx) => (
                  <div key={idx} className="flex flex-col gap-1 border-b pb-2">
                    <div className="text-xs text-gray-400">
                      Segment: {chunk.timestamp[0]}s - {chunk.timestamp[1]}s
                    </div>
                    <textarea
                      className="w-full p-2 rounded border"
                      value={chunk.text}
                      onChange={e => {
                        const newChunks = [...editChunks];
                        newChunks[idx].text = e.target.value;
                        setEditChunks(newChunks);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEditTranscript} disabled={editLoading}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {showTranscript && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-48 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700">
            <strong>Transcript:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && (
              <div className="mt-2 whitespace-pre-line">
                {transcriptChunks
                  ? transcriptChunks.map((chunk: { text: string }) => chunk.text).join(' ')
                  : transcript}
              </div>
            )}
          </div>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="w-full"
          >
            Accept This Run
          </Button>
        )}
      </div>
    );
  }

  // Component to show segmentation for a run
  function RunSegmentationSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showSegmentation, setShowSegmentation] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
    const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null); // array of arrays of transcript chunks per segment
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Edit modal state for segment boundaries
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSegMap, setEditSegMap] = useState<number[]>([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");
    // Add state for transcriptChunks in the edit modal
    const [editTranscriptChunks, setEditTranscriptChunks] = useState<{ timestamp: [number, number], text: string }[]>([]);

    const handleShowSegmentation = async () => {
      if (!aiJobId) return;
      if (!showSegmentation) {
        setLoading(true);
        setError("");
        try {
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/SEGMENTATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          // Use the correct run index for this run, just like transcript section
          const segArrIdx = typeof runIndex === 'number' ? runIndex : 0;
          const segData = Array.isArray(arr) && arr.length > segArrIdx ? arr[segArrIdx] : arr[0];
          if (segData && segData.segmentationMap && Array.isArray(segData.segmentationMap) && segData.transcriptFileUrl) {
            setSegmentationMap(segData.segmentationMap);
            // Fetch transcript JSON
            const transcriptRes = await fetch(segData.transcriptFileUrl);
            if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
            const transcriptData = await transcriptRes.json();
            const chunks = Array.isArray(transcriptData.chunks) ? transcriptData.chunks : [];
            // Group transcript chunks by segment
            const segMap = segData.segmentationMap;
            const grouped: any[][] = [];
            let segStart = 0;
            for (let i = 0; i < segMap.length; ++i) {
              const segEnd = segMap[i];
              // Chunks whose timestamp[0] >= segStart and < segEnd
              const segChunks = chunks.filter((chunk: { timestamp: [number, number], text: string }) =>
                chunk.timestamp &&
                typeof chunk.timestamp[0] === 'number' &&
                chunk.timestamp[0] >= segStart &&
                chunk.timestamp[0] < segEnd
              );
              grouped.push(segChunks);
              segStart = segEnd;
            }
            setSegmentationChunks(grouped);
          } else if (segData && segData.fileUrl) {
            // fallback: fetch segments from fileUrl as before
            const segs = await fetchSegmentationFromUrl(segData.fileUrl);
            setSegments(segs);
            setSegmentationMap(null);
            setSegmentationChunks(null);
          } else {
            setError('Segmentation data not found.');
            setSegmentationChunks(null);
          }
        } catch (e: any) {
          setError(e.message || 'Unknown error');
          setSegmentationChunks(null);
        } finally {
          setLoading(false);
        }
      }
      setShowSegmentation(v => !v);
    };

    // Edit modal logic
    const handleOpenEditModal = async () => {
      if (!aiJobId) return;
      setEditLoading(true);
      setEditError("");
      setEditModalOpen(true);
      try {
        const token = localStorage.getItem('firebase-auth-token');
        const url = getApiUrl(`/genai/${aiJobId}/tasks/SEGMENTATION/status`);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to fetch segmentation status');
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length > 0 && arr[0].segmentationMap && arr[0].transcriptFileUrl) {
          setEditSegMap([...arr[0].segmentationMap]);
          // Fetch transcript chunks
          const transcriptRes = await fetch(arr[0].transcriptFileUrl);
          if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
          const transcriptData = await transcriptRes.json();
          setEditTranscriptChunks(Array.isArray(transcriptData.chunks) ? transcriptData.chunks : []);
        } else {
          setEditError('Segmentation map or transcript not found.');
          setEditSegMap([]);
          setEditTranscriptChunks([]);
        }
      } catch (e: any) {
        setEditError(e.message || 'Unknown error');
        setEditSegMap([]);
        setEditTranscriptChunks([]);
      } finally {
        setEditLoading(false);
      }
    };

    const handleEditSegChange = (idx: number, value: string) => {
      const newMap = [...editSegMap];
      newMap[idx] = parseFloat(value);
      setEditSegMap(newMap);
    };
    const handleAddSeg = () => {
      const newMap = [...editSegMap];
      const prev = newMap.length === 0 ? 0 : newMap[newMap.length - 1];
      newMap.push(prev + 10);
      setEditSegMap(newMap);
    };
    const handleRemoveSeg = (idx: number) => {
      if (editSegMap.length <= 1) return;
      const newMap = [...editSegMap];
      newMap.splice(idx, 1);
      setEditSegMap(newMap);
    };
    const handleSaveEditSeg = async () => {
      if (!aiJobId) return;
      setEditLoading(true);
      setEditError("");
      try {
        // Use index 0 for the backend (fixes 500 error)
        await editSegmentMap(aiJobId, editSegMap, 0);
        toast.success('Segment map updated successfully!');
        setEditModalOpen(false);
      } catch (e: any) {
        setEditError(e.message || 'Failed to update segment map');
      } finally {
        setEditLoading(false);
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShowSegmentation}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            {showSegmentation ? 'Hide Segmentation' : 'Show Segmentation'}
          </Button>
          {/* Edit button for segmentation run */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            Edit
          </Button>
        </div>
        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Segments</DialogTitle>
            </DialogHeader>
            {editLoading && <div>Loading segmentation map...</div>}
            {editError && <div className="text-red-500">{editError}</div>}
            {!editLoading && !editError && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {editSegMap.map((value, idx) => {
                  const start = idx === 0 ? 0 : editSegMap[idx - 1];
                  const end = value;
                  const segChunks = editTranscriptChunks.filter(chunk =>
                    chunk.timestamp &&
                    typeof chunk.timestamp[0] === 'number' &&
                    chunk.timestamp[0] >= start &&
                    chunk.timestamp[0] < end
                  );
                  const segText = segChunks.map(chunk => chunk.text).join(' ');
                  return (
                    <div key={idx} className="flex flex-col gap-1 border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Segment {idx + 1} end:</span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={value}
                          onChange={e => handleEditSegChange(idx, e.target.value)}
                          className="w-24"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSeg(idx)}
                          className="text-destructive hover:text-destructive"
                          disabled={editSegMap.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded p-2 mt-1">
                        {segText}
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={handleAddSeg} className="w-full"><Plus className="h-4 w-4 mr-2" />Add Segment</Button>
              </div>
            )}
            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditSeg}
                disabled={editLoading}
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {showSegmentation && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700 mt-2">
            <strong>Segments:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {/* Enhanced display: segmentationMap + transcript chunks */}
            {!loading && !error && segmentationMap && segmentationMap.length > 0 && segmentationChunks && (
              <ol className="mt-2 space-y-4">
                {segmentationMap.map((end, idx) => {
                  const start = idx === 0 ? 0 : segmentationMap[idx - 1];
                  const segChunks = segmentationChunks[idx] || [];
                  return (
                    <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-2">
                      <div><b>Segment {idx + 1}:</b> {start.toFixed(2)}s – {end.toFixed(2)}s</div>
                      {segChunks.length > 0 ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {(segChunks as { text: string }[]).map((chunk: { text: string }) => chunk.text).join(' ')}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
            {/* Fallback: old display if no segmentationMap+chunks */}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0 || !segmentationChunks) && segments.length > 0 && (
              <ol className="mt-2 space-y-2">
                {segments.map((seg, idx) => (
                  <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-1">
                    <div><b>Segment {idx + 1}</b> ({seg.startTime ?? seg.timestamp?.[0]}s - {seg.endTime ?? seg.timestamp?.[1]}s)</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">{seg.text}</div>
                  </li>
                ))}
              </ol>
            )}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0) && segments.length === 0 && <div className="mt-2">No segments found.</div>}
          </div>
        )}
        {run.status === 'done' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full mt-2 bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          >
            Edit Segments
          </Button>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          >
            Accept This Run
          </Button>
        )}
      </div>
    );
  }


  // When triggering question generation, use the accepted segmentation run index
  const handleStartQuestionGeneration = async () => {
    if (!aiJobId) return;
    // Find the accepted segmentation run index and ensure it is completed
    const acceptedSegmentationId = acceptedRuns.segmentation;
    let valid = false;
    if (acceptedSegmentationId) {
      const idx = taskRuns.segmentation.findIndex(run => run.id === acceptedSegmentationId);
      if (idx !== -1) {
        const run = taskRuns.segmentation[idx];
        if (run.status === 'done') {
          valid = true;
        }
      }
    }
    if (!valid) {
      toast.error('Please accept a completed segmentation run before generating questions.');
      return;
    }
    try {
      const hasQuestionRun = taskRuns.question && taskRuns.question.length > 0;
      const params = {
        model: questionGenParams.model,
        SQL: Number(questionGenParams.SQL),
        SML: Number(questionGenParams.SML),
        NAT: Number(questionGenParams.NAT),
        DES: Number(questionGenParams.DES),
        prompt: questionGenParams.prompt
      };
      if (hasQuestionRun) {
        // Rerun logic
        await aiSectionAPI.rerunJobTask(aiJobId, 'QUESTION_GENERATION', params);
        toast.success('Question generation rerun started. Click Refresh to check status.');
      } else {
        // First run logic
        await aiSectionAPI.approveStartTask(aiJobId, {
          type: 'QUESTION_GENERATION',
          parameters: params
        });
        toast.success('Question generation started. Click Refresh to check status.');
      }
      setTaskRuns(prev => ({
        ...prev,
        question: [
          ...prev.question,
          {
            id: `run-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            status: "loading",
            parameters: { ...questionGenParams }
          }
        ]
      }));
    } catch (e: any) {
      toast.error('Failed to start question generation.');
    }
  };

  // Component to show questions for a question generation run
  function RunQuestionSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showQuestions, setShowQuestions] = useState(false);
    const [questionsByRun, setQuestionsByRun] = useState<{ [runId: string]: any[] }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editQuestion, setEditQuestion] = useState<any>(null);

    // Clear cached questions when run.result or run.status changes (e.g., after refresh)
    useEffect(() => {
      setQuestionsByRun(prev => {
        if (prev[run.id]) {
          const newObj = { ...prev };
          delete newObj[run.id];
          return newObj;
        }
        return prev;
      });
    }, [run.result, run.status, run.id]);

    const questions = questionsByRun[run.id] || [];

    const handleShowQuestions = async () => {
      if (!aiJobId) return;
      if (!showQuestions && !questionsByRun[run.id]) {
        setLoading(true);
        setError("");
        try {
          // Fetch question generation status for this run
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          // Use runIndex if available, else fallback to 0
          const idx = typeof runIndex === 'number' ? runIndex : 0;
          if (Array.isArray(arr) && arr.length > idx && arr[idx]?.fileUrl) {
            const questionsRes = await fetch(arr[idx].fileUrl);
            if (!questionsRes.ok) throw new Error('Failed to fetch questions file');
            const data = await questionsRes.json();
            let questionsArr = [];
            if (Array.isArray(data)) {
              questionsArr = data.filter((q: any) => typeof q === 'object' && q !== null && q.question);
            } else if (data.segments && Array.isArray(data.segments)) {
              questionsArr = data.segments;
            } else {
              setError('Questions format not recognized.');
            }
            setQuestionsByRun(prev => ({ ...prev, [run.id]: questionsArr }));
          } else {
            setQuestionsByRun(prev => ({ ...prev, [run.id]: [] }));
            setError('Questions file URL not found.');
          }
        } catch (e: any) {
          setQuestionsByRun(prev => ({ ...prev, [run.id]: [] }));
          setError(e.message || 'Unknown error');
        } finally {
          setLoading(false);
        }
      }
      setShowQuestions(v => !v);
    };

    if (run.status !== 'done') {
      return <div className="flex items-center gap-2 text-blue-400"><Loader2 className="animate-spin" /> Generating questions...</div>;
    }

    const segmentIds = Array.from(new Set(questions.map((q: any) => q.segmentId).filter((sid: any) => typeof sid === 'number'))).sort((a, b) => a - b);

    return (
      <div className="space-y-2">
        <Button size="sm" variant="secondary" onClick={handleShowQuestions} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showQuestions ? 'Hide Questions' : 'Show Questions'}
        </Button>
        {/* Export PDF Button: appears below Show Questions, opens print-friendly HTML in new tab */}
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          onClick={async () => {
            if (!aiJobId) return;
            try {
              // Fetch question generation status for this run
              const token = localStorage.getItem('firebase-auth-token');
              const url = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
              const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
              if (!res.ok) throw new Error('Failed to fetch task status');
              const arr = await res.json();
              const idx = typeof runIndex === 'number' ? runIndex : 0;
              if (Array.isArray(arr) && arr.length > idx && arr[idx]?.fileUrl) {
                // Fetch the JSON content
                const questionsRes = await fetch(arr[idx].fileUrl);
                if (!questionsRes.ok) throw new Error('Failed to fetch questions file');
                const data = await questionsRes.json();
                let questionsArr = [];
                if (Array.isArray(data)) {
                  questionsArr = data.filter((q: any) => typeof q === 'object' && q !== null && q.question);
                } else if (data.segments && Array.isArray(data.segments)) {
                  questionsArr = data.segments.flatMap((seg: any) => seg.questions || []);
                } else {
                  toast.error('Questions format not recognized.');
                  return;
                }
                if (!questionsArr.length) {
                  toast.error('No questions found to export.');
                  return;
                }
                // Build HTML with ViBe logo and gradient heading
                let html = `<html><head><title>ViBe</title><style>
                  body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; }
                  .vibe-header { text-align: center; margin-top: 24px; margin-bottom: 18px; }
                  .vibe-logo { width: 48px; height: 48px; border-radius: 10px; box-shadow: 0 2px 8px #0002; margin-bottom: 8px; background: #fff; border: 1.5px solid #c084fc; object-fit: contain; display: block; margin-left: auto; margin-right: auto; }
                  .vibe-title { font-size: 1.2em; font-weight: 600; letter-spacing: 0.5px; margin-top: 6px; }
                  .vibe-vibe {
                    font-weight: bold;
                    background: linear-gradient(90deg, #c084fc 0%, #fca4a6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    color: transparent;
                  }
                  @media print {
                    .vibe-vibe {
                      background: none !important;
                      -webkit-background-clip: initial !important;
                      -webkit-text-fill-color: initial !important;
                      background-clip: initial !important;
                      color: #c084fc !important;
                    }
                  }
                  .question-block { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; margin: 18px auto; padding: 18px 24px; max-width: 700px; }
                  .question-title { font-weight: bold; font-size: 1.1em; margin-bottom: 8px; }
                  .option { margin-left: 24px; margin-bottom: 2px; }
                  .option.correct { color: #218838; font-weight: bold; }
                  .option.incorrect { color: #c82333; }
                  .hint { margin-left: 24px; color: #0056b3; font-style: italic; margin-top: 4px; }
                  .answer-label { font-weight: bold; color: #218838; }
                </style></head><body>`;
                html += `<div class='vibe-header'>
                  <img src='/img/vibe_logo_img.ico' class='vibe-logo' alt='ViBe Logo' />
                  <div class='vibe-title'>Generated Questions with <span class='vibe-vibe'>ViBe</span></div>
                </div>`;
                questionsArr.forEach((q: any, i: number) => {
                  html += `<div class='question-block'><div class='question-title'>${i + 1}. ${q.question?.text || q.question || ''}</div>`;
                  // Gather options and mark correct/incorrect
                  let options: { text: string, correct: boolean }[] = [];
                  // For new format (solution.correctLotItem/correctLotItems/incorrectLotItems)
                  if (q.solution) {
                    if (Array.isArray(q.solution.correctLotItems)) {
                      options = options.concat(q.solution.correctLotItems.map((o: any) => ({ text: o.text, correct: true })));
                    }
                    if (q.solution.correctLotItem) {
                      options.push({ text: q.solution.correctLotItem.text, correct: true });
                    }
                    if (Array.isArray(q.solution.incorrectLotItems)) {
                      options = options.concat(q.solution.incorrectLotItems.map((o: any) => ({ text: o.text, correct: false })));
                    }
                  }
                  // Fallback to question.options if no solution
                  if ((!options.length) && (q.question?.options || q.options)) {
                    const opts = q.question?.options || q.options || [];
                    // Try to infer correct answer index/indices
                    let correctIndices: number[] = [];
                    if (typeof q.question?.correctAnswer === 'number') correctIndices = [q.question.correctAnswer];
                    else if (Array.isArray(q.question?.correctAnswer)) correctIndices = q.question.correctAnswer;
                    else if (typeof q.correctAnswer === 'number') correctIndices = [q.correctAnswer];
                    else if (Array.isArray(q.correctAnswer)) correctIndices = q.correctAnswer;
                    options = opts.map((text: string, idx: number) => ({ text, correct: correctIndices.includes(idx) }));
                  }
                  // Render options
                  if (options.length) {
                    options.forEach((opt, j) => {
                      html += `<div class='option ${opt.correct ? 'correct' : 'incorrect'}'>${String.fromCharCode(65 + j)}. ${opt.text}</div>`;
                    });
                  }
                  // Hint
                  if (q.question?.hint || q.hint) {
                    html += `<div class='hint'><b>Hint:</b> ${q.question?.hint || q.hint}</div>`;
                  }
                  html += `</div>`;
                });
                html += `</body></html>`;
                // Open new window and print
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => {
                    printWindow.print();
                  }, 500);
                }
              } else {
                toast.error('Questions file URL not found for this run.');
              }
            } catch (e: any) {
              toast.error(e.message || 'Failed to export PDF');
            }
          }}
        >
          Export PDF
        </Button>
        {showQuestions && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700 mt-2">
            <strong>Questions:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && questions.length > 0 && (
              <ol className="mt-2 space-y-4">
                {questions.map((q: any, idx: number) => {
                  let segIdx = segmentIds.findIndex((sid: any) => sid === q.segmentId);
                  let segStart = segIdx === 0 ? 0 : segmentIds[segIdx - 1];
                  let segEnd = q.segmentId;
                  return (
                    <li key={q.question?.text || idx} className="border-b border-gray-300 dark:border-gray-700 pb-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Segment: {typeof segStart === 'number' && typeof segEnd === 'number' ? `${segStart}–${segEnd}s` : 'N/A'} | Type: {q.questionType || q.question?.type || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold flex-1">Q{idx + 1}: {q.question?.text}</div>
                        <Button size="sm" variant="outline" onClick={() => { setEditingIdx(idx); setEditQuestion(JSON.parse(JSON.stringify(q))); setEditModalOpen(true); }}>
                          <Edit className="w-4 h-4" /> Edit
                        </Button>
                      </div>
                      {q.question?.hint && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hint: {q.question.hint}</div>}
                      {q.solution && (
                        <>
                          <div className="mt-1"><b>Options:</b></div>
                          <ul className="list-disc ml-6">
                            {q.solution.incorrectLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`inc-${oIdx}`} className="text-red-600 dark:text-red-300">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`cor-${oIdx}`} className="text-green-600 dark:text-green-400 font-semibold">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItem && (
                              <li className="text-green-600 dark:text-green-400 font-semibold">{q.solution.correctLotItem.text}</li>
                            )}
                          </ul>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!loading && !error && questions.length === 0 && <div className="mt-2">No questions found.</div>}
          </div>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="w-full"
          >
            Accept This Run
          </Button>
        )}
        {/* Edit Question Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>
            {editQuestion && (
              <QuestionEditForm
                question={editQuestion}
                onSave={async (edited) => {
                  if (!aiJobId || typeof aiSectionAPI.editQuestionData !== 'function') return;
                  try {
                    // Deep clone the original questions array
                    const originalQuestions = questionsByRun[run.id] || [];
                    const updatedQuestions = originalQuestions.map((q, idx) => {
                      if (idx !== editingIdx) return q;
                      return {
                        ...q,
                        question: {
                          ...q.question,
                          text: edited.text, // explicitly update text
                        },
                        solution: edited.solution, // replace solution entirely
                      };
                    });
                    await aiSectionAPI.editQuestionData(aiJobId, runIndex, updatedQuestions);
                    // setEditingQuestion(null);
                    setEditModalOpen(false);
                  } catch (e) {
                    toast.error('Question Updated.');
                    setEditModalOpen(false);
                  }
                }}
                onCancel={() => setEditModalOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render the AI workflow UI and the quiz question editor
  return (
    <div className="max-w-6xl w-full mx-auto px-4">
      {/* AI Section Workflow Inline */}
      <div className="bg-white dark:bg-card/50 rounded-xl shadow-lg border border-gray-200 dark:border-border p-8 mb-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3 text-primary">
            Generate Section using AI
          </h1>
          <p className="text-muted-foreground text-lg">
            Transform your YouTube content into interactive learning materials
          </p>
        </div>
        {/* Stepper */}
        <Stepper jobStatus={aiJobStatus} />
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row gap-6 items-center w-full mt-4">
            <div className="flex-1 w-full">
              <Input
                placeholder="YouTube URL"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                disabled={!!aiJobId}
                className={`flex-1 w-full ${urlError ? 'border-red-500' : ''}`}
              />
              {urlError && (
                <p className="text-red-500 text-sm mt-1">{urlError}</p>
              )}
            </div>
            <Button
              onClick={handleCreateJob}
              disabled={!youtubeUrl || !!aiJobId}
              className="w-full sm:w-auto mt-2 sm:mt-0 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
            >
              {aiJobId ? "Job Created" : "Create AI Job"}
            </Button>
          </div>
          {aiJobId && (
            <div className="space-y-6">
              {/* Refresh button and status */}
              {/* <div className="flex items-center gap-4 mb-2">
                 <Button 
                   onClick={handleRefreshStatus} 
                   variant="outline"
                   className="bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
                 >
                   Refresh Status
                 </Button>
                </div> */}

              {/* Task Cards */}
              <div className="space-y-8 mt-8">
                {/* Transcription Section */}
                <div className="bg-gray-50 dark:bg-card rounded-xl p-6 shadow-lg border border-gray-200 dark:border-border w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    <span className="font-semibold text-xl text-gray-900 dark:text-card-foreground">Transcription</span>
                  </div>
                  <TaskAccordion 
                    task="transcription" 
                    title="Audio Extraction" 
                    jobStatus={aiJobStatus?.status}
                    taskRuns={taskRuns}
                    acceptedRuns={acceptedRuns}
                    aiJobId={aiJobId}
                    aiJobStatus={aiJobStatus}
                    segParams={segParams}
                    questionGenParams={questionGenParams}
                    rerunParams={rerunParams}
                    handleTask={handleTask}
                    handleAcceptRun={handleAcceptRun}
                    canRunTask={canRunTask}
                    setTaskRuns={setTaskRuns}
                    setQuestionGenParams={setQuestionGenParams}
                    setSegParams={setSegParams}
                    setRerunParams={setRerunParams}
                    handleStartTranscription={handleStartTranscription}
                    getStatusIcon={getStatusIcon}
                    handleStopTask={handleStopTask}
                  />
                </div>

                {/* Segmentation Section */}
                <div className="bg-gray-50 dark:bg-card rounded-xl p-6 shadow-lg border border-gray-200 dark:border-border w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <ListChecks className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-semibold text-xl text-gray-900 dark:text-card-foreground">Segmentation</span>
                  </div>
                  <TaskAccordion 
                    task="segmentation" 
                    title="Segmentation" 
                    jobStatus={aiJobStatus?.status}
                    taskRuns={taskRuns}
                    acceptedRuns={acceptedRuns}
                    aiJobId={aiJobId}
                    aiJobStatus={aiJobStatus}
                    segParams={segParams}
                    questionGenParams={questionGenParams}
                    rerunParams={rerunParams}
                    handleTask={handleTask}
                    handleAcceptRun={handleAcceptRun}
                    canRunTask={canRunTask}
                    setTaskRuns={setTaskRuns}
                    setQuestionGenParams={setQuestionGenParams}
                    setSegParams={setSegParams}
                    setRerunParams={setRerunParams}
                    handleStartTranscription={handleStartTranscription}
                    getStatusIcon={getStatusIcon}
                    handleStopTask={handleStopTask}
                  />
                </div>

                {/* Question Generation Section */}
                <div className="bg-gray-50 dark:bg-card rounded-xl p-6 shadow-lg border border-gray-200 dark:border-border w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquareText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-xl text-gray-900 dark:text-card-foreground">Question Generation Test</span>
                  </div>
                  <TaskAccordion 
                    task="question" 
                    title="Question Generation" 
                    jobStatus={aiJobStatus?.status}
                    taskRuns={taskRuns}
                    acceptedRuns={acceptedRuns}
                    aiJobId={aiJobId}
                    aiJobStatus={aiJobStatus}
                    segParams={segParams}
                    questionGenParams={questionGenParams}
                    rerunParams={rerunParams}
                    handleTask={handleTask}
                    handleAcceptRun={handleAcceptRun}
                    canRunTask={canRunTask}
                    setTaskRuns={setTaskRuns}
                    setQuestionGenParams={setQuestionGenParams}
                    setSegParams={setSegParams}
                    setRerunParams={setRerunParams}
                    handleStartTranscription={handleStartTranscription}
                    getStatusIcon={getStatusIcon}
                    handleStopTask={handleStopTask}
                  />
                </div>

                {/* Upload Section */}
                <div className="bg-gray-50 dark:bg-card rounded-xl p-6 shadow-lg border border-gray-200 dark:border-border w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-xl text-gray-900 dark:text-card-foreground">Upload to Course</span>
                  </div>
                  <TaskAccordion 
                    task="upload" 
                    title="Upload to Course" 
                    jobStatus={aiJobStatus?.status}
                    taskRuns={taskRuns}
                    acceptedRuns={acceptedRuns}
                    aiJobId={aiJobId}
                    aiJobStatus={aiJobStatus}
                    segParams={segParams}
                    questionGenParams={questionGenParams}
                    rerunParams={rerunParams}
                    handleTask={handleTask}
                    handleAcceptRun={handleAcceptRun}
                    canRunTask={canRunTask}
                    setTaskRuns={setTaskRuns}
                    setQuestionGenParams={setQuestionGenParams}
                    setSegParams={setSegParams}
                    setRerunParams={setRerunParams}
                    handleStartTranscription={handleStartTranscription}
                    getStatusIcon={getStatusIcon}
                    handleStopTask={handleStopTask}
                  />
                </div>

                {/* Upload Success Message - Show outside accordion when upload is completed */}
                {taskRuns.upload.some(run => run.status === "done") && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-lg text-green-800 dark:text-green-200">Upload Successful!</span>
                    </div>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      Your AI-generated section has been successfully uploaded to the course. The section is now available for students.
                    </p>
                    <Button
                      onClick={() => {
                        // Go back to the previous page (where user came from)
                        window.history.back();
                      }}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 btn-beautiful"
                    >
                      <UploadCloud className="w-4 h-4 mr-2" />
                      View Generated Section
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

function EditSegmentsModalButton({ aiJobId, run, runIndex }: { aiJobId: string | null, run: TaskRun, runIndex: number }) {
  const [open, setOpen] = useState(false);
  const [segmentMap, setSegmentMap] = useState<number[]>([]);
  const [segmentTexts, setSegmentTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Always fetch latest segmentation status and transcript when modal opens
  useEffect(() => {
    async function fetchSegmentationData() {
      if (!aiJobId) return;
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('firebase-auth-token');
        const url = getApiUrl(`/genai/${aiJobId}/tasks/SEGMENTATION/status`);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to fetch segmentation status');
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length > 0 && arr[runIndex]?.segmentationMap && arr[runIndex]?.transcriptFileUrl) {
          const segMap = arr[runIndex].segmentationMap;
          setSegmentMap([...segMap]);
          // Fetch transcript JSON and group by segment
          const transcriptRes = await fetch(arr[runIndex].transcriptFileUrl);
          if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
          const transcriptData = await transcriptRes.json();
          const chunks = Array.isArray(transcriptData.chunks) ? transcriptData.chunks : [];
          const texts: string[] = [];
          let segStart = 0;
          for (let i = 0; i < segMap.length; ++i) {
            const segEnd = segMap[i];
            // Chunks whose timestamp[0] >= segStart and < segEnd
            const segChunks = chunks.filter((chunk: { timestamp: [number, number], text: string }) =>
              chunk.timestamp &&
              typeof chunk.timestamp[0] === 'number' &&
              chunk.timestamp[0] >= segStart &&
              chunk.timestamp[0] < segEnd
            );
            texts.push(segChunks.map((chunk: { text: string }) => chunk.text).join(' '));
            segStart = segEnd;
          }
          setSegmentTexts(texts);
        } else {
          setError('Segmentation data or transcript not found.');
          setSegmentMap([]);
          setSegmentTexts([]);
        }
      } catch (e: any) {
        setError(e.message || 'Unknown error');
        setSegmentMap([]);
        setSegmentTexts([]);
      } finally {
        setLoading(false);
      }
    }
    if (open) {
      fetchSegmentationData();
    }
  }, [open, aiJobId, runIndex]);

  const handleSegmentChange = (idx: number, value: string) => {
    const newMap = [...segmentMap];
    newMap[idx] = parseFloat(value);
    setSegmentMap(newMap);
  };

  const handleAddSegment = (idx: number) => {
    const newMap = [...segmentMap];
    const prev = idx === 0 ? 0 : newMap[idx - 1];
    const next = newMap[idx] ?? (prev + 10);
    const newEnd = prev + (next - prev) / 2;
    newMap.splice(idx, 0, newEnd);
    setSegmentMap(newMap);
    // No change to segmentTexts
  };

  const handleRemoveSegment = (idx: number) => {
    if (segmentMap.length <= 1) return;
    const newMap = [...segmentMap];
    newMap.splice(idx, 1);
    setSegmentMap(newMap);
    // No change to segmentTexts
  };

  const handleEdit = async () => {
    if (!aiJobId) return;
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const token = localStorage.getItem('firebase-auth-token');
      const url = getApiUrl(`/genai/jobs/${aiJobId}/edit/segment-map`);
      const backendUrl = getApiUrl(`/genai/jobs/${aiJobId}/edit/segment-map`);
      const body = {
        segmentMap: segmentMap,
        index: 0,
      };
      let res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        res = await fetch(backendUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      }
      if (!res.ok) throw new Error('Failed to update segment map');
      setSuccess(true);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to update segment map');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Segment Map</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {segmentMap.map((value, idx) => (
            <div key={idx} className="flex items-center space-x-4">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={value}
                onChange={e => handleSegmentChange(idx, e.target.value)}
                className="w-20"
              />
              {/* Display segment text as read-only (not editable) */}
              <Input
                type="text"
                value={segmentTexts[idx] || ''}
                readOnly
                className="flex-1 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                tabIndex={-1}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRemoveSegment(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleAddSegment(segmentMap.length)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleEdit}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add this function at the top-level (inside the component, before RunSegmentationSection):
async function editSegmentMap(jobId: string, segmentMap: number[], index: number): Promise<void> {
  const token = localStorage.getItem('firebase-auth-token');
  const url = getApiUrl(`/genai/jobs/${jobId}/edit/segment-map`);
  const body = JSON.stringify({ segmentMap, index });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body,
  });
  if (res.status === 200) return;
  let errMsg = 'Unknown error';
  try { errMsg = (await res.json()).message || errMsg; } catch { }
  if (res.status === 400) throw new Error('Bad request: ' + errMsg);
  if (res.status === 403) throw new Error('Forbidden: ' + errMsg);
  if (res.status === 404) throw new Error('Job not found: ' + errMsg);
  throw new Error(errMsg);
}