import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI, JobStatus, TranscriptParameters, SegmentationParameters, QuestionGenerationParameters } from "@/lib/genai-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle,
  Loader2,
  Play,
  Edit,
  Save,
  X,
  XCircle,
  PauseCircle,
  UploadCloud,
  FileText,
  ListChecks,
  MessageSquareText,
  Settings,
  Zap,
  Clock,
  AlertTriangle,
  Ban,
  RefreshCw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCourseStore } from "@/store/course-store";

// Import AI generation components
import { TaskAccordion } from "./ai-gen-components/task-accordion";

// Enhanced question types to match backend
type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';

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
  const status = jobStatus[stepKey];
  if (status === 'COMPLETED') return 'completed';
  if (status === 'RUNNING') return 'active';
  if (status === 'FAILED') return 'failed';
  if (status === 'WAITING' || status === 'PENDING') return 'pending';
  return 'pending';
};

const Stepper = ({ jobStatus }: { jobStatus: any }) => (
  <div className="flex items-center justify-between mb-8 px-2 relative animate-fade-in">
    {WORKFLOW_STEPS.map((step, idx) => {
      const status = getStepStatus(jobStatus, step.key);
      const isLast = idx === WORKFLOW_STEPS.length - 1;
      const isCompleted = status === 'completed';
      const isActive = status === 'active';
      const isFailed = status === 'failed';

      return (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center relative z-10 animate-step-appear">
            {/* Step Circle */}
            <div
              className={`
                 stepper-step rounded-full p-3 mb-3 transition-all duration-500 ease-out transform hover:scale-110
                 ${isCompleted
                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 ring-2 ring-green-500/20 animate-stepper-success-glow'
                  : isActive
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20 animate-stepper-glow'
                    : isFailed
                      ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 ring-2 ring-red-500/20 animate-stepper-error-glow'
                      : 'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground shadow-md ring-1 ring-border/50 hover:shadow-lg hover:ring-2 hover:ring-primary/20'
                }
               `}
              style={{
                minWidth: 48,
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Animated Icons */}
              <div className="transition-all duration-300 ease-out flex items-center justify-center w-6 h-6">
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6 animate-bounce" />
                ) : isActive ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isFailed ? (
                  <XCircle className="w-6 h-6 animate-pulse" />
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
                 ${isCompleted
                  ? 'text-green-600 dark:text-green-400'
                  : isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : isFailed
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                }
               `}>
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
            </div>
          </div>

          {/* Connecting Line */}
          {!isLast && (
            <div className="flex-1 flex items-center justify-center relative z-0">
              <div className={`
                 stepper-line h-0.5 w-full mx-2 rounded-full transition-all duration-700 ease-out bg-muted
                 ${isCompleted ? 'completed' : ''}
               `}
                style={{ minWidth: 32 }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);


function getApiUrl(path: string) {
  return `${import.meta.env.VITE_BASE_URL}${path}`;
}

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



  // Drag and drop handlers for ORDER_THE_LOTS questions (handled by components)
  // const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
  //   e.dataTransfer.setData('text/plain', index.toString());
  // }, []);
  // const handleDragOver = useCallback((e: React.DragEvent) => {…}, []);
  // const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {…}, []);

  // New: Track current AI job status for manual refresh
  const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null);
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

  // Workflow Configuration State
  const [selectedTasks, setSelectedTasks] = useState({
    transcription: true,
    segmentation: true,
    questions: true,
    upload: false
  });
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Custom configuration parameters
  const [customTranscriptParams, setCustomTranscriptParams] = useState<TranscriptParameters>({
    language: 'en',
    modelSize: 'large'
  });
  const [customSegmentationParams, setCustomSegmentationParams] = useState<SegmentationParameters>({
    lam: 4.6,
    runs: 25,
    noiseId: -1
  });
  const [customQuestionParams, setCustomQuestionParams] = useState<QuestionGenerationParameters>({
    model: 'deepseek-r1:70b',
    SOL: 1,
    SML: 0,
    NAT: 0,
    DES: 0,
    prompt: `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`
  });

  // Upload parameters
  const [uploadParams, setUploadParams] = useState({
    videoItemBaseName: 'video_item',
    quizItemBaseName: 'quiz_item',
    questionsPerQuiz: 1
  });

  // Task dependency order (linear workflow)
  const taskOrder = ['transcription', 'segmentation', 'questions', 'upload'] as const;
  
  // Handle task selection with automatic dependency management
  const handleTaskSelection = (taskKey: keyof typeof selectedTasks, checked: boolean) => {
    if (checked) {
      // If enabling a task, enable all previous tasks in the dependency chain
      const newSelectedTasks = { ...selectedTasks };
      const taskIndex = taskOrder.indexOf(taskKey);
      
      // Enable all tasks up to and including the selected one
      for (let i = 0; i <= taskIndex; i++) {
        newSelectedTasks[taskOrder[i]] = true;
      }
      setSelectedTasks(newSelectedTasks);
    } else {
      // If disabling a task, disable all subsequent tasks in the dependency chain
      const newSelectedTasks = { ...selectedTasks };
      const taskIndex = taskOrder.indexOf(taskKey);
      
      // Disable this task and all subsequent tasks
      for (let i = taskIndex; i < taskOrder.length; i++) {
        newSelectedTasks[taskOrder[i]] = false;
      }
      setSelectedTasks(newSelectedTasks);
    }
  };

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
      // Build job parameters based on workflow mode
      const jobParams: Parameters<typeof aiSectionAPI.createJob>[0] = {
        videoUrl: youtubeUrl,
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId,
        moduleId: currentCourse.moduleId,
        sectionId: currentCourse.sectionId,
        videoItemBaseName: uploadParams.videoItemBaseName,
        quizItemBaseName: uploadParams.quizItemBaseName,
        questionsPerQuiz: uploadParams.questionsPerQuiz,
      };

      // Add optional task parameters based on selected tasks
      if (selectedTasks.transcription) {
        jobParams.transcriptParameters = {
          language: customTranscriptParams.language || 'en',
          modelSize: customTranscriptParams.modelSize || 'large'
        };
      }
      
      if (selectedTasks.segmentation) {
        jobParams.segmentationParameters = {
          lam: customSegmentationParams.lam ?? 4.6,
          runs: customSegmentationParams.runs ?? 25,
          noiseId: customSegmentationParams.noiseId ?? -1
        };
      }
      
      if (selectedTasks.questions) {
        jobParams.questionGenerationParameters = {
          model: customQuestionParams.model || 'deepseek-r1:70b',
          SOL: customQuestionParams.SOL ?? 1,
          SML: customQuestionParams.SML ?? 0,
          NAT: customQuestionParams.NAT ?? 0,
          DES: customQuestionParams.DES ?? 0,
          prompt: customQuestionParams.prompt || `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`
        };
      }

      const { jobId } = await aiSectionAPI.createJob(jobParams);
      setAiJobId(jobId);
      console.log("[handleCreateJob] Set aiJobId:", jobId);
      
      const enabledTasksCount = Object.values(selectedTasks).filter(Boolean).length;
      const taskNames = Object.entries(selectedTasks)
        .filter(([, enabled]) => enabled)
        .map(([task]) => task === 'questions' ? 'question generation' : task)
        .join(', ');
      
      if (enabledTasksCount > 0) {
        toast.success(`AI job created with automated ${taskNames}!`);
      } else {
        toast.success("AI job created successfully!");
      }
      
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

  // Helper to get task status from job status
  const getTaskStatus = (jobStatus: any, taskKey: string) => {
    if (!jobStatus) return null;
    return jobStatus[taskKey];
  };

  // Helper to map status to icon and color with enhanced status handling
  const getTaskStatusIcon = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case 'PENDING':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Task is pending and waiting to start</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'RUNNING':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Running</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Task is currently running</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'WAITING':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                  <PauseCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Waiting</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Task is waiting for approval or dependencies</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'COMPLETED':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Task completed successfully</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'FAILED':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Failed</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Task failed to complete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'ABORTED':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                  <Ban className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Aborted</span>
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
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border">
                  <AlertTriangle className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Unknown</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Unknown status: {status}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
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

  // Cutted Task Accordion From here. 

  const getDifficultyColor = (difficulty: Question['difficulty']): string => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'hard': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  const getQuestionTypeColor = (type: QuestionType): string => {
    switch (type) {
      case 'SELECT_ONE_IN_LOT': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
      case 'SELECT_MANY_IN_LOT': return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20';
      case 'ORDER_THE_LOTS': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
      case 'NUMERIC_ANSWER_TYPE': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'DESCRIPTIVE': return 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  const getQuestionTypeLabel = (type: QuestionType): string => {
    switch (type) {
      case 'SELECT_ONE_IN_LOT': return 'Single Select';
      case 'SELECT_MANY_IN_LOT': return 'Multiple Select';
      case 'ORDER_THE_LOTS': return 'Drag & Drop';
      case 'NUMERIC_ANSWER_TYPE': return 'Numeric';
      case 'DESCRIPTIVE': return 'Descriptive';
      default: return 'Question';
    }
  };

  const handleEditClick = (segmentId: string, question: Question) => {
    setEditingQuestion({ segmentId, questionId: question.id });
    setEditedQuestion({ ...question });
  };

  const handleSaveEdit = (segmentId: string, questionId: string) => {
    setVideoDataState(prev => {
      if (!prev) return prev;
      const newSegments = prev.segments.map(segment => {
        if (segment.id !== segmentId) return segment;
        return {
          ...segment,
          questions: segment.questions.map(q =>
            q.id === questionId ? { ...q, ...editedQuestion } as Question : q
          ),
        };
      });
      return { ...prev, segments: newSegments } as VideoData;
    });
    setEditingQuestion(null);
    setEditedQuestion({});
    toast.success("Question updated successfully!");
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setEditedQuestion({});
  };

  const handleAddOption = () => {
    setEditedQuestion(prev => ({
      ...prev,
      options: [...(prev.options || []), `Option ${(prev.options?.length || 0) + 1}`]
    }));
  };

  const handleRemoveOption = (index: number) => {
    setEditedQuestion(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index)
    }));
  };

  // Question Edit Form Component
  // Cutted from here. 

  // Track previous job status for transition detection
  const prevJobStatusRef = useRef<any>(null);
  // Track if this is the first status fetch after mount
  const didMountRef = useRef(false);

  // New: Manual refresh handler
  const handleRefreshStatus = async () => {
    if (!aiJobId) return;
    try {
      const status = await aiSectionAPI.getJobStatus(aiJobId);
      setAiJobStatus(status);
      const prevJobStatus = prevJobStatusRef.current;
      // Only show toast if transitioning to COMPLETED and not on first mount
      if (
        didMountRef.current &&
        status.jobStatus?.transcriptGeneration === 'COMPLETED' &&
        prevJobStatus?.transcriptGeneration !== 'COMPLETED'
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
        status.jobStatus?.segmentation === 'COMPLETED' &&
        prevJobStatus?.segmentation !== 'COMPLETED'
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
        status.jobStatus?.questionGeneration === 'COMPLETED' &&
        prevJobStatus?.questionGeneration !== 'COMPLETED'
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
            const idxToUpdate = lastLoadingIdx !== -1 ? prev.question.length - 1 - lastLoadingIdx : (lastDoneIdx !== -1 ? prev.question.length - 1 - lastDoneIdx : -1);
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
      prevJobStatusRef.current = status.jobStatus;
      // Mark didMount after first fetch
      if (!didMountRef.current) didMountRef.current = true;
      if (status.jobStatus?.transcriptGeneration === 'COMPLETED') {
        setAiWorkflowStep('transcription_done');
        return;
      }
      if (status.jobStatus?.audioExtraction === 'COMPLETED') {
        setAiWorkflowStep('audio_extraction_done');
        return;
      }
      if (status.jobStatus?.audioExtraction === 'FAILED' || status.jobStatus?.transcriptGeneration === 'FAILED') {
        setAiWorkflowStep('error');
        toast.error('A step failed.');
        return;
      }
    } catch (error) {
      setAiWorkflowStep('error');
      toast.error('Failed to refresh status.');
    }
  };


  useEffect(() => {
    if (!aiJobId) return;
    const interval = setInterval(() => {
      handleRefreshStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [aiJobId]);

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
  // Cutted from here.

  // Component to show segmentation for a run
  // Cutted from here.


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
  // Cutted from here.

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
        <Stepper jobStatus={aiJobStatus?.jobStatus} />
        
        {/* Unified Workflow Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  AI Workflow Tasks
                </CardTitle>
                <CardDescription>
                  Select which tasks to run automatically. Dependencies are handled automatically.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                disabled={!!aiJobId}
                className="text-xs"
              >
                {showAdvancedConfig ? 'Hide' : 'Show'} Advanced Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Task Selection with Linear Dependencies */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {taskOrder.map((task, index) => {
                  const isSelected = selectedTasks[task];
                  const isDependency = index > 0 && selectedTasks[taskOrder[index + 1]];
                  const taskLabels = {
                    transcription: 'Transcription',
                    segmentation: 'Segmentation', 
                    questions: 'Question Generation',
                    upload: 'Upload to Course'
                  };
                  const taskIcons = {
                    transcription: <FileText className="w-4 h-4" />,
                    segmentation: <ListChecks className="w-4 h-4" />,
                    questions: <MessageSquareText className="w-4 h-4" />,
                    upload: <UploadCloud className="w-4 h-4" />
                  };
                  
                  return (
                    <div key={task} className={`
                      relative p-4 border rounded-lg transition-all duration-200
                      ${isSelected 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' 
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                      }
                      ${isDependency ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}
                    `}>
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleTaskSelection(task, !!checked)}
                          disabled={!!aiJobId}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {taskIcons[task]}
                            <Label className="font-medium text-sm cursor-pointer">
                              {taskLabels[task]}
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {task === 'transcription' && 'Convert audio to text'}
                            {task === 'segmentation' && 'Split into logical segments'}
                            {task === 'questions' && 'Generate quiz questions'}
                            {task === 'upload' && 'Upload content to course'}
                          </p>
                          {isDependency && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Auto-selected
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dependency Info */}
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Smart Dependencies</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Tasks run in sequence: Transcription → Segmentation → Questions → Upload. 
                      Selecting a later task automatically enables all previous required tasks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Parameters - Always Shown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <div>
                  <Label htmlFor="video-base-name" className="text-sm font-medium">Video Item Name</Label>
                  <Input
                    id="video-base-name"
                    value={uploadParams.videoItemBaseName}
                    onChange={(e) => setUploadParams(prev => ({ ...prev, videoItemBaseName: e.target.value }))}
                    placeholder="video_item"
                    disabled={!!aiJobId}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quiz-base-name" className="text-sm font-medium">Quiz Item Name</Label>
                  <Input
                    id="quiz-base-name"
                    value={uploadParams.quizItemBaseName}
                    onChange={(e) => setUploadParams(prev => ({ ...prev, quizItemBaseName: e.target.value }))}
                    placeholder="quiz_item"
                    disabled={!!aiJobId}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="questions-per-quiz" className="text-sm font-medium">Questions Per Quiz</Label>
                  <Input
                    id="questions-per-quiz"
                    type="number"
                    min={1}
                    value={uploadParams.questionsPerQuiz}
                    onChange={(e) => setUploadParams(prev => ({ ...prev, questionsPerQuiz: Number(e.target.value) }))}
                    disabled={!!aiJobId}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Advanced Configuration */}
              {showAdvancedConfig && (
                <Accordion type="multiple" className="border rounded-lg">
                  {selectedTasks.transcription && (
                    <AccordionItem value="transcript">
                      <AccordionTrigger className="px-4">Transcription Settings</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Language</Label>
                            <Select 
                              value={customTranscriptParams.language} 
                              onValueChange={(value) => setCustomTranscriptParams(prev => ({ ...prev, language: value }))}
                              disabled={!!aiJobId}
                            >
                              <SelectTrigger>
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
                          <div>
                            <Label>Model Size</Label>
                            <Select 
                              value={customTranscriptParams.modelSize} 
                              onValueChange={(value) => setCustomTranscriptParams(prev => ({ ...prev, modelSize: value }))}
                              disabled={!!aiJobId}
                            >
                              <SelectTrigger>
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
                    <AccordionItem value="segmentation">
                      <AccordionTrigger className="px-4">Segmentation Settings</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Lambda</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={customSegmentationParams.lam}
                              onChange={(e) => setCustomSegmentationParams(prev => ({ ...prev, lam: parseFloat(e.target.value) }))}
                              disabled={!!aiJobId}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Runs</Label>
                            <Input
                              type="number"
                              value={customSegmentationParams.runs}
                              onChange={(e) => setCustomSegmentationParams(prev => ({ ...prev, runs: parseInt(e.target.value) }))}
                              disabled={!!aiJobId}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Noise ID</Label>
                            <Input
                              type="number"
                              value={customSegmentationParams.noiseId}
                              onChange={(e) => setCustomSegmentationParams(prev => ({ ...prev, noiseId: parseInt(e.target.value) }))}
                              disabled={!!aiJobId}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  
                  {selectedTasks.questions && (
                    <AccordionItem value="questions">
                      <AccordionTrigger className="px-4">Question Generation Settings</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          <div>
                            <Label>Model</Label>
                            <Select 
                              value={customQuestionParams.model} 
                              onValueChange={(value) => setCustomQuestionParams(prev => ({ ...prev, model: value }))}
                              disabled={!!aiJobId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="deepseek-r1:70b">DeepSeek R1 70B</SelectItem>
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label>SOL Questions</Label>
                              <Input
                                type="number"
                                min={0}
                                value={customQuestionParams.SOL}
                                onChange={(e) => setCustomQuestionParams(prev => ({ ...prev, SOL: parseInt(e.target.value) }))}
                                disabled={!!aiJobId}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>SML Questions</Label>
                              <Input
                                type="number"
                                min={0}
                                value={customQuestionParams.SML}
                                onChange={(e) => setCustomQuestionParams(prev => ({ ...prev, SML: parseInt(e.target.value) }))}
                                disabled={!!aiJobId}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>NAT Questions</Label>
                              <Input
                                type="number"
                                min={0}
                                value={customQuestionParams.NAT}
                                onChange={(e) => setCustomQuestionParams(prev => ({ ...prev, NAT: parseInt(e.target.value) }))}
                                disabled={!!aiJobId}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>DES Questions</Label>
                              <Input
                                type="number"
                                min={0}
                                value={customQuestionParams.DES}
                                onChange={(e) => setCustomQuestionParams(prev => ({ ...prev, DES: parseInt(e.target.value) }))}
                                disabled={!!aiJobId}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Custom Prompt</Label>
                            <Textarea
                              value={customQuestionParams.prompt}
                              onChange={(e) => setCustomQuestionParams(prev => ({ ...prev, prompt: e.target.value }))}
                              placeholder="Enter custom instructions for question generation..."
                              disabled={!!aiJobId}
                              className="mt-1"
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
          </CardContent>
        </Card>
        
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
              {aiJobId ? "Job Created" : (() => {
                const enabledCount = Object.values(selectedTasks).filter(Boolean).length;
                const enabledTaskNames = Object.entries(selectedTasks)
                  .filter(([, enabled]) => enabled)
                  .map(([task]) => {
                    const labels = {
                      transcription: 'Transcription',
                      segmentation: 'Segmentation',
                      questions: 'Questions',
                      upload: 'Upload'
                    };
                    return labels[task as keyof typeof labels];
                  });
                
                if (enabledCount === 0) {
                  return 'Create AI Job';
                } else if (enabledCount <= 2) {
                  return `Start AI Job (${enabledTaskNames.join(' + ')})`;
                } else {
                  return `Start AI Job (${enabledCount} tasks)`;
                }
              })()}
            </Button>
          </div>
          <div className="space-y-6">
            {/* Refresh button and status */}
            <div className="flex flex-col gap-4 mb-2">
              <Button
                onClick={handleRefreshStatus}
                variant="outline"
                className="bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful w-fit"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
              
              {/* Task Status Display */}
              {aiJobId && aiJobStatus?.jobStatus && (
                <div className="bg-white dark:bg-card/50 rounded-lg border border-gray-200 dark:border-border p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Task Status Overview
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Audio Extraction */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Audio Extraction</span>
                      {getTaskStatusIcon(getTaskStatus(aiJobStatus.jobStatus, 'audioExtraction'))}
                    </div>
                    
                    {/* Transcription */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Transcription</span>
                      {getTaskStatusIcon(getTaskStatus(aiJobStatus.jobStatus, 'transcriptGeneration'))}
                    </div>
                    
                    {/* Segmentation */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Segmentation</span>
                      {getTaskStatusIcon(getTaskStatus(aiJobStatus.jobStatus, 'segmentation'))}
                    </div>
                    
                    {/* Question Generation */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Questions</span>
                      {getTaskStatusIcon(getTaskStatus(aiJobStatus.jobStatus, 'questionGeneration'))}
                    </div>
                    
                    {/* Upload */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Upload</span>
                      {getTaskStatusIcon(getTaskStatus(aiJobStatus.jobStatus, 'uploadContent'))}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  jobStatus={aiJobStatus?.jobStatus}
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
                  jobStatus={aiJobStatus?.jobStatus}
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
                  jobStatus={aiJobStatus?.jobStatus}
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
                  jobStatus={aiJobStatus?.jobStatus}
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

        </div>
      </div>
    </div>
  );
}