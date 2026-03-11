import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI, connectToLiveStatusUpdates, JobStatus, getApiUrl } from "@/lib/genai-api";
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
  MessageSquareText,
  Workflow,
  Info,
  Brain,
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
  Check,
  MessageSquare,
  CircleCheckBig,
  Layers,
  Clock,
  Zap,
  FileMusic,
  Upload,
  Share,
  BookOpen
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCourseStore } from "@/store/course-store";
import { Link, useNavigate } from "@tanstack/react-router";

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
 
  SOL: number;
  SML: number;
  NAT: number;
  DES: number;
  BIN:number;
  prompt: string;
};

// Stepper icons
const WORKFLOW_STEPS = [
  {
    key: 'audioExtraction',
    label: 'Audio Extraction',
    icon: <UploadCloud className="w-5 h-5" />,
    explanation: "Extracts audio from uploaded files (video or audio) for further processing."
  },
  {
    key: 'transcriptGeneration',
    label: 'Transcription',
    icon: <FileText className="w-5 h-5" />,
    explanation: "Converts extracted audio into accurate text transcripts."
  },
  {
    key: 'segmentation',
    label: 'Segmentation',
    icon: <ListChecks className="w-5 h-5" />,
    explanation: "Breaks down the transcript into logical sections or chunks."
  },
  {
    key: 'questionGeneration',
    label: 'Question Generation',
    icon: <MessageSquareText className="w-5 h-5" />,
    explanation: "Automatically generates relevant questions from the segmented transcript."
  },
  {
    key: 'uploadContent',
    label: 'Upload',
    icon: <UploadCloud className="w-5 h-5" />,
    explanation: "Saves and uploads the processed content with questions for later use."
  },
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

    return 'transcription';
  }, [jobStatus]);

  // Calculate progress based on completed steps
  const getStepProgress = () => {
    const stepOrder = [
      'transcription',
      'audioExtraction',
      'transcriptGeneration',
      'segmentation',
      'questionGeneration',
      'uploadContent'
    ];
  
    // Find the last completed step
    let lastCompletedIndex = -1;
    
    stepOrder.forEach((step, index) => {
      const status = getStepStatus(jobStatus, step);
      if (status === 'completed') {
        lastCompletedIndex = index;
      }
    });
    
    // Only show progress for completed steps
    if (lastCompletedIndex >= 0) {
      return ((lastCompletedIndex + 1) / stepOrder.length) * 100;
    }
    
    return 0;
  };

  const progressPercentage = getStepProgress();

  return (
    <div className="relative mb-12 px-1 sm:px-4">
      {/* Single continuous progress line */}
      <div className="absolute left-0 top-5 w-full h-[3px] bg-gray-300 dark:bg-[#FCFDFF] overflow-hidden">
        {progressPercentage > 0 && (
          <div 
            className="h-full bg-gradient-to-r from-[#00D492] to-[#2B7FFF] transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        )}
      </div>
      
      <div className="flex items-start relative z-10 justify-between gap-0.5 sm:gap-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const status = getStepStatus(jobStatus, step.key);
        const isCurrent = step.key === activeStep;
        const isLast = idx === WORKFLOW_STEPS.length - 1;
        const isCompleted = status === 'completed';
        const isFailed = status === 'failed';
        const isStopped = status === 'stopped';
        const isActive = status === 'active' || (isCurrent && !isCompleted && !isFailed && !isStopped);
        const isUpcoming = !isCompleted && !isActive && !isFailed && !isStopped;

        return (
          <React.Fragment key={step.key}>
            <div className="relative flex flex-col items-center min-w-0 flex-1">
          <div className="flex flex-col items-center w-full">
             {/* Step Circle */}
           <div className={`
      relative flex items-center justify-center
      w-9 h-9 sm:w-11 sm:h-11 rounded-[14px] transition-all duration-300 z-10
      ${isCompleted 
        ? 'bg-[linear-gradient(135deg,_#00D492_0%,_#009966_100%)] text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
        : isActive 
          ? 'bg-[linear-gradient(135deg,_#51A2FF_0%,_#9810FA_100%)] text-white shadow-lg ring-4 ring-blue-200' 
          : isFailed 
            ? 'bg-red-500 text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
            : isStopped 
              ? 'bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
              : 'bg-gray-200 dark:bg-[#464545] text-gray-600 dark:text-[#FFFFFF]'}
    `}>
                      {isCompleted ? (
                        <CheckCircle className="w-3 h-3 sm:w-6 sm:h-6 dark:text-[#0D0D0D]" />
                      ) : isActive ? (
                        <span className="text-xs sm:text-base">{step.icon}</span>
                      ) : isFailed ? (
                        <XCircle className="w-3 h-3 sm:w-6 sm:h-6" />
                      ) : isStopped ? (
                        <PauseCircle className="w-3 h-3 sm:w-6 sm:h-6" />
                      ) : (
                        <span className="font-medium text-xs sm:text-base">{step.icon}</span>
    )}
    {isActive && <div className="absolute -top-0.5 -right-0.5 sm:-top-1.5 sm:-right-1 bg-[#2B7FFF] rounded-full h-3 w-3 sm:h-5 sm:w-5 flex items-center justify-center"><Loader2 className="w-1.5 h-1.5 sm:w-3 sm:h-3 animate-spin text-white dark:text-[#0D0D0D]" /></div>}
    {isCompleted && <div className="absolute -top-0.5 -right-0.5 sm:-top-1.5 sm:-right-1 bg-[#00BC7D] rounded-full h-3 w-3 sm:h-5 sm:w-5 flex items-center justify-center"><Sparkles className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-white dark:text-[#0D0D0D]" /></div>}
  </div>

  {/* Step Label */}
  <div className="mt-1 sm:mt-2 flex flex-col items-center w-full px-0 sm:px-1">
    <div className={`text-[9px] lg:text-sm sm:text-xs md:text-[10px] font-medium text-center leading-tight max-w-full break-words
        ${isCompleted 
          ? 'text-[#009966]' 
          : isActive 
            ? 'text-[#155DFC]' 
            : isFailed 
              ? 'text-red-600' 
              : isStopped 
                ? 'text-[#F54900]' 
                : 'text-[#6A7282] dark:text-[#FFFFFF]'}
      `}>
      {step.label}
    </div>

    {/* Status Text */}
    <div className="mt-0.5 sm:mt-1 h-3 sm:h-4 text-[9px] sm:text-xs">
      {isActive && <span className="text-[#2B7FFF] dark:text-blue-400 bg-[#EEF2FF] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><Zap size={8} className="text-yellow-500 dark:text-yellow-400 sm:w-3.5 sm:h-3.5"/> <span className="hidden lg:inline">Processing</span><span className="sm:hidden">Proc</span></span>}
      {isCompleted && <span className="text-[#00BC7D] dark:text-green-400 bg-[#ECFDF5] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><Check size={8} className="text-green-600 dark:text-green-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Complete</span><span className="sm:hidden">Done</span></span>}
      {isFailed && <span className="text-red-600 dark:text-red-400 bg-[#ffe9ea] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><X size={8} className="text-red-600 dark:text-red-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Failed</span><span className="sm:hidden">Fail</span></span>}
      {isStopped && <span className="text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><PauseCircle size={8} className="text-orange-600 dark:text-orange-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Stopped</span><span className="sm:hidden">Stop</span></span>}
    </div>
  </div>
  </div>
</div>


            {/* Connecting Line */}
            {/* {!isLast && (
              <div className="flex-1 h-1 mx-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-transparent'}`}
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )} */}
          </React.Fragment>
        );
      })}
    </div>
    </div>
  );
});



const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};


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
  const [expandedAccordionItems, setExpandedAccordionItems] = useState<string[]>([]);
  const [manuallyCollapsedItems, setManuallyCollapsedItems] = useState<string[]>([]);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [currentUiStep, setCurrentUiStep] = useState(0);
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
  const [aiJobDate, setAiJobDate] = useState<any | null>(null);
  const [aiWorkflowStep, setAiWorkflowStep] = useState<'idle' | 'audio_extraction' | 'audio_extraction_done' | 'transcription' | 'transcription_done' | 'error'>('idle');
  // New: Track if approveContinueTask has been called for current job's WAITING state
  const [approvedForCurrentJob, setApprovedForCurrentJob] = useState(false);
  // New: Track if continue+start for transcript has been triggered for the current job
  const [transcriptStartedForCurrentJob, setTranscriptStartedForCurrentJob] = useState(false);
  // New: Parameters for rerun
  const [rerunParams, setRerunParams] = useState({ language: 'en', model: 'default' });

  const [audioExtractionProgress, setAudioExtractionProgress] = useState(0);
  type AudioExtractionStatus = 'ready' | 'processing' | 'completed' | 'failed' | 'paused';
  const [audioExtractionStatus, setAudioExtractionStatus] = useState<AudioExtractionStatus>('ready');
  const [audioExtractionStartTime, setAudioExtractionStartTime] = useState<Date | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [pausedProgress, setPausedProgress] = useState(0);
  const [pausedStartTime, setPausedStartTime] = useState<Date | null>(null);

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

  // Add state for question generation parameters
  const [questionGenParams, setQuestionGenParams] = useState<QuestionGenParams>({
   
    SOL: 2,
    SML: 0,
    NAT: 0,
    DES: 0,
    BIN:0,
    prompt: `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`
  });

  // AI Section Handlers
  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  };

  const navigate = useNavigate();

  useEffect(() => {
    const allCompletedRunIds: string[] = [];

    const completedTranscriptionIds = taskRuns?.transcription
      .filter(run => {
        return run?.status === "done" &&
          run?.result?.task === 'TRANSCRIPT_GENERATION' &&
          !expandedAccordionItems?.includes(run?.id) &&
          !manuallyCollapsedItems?.includes(run?.id);
      })
      .map(run => run?.id) || [];

    const completedSegmentationIds = taskRuns?.segmentation
      .filter(run => run?.status === "done" && !expandedAccordionItems?.includes(run?.id) && !manuallyCollapsedItems?.includes(run?.id))
      .map(run => run?.id) || [];

    const completedQuestionIds = taskRuns?.question
      .filter(run => run?.status === "done" && !expandedAccordionItems?.includes(run?.id) && !manuallyCollapsedItems?.includes(run?.id))
      .map(run => run?.id) || [];

    const completedUploadIds = taskRuns?.upload
      .filter(run => run?.status === "done" && !expandedAccordionItems?.includes(run?.id) && !manuallyCollapsedItems?.includes(run?.id))
      .map(run => run?.id) || [];

    allCompletedRunIds.push(...completedTranscriptionIds, ...completedSegmentationIds, ...completedQuestionIds, ...completedUploadIds);

    if (allCompletedRunIds.length > 0) {
      setExpandedAccordionItems(prev => {
        const newItems = allCompletedRunIds.filter(id => !manuallyCollapsedItems.includes(id));
        return [...prev, ...newItems];
      });
    }
  }, [taskRuns.transcription, taskRuns.segmentation, taskRuns.question, taskRuns.upload]);

  useEffect(() => {
    const recentTranscriptionRun = taskRuns.transcription
      .filter(run => run.status === 'done' && run.result?.task === 'TRANSCRIPT_GENERATION')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (recentTranscriptionRun &&
      !expandedAccordionItems.includes(recentTranscriptionRun.id) &&
      !manuallyCollapsedItems.includes(recentTranscriptionRun.id)) {


      setTimeout(() => {
        setExpandedAccordionItems(prev => {
          if (!prev.includes(recentTranscriptionRun.id)) {
            const newExpanded = [...prev, recentTranscriptionRun.id];
            return newExpanded;
          }
          return prev;
        });
      }, 500);
    }
  }, [taskRuns.transcription.map(run => `${run.id}-${run.status}-${run.result?.task}`).join(','), expandedAccordionItems, manuallyCollapsedItems]);

  useEffect(() => {
    const completedTranscriptionRuns = taskRuns.transcription.filter(run => run.status === 'done');

    completedTranscriptionRuns.forEach(run => {
      if (!expandedAccordionItems.includes(run.id) && !manuallyCollapsedItems.includes(run.id)) {
        setTimeout(() => {
          setExpandedAccordionItems(prev => {
            if (!prev.includes(run.id)) {
              return [...prev, run.id];
            }
            return prev;
          });
        }, 1000);
      }
    });
  }, [taskRuns.transcription.length, taskRuns.transcription.filter(run => run.status === 'done').length]);

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

    setIsCreatingJob(true);
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
      setCurrentUiStep(1); // Move to the first step (transcription)
      // Do NOT start audio extraction here. Wait for user to click Transcription button.
    } catch (error) {
      toast.error("Failed to create AI job. Please try again.");
    } finally {
      setIsCreatingJob(false);
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
          
          setAudioExtractionStatus('processing');
          setAudioExtractionProgress(pausedProgress);
          setAudioExtractionStartTime(pausedStartTime || new Date());
          setEstimatedTimeRemaining('');
          
          toast.success("Transcription restarted");
          await handleRefreshStatus();
          return;
        }

        if (aiJobStatus?.jobStatus?.transcriptGeneration === 'COMPLETED') {
          // Rerun transcription with selected parameters
          await aiSectionAPI.rerunJobTask(aiJobId, 'TRANSCRIPT_GENERATION', rerunParams);
          setAiWorkflowStep('transcription');
          toast.success("Transcription rerun started.");
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
        
        setAudioExtractionStatus('processing');
        setAudioExtractionProgress(audioExtractionStatus === 'paused' ? pausedProgress : 0);
        setAudioExtractionStartTime(audioExtractionStatus === 'paused' ? pausedStartTime || new Date() : new Date());
        setEstimatedTimeRemaining('');
        
        toast.success("Audio extraction started.");
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
            toast.success("Segmentation restarted.");
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
            toast.success("Question generation restarted.");
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

    setExpandedAccordionItems(prev => prev.filter(id => id !== runId));
    setManuallyCollapsedItems(prev => [...prev, runId]);

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

  const getCurrentActiveRunNumber = (taskType: keyof TaskRuns): number => {
    const runs = taskRuns[taskType];
    if (!runs || runs.length === 0) return 1;
    
    const latestRun = runs.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
    
    return runs.indexOf(latestRun) + 1;
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
    handleStopTask,
    expandedAccordionItems,
    setExpandedAccordionItems,
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
    expandedAccordionItems: string[];
    setExpandedAccordionItems: React.Dispatch<React.SetStateAction<string[]>>;
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

    const fields = React.useMemo<(keyof Pick<QuestionGenParams, "SOL" | "SML" | "NAT" | "DES">)[]>(() =>
      ["SOL", "SML", "NAT", "DES"],
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
      <div className="space-y-[28px]">
        {/* Always show transcription parameter inputs for 'transcription' task */}
        {task === 'transcription' && audioExtractionStatus !== 'completed' && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-5 mb-4">
            <div className="flex-1 flex flex-col items-start min-w-0">
              <label className="mb-2.5 flex items-center text-sm font-medium text-gray-700 dark:text-[#a8a29e]">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                <span className="truncate">Processing Language</span>
              </label>
              <select
                value={rerunParams.language}
                onChange={e => setRerunParams(p => ({ ...p, language: e.target.value }))}
                className="w-full px-3 sm:px-4 py-2 rounded-full border border-gray-200 dark:border-[#26211E] bg-white dark:bg-[#202020] shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            {/* <div className="flex-1 flex flex-col items-start min-w-0">
              <label className="mb-2.5 flex items-center text-sm font-medium text-gray-700 dark:text-[#a8a29e]">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2 flex-shrink-0"></span>
                <span className="truncate">AI Model</span>
              </label>
              <select
                value={rerunParams.model}
                onChange={e => setRerunParams(p => ({ ...p, model: e.target.value }))}
                className="w-full px-3 sm:px-4 py-2 rounded-full border border-gray-200 dark:border-[#26211E] bg-white dark:bg-[#202020] shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="default">default</option>
               
              </select>
            </div> */}
          </div>
        )}
        {task === 'transcription' && (
          (accordionAiJobStatus?.jobStatus?.audioExtraction === 'COMPLETED' ||
           (accordionAiJobStatus?.task === 'AUDIO_EXTRACTION' && accordionAiJobStatus?.status === 'COMPLETED'))
        ) && (
          <div className="w-full mb-6 shadow-sm">

            <div className="rounded-xl border border-emerald-200 dark:border-[#0E7145] bg-gradient-to-r from-emerald-50 to-purple-50 p-5 shadow-sm dark:bg-[#171717] dark:from-[#171717] dark:to-[#171717]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 dark:text-[#a8a29e] font-semibold text-lg">
                <div>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <CheckCircle className="w-5 h-5 text-white dark:text-[#0D0D0D]" />
                </div>
                </div>
              <div>
                  <div>Audio Extraction</div>
                  <div className="flex lg:flex-nowrap flex-wrap items-center gap-3">
                  <span className="text-xs text-emerald-600">Run {getCurrentActiveRunNumber('transcription')}</span>
                  <span className="text-sm text-gray-600 dark:text-[#a8a29e]">{new Date().toLocaleTimeString()}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500 text-white dark:text-[#0D0D0D] font-medium">Complete</span>
                  <span className="text-sm text-emerald-700 font-medium">100% complete</span>
                </div>
                </div>
                </div>
                
              </div>
              <div className="rounded-lg border border-emerald-100 dark:border-transparent bg-white/60 dark:bg-[#464545] backdrop-blur-md p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-[#FAFCFF]">Duration</div>
                    <div className="text-gray-800 font-medium dark:text-[#FAFCFF]">12:48 minutes</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-[#FAFCFF]">Quality</div>
                    <div className="text-gray-800 font-medium dark:text-[#FAFCFF]">High (320kbps)</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-[#FAFCFF]">Format</div>
                    <div className="text-gray-800 font-medium dark:text-[#FAFCFF]">MP3</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-[#FAFCFF]">File Size</div>
                    <div className="text-gray-800 font-medium dark:text-[#FAFCFF]">29.4 MB</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-200 dark:border-[#171717] bg-emerald-50 dark:bg-[#171717] p-4 text-sm text-[#007A55] dark:text-[#00B277] shadow-sm">
              <div className="flex flex-col items-center gap-2 justify-center text-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <div className="font-medium">Audio extraction completed successfully!</div>
                </div>
                <div>Ready to proceed with AI-powered transcription</div>
              </div>
            </div>

          </div>
        )}
        {/* Always show question generation parameter inputs for 'question' task */}
        {task === 'question' && (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex flex-row gap-2">
              {/* <div className="flex-1 flex flex-col">
                <label>Model:</label>
                <Input
                  type="text"
                  value={localParams.model}
                  onChange={e => handleParamChange("model", e.target.value)}
                  className="w-full dark:bg-[#0D0D0DCC]"
                />
              </div> */}
              {fields.map(field => (
                <div key={field} className="flex-1 flex flex-col">
                  <label>{field}:</label>
                  <Input
                    key={`input-${field}`}
                    type="number"
                    min={0}
                    value={localParams[field]}
                    onChange={e => handleParamChange(field, Number(e.target.value))}
                    className="w-full dark:bg-[#0D0D0DCC]"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col mt-2">
              <label>prompt:</label>
              <Textarea
                value={localParams.prompt}
                onChange={e => setLocalParams(p => ({ ...p, prompt: e.target.value }))}
                className="w-full min-h-[80px] dark:bg-[#0D0D0DCC]"
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

        {task === 'transcription' && (
          <>
            {audioExtractionStatus !== 'completed' && (
            <div className="w-full p-5 rounded-lg border border-[#FFD6A7] dark:border-[#202020] mb-4 bg-[linear-gradient(135deg,_#e0fff4_0%,_#f3e7ff_100%)] dark:bg-[linear-gradient(135deg,_#202020_0%,_#202020_100%)] flex items-start gap-4">
              <div className="flex items-start gap-4 w-full">
             
            <div>
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] text-white">
                <FileText className="w-6 h-6 text-white dark:text-[#0D0D0D]" />
              </div>
            </div>
          
       
            <div className="flex flex-col justify-center w-full">
          
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-gray-900 dark:text-[#a8a29e] text-lg">Audio Extraction</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-orange-500 text-white dark:text-[#0D0D0D] font-medium">
                        {audioExtractionStatus === 'processing' ? 'Processing' : 
                         (audioExtractionStatus as AudioExtractionStatus) === 'completed' ? 'Completed' :
                         audioExtractionStatus === 'failed' ? 'Failed' : 
                         audioExtractionStatus === 'paused' ? 'Paused' :
                         taskRuns.transcription.some(r => r.status === 'stopped') ? 'Stopped' : 'Ready'}
                      </span>
              </div>

               
                    {/* {aiJobId && (
            runs.some(r => r.status === "loading") ||
            runs.some(r => r.status === "stopped") ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.audioExtraction === 'RUNNING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'PENDING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'WAITING') && accordionAiJobStatus?.jobStatus?.audioExtraction !== 'FAILED') ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'WAITING') && accordionAiJobStatus?.jobStatus?.transcriptGeneration !== 'FAILED') ||
            (task === 'segmentation' && (accordionAiJobStatus?.jobStatus?.segmentation === 'RUNNING' || accordionAiJobStatus?.jobStatus?.segmentation === 'PENDING' || accordionAiJobStatus?.jobStatus?.segmentation === 'WAITING') && accordionAiJobStatus?.jobStatus?.segmentation !== 'FAILED') ||
            (task === 'question' && (accordionAiJobStatus?.jobStatus?.questionGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'WAITING') && accordionAiJobStatus?.jobStatus?.questionGeneration !== 'FAILED') ||
            (task === 'upload' && (accordionAiJobStatus?.jobStatus?.uploadContent === 'RUNNING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'PENDING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'WAITING') && accordionAiJobStatus?.jobStatus?.uploadContent !== 'FAILED')
          ) && (
              <Button
                onClick={() => handleStopTask(task)}
                variant="outline"
                disabled={runs.some(r => r.status === "stopped")}
                className="bg-red-50 dark:bg-[#464545] border-red-300 dark:border-[#4F0000] text-[#FF020E] hover:bg-red-100 hover:border-red-400 font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {runs.some(r => r.status === "stopped") ? "Task Stopped" : "Stop Task"}
              </Button>
            )} */}
                    {(audioExtractionStatus as AudioExtractionStatus) === 'completed' && (
                      <Button
                        onClick={handleStartTranscription}
                        size="sm"
                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg"
                      >
                        Start Transcription Task
                      </Button>
                    )}
                  </div>

           
                  <div className="flex lg:flex-nowrap flex-wrap items-center text-sm text-gray-600 dark:text-[#FBFDFF] lg:mb-0 mb-1">
                <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                <span>Run {getCurrentActiveRunNumber('transcription')}</span>
                </div>
              <div>
              <span className="mx-2">•</span>
              <span>{audioExtractionStartTime ? audioExtractionStartTime.toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
              </div>
                    {audioExtractionStatus !== 'ready' && audioExtractionStatus !== 'failed' && (
                      <div>
                        <span className="mx-2">✨</span>
                        <span>{Math.round((audioExtractionStatus as AudioExtractionStatus) === 'completed' ? 100 : audioExtractionProgress)}% complete</span>
                      </div>
                    )}
              </div>

               
                  {audioExtractionStatus !== 'ready' && audioExtractionStatus !== 'failed' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-[#F8FAFD]">Extraction Progress</span>
                        <span className="text-sm font-medium text-blue-600">{Math.round((audioExtractionStatus as AudioExtractionStatus) === 'completed' ? 100 : audioExtractionProgress)}%</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-[#464545] rounded-full h-2 overflow-hidden">
                        <div  
                          className="bg-gray-800 dark:bg-[#FFFFFF] h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${(audioExtractionStatus as AudioExtractionStatus) === 'completed' ? 100 : audioExtractionProgress}%` }}
                        ></div>
                      </div>
                      
                      {audioExtractionStatus === 'processing' && (
                        <div className="text-sm text-gray-600 dark:text-[#FDFEFF]">
                          Estimated time remaining: {estimatedTimeRemaining}
                        </div>
                      )}
          </div>
                  )}
                </div>
              </div>
            </div>
        )}
            {audioExtractionStatus === 'processing' && (
              <div className="w-full p-5 rounded-lg border border-[#BEDBFF] dark:border-[#181818] bg-[#EEF2FF] dark:bg-[#181818] shadow-sm">
                <div className="flex items-center justify-center gap-4">
                  
                  <div className="flex flex-col">
                 <div className="flex items-center justify-center">
                 <div className="w-8 h-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                    <span className="font-medium text-blue-600 text-base">Processing Audio</span>
                 </div>
                    <span className="text-sm text-blue-500 mt-4">
                      Our advanced algorithms are carefully extracting high-quality audio from your video...
                    </span>
                    <div className="flex items-center gap-1 mt-[18px] justify-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {task === 'segmentation' && aiJobStatus?.task === 'SEGMENTATION' && aiJobStatus?.status === 'COMPLETED' && (
            <div className="w-full rounded-xl border border-emerald-200 dark:border-[#0E7145] bg-gradient-to-r from-emerald-50 to-purple-50 p-5 shadow-sm dark:bg-[#171717] dark:from-[#171717] dark:to-[#171717]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 dark:text-[#a8a29e] font-semibold text-lg">
                  <div>
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white">
                      <CheckCircle className="w-5 h-5 text-white dark:text-[#0D0D0D]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div>AI Segmentation</div>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500 text-white dark:text-[#0D0D0D] font-medium">Complete</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-600">Run {getCurrentActiveRunNumber('segmentation')}</span>
                      <span className="text-sm text-gray-600 dark:text-[#a8a29e]">{new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
       
        {task === 'transcription' && (
          (accordionAiJobStatus?.jobStatus?.transcription === 'COMPLETED' ||
            (accordionAiJobStatus?.task === 'TRANSCRIPT_GENERATION' && accordionAiJobStatus?.status === 'COMPLETED'))
          ) ? (
            <div className="rounded-xl border border-emerald-200 dark:border-[#0E7145] bg-gradient-to-r from-emerald-50 to-purple-50 p-5 shadow-sm dark:bg-[#171717] dark:from-[#171717] dark:to-[#171717]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 dark:text-[#a8a29e] font-semibold text-lg">
                  <div>
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white">
                      <CheckCircle className="w-5 h-5 text-white dark:text-[#0D0D0D]" />
                    </div>
                  </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <div>AI Transcription</div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500 text-white dark:text-[#0D0D0D] font-medium">Complete</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-emerald-600">Run {getCurrentActiveRunNumber('transcription')}</span>
                    <span className="text-sm text-gray-600 dark:text-[#a8a29e]">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
                </div>
              </div>
            </div>
          ):(
        <div className={`flex lg:flex-nowrap flex-wrap items-center gap-3 justify-center`}>
          {task === 'transcription' && accordionAiJobStatus?.status === 'COMPLETED' && accordionAiJobStatus?.task === 'AUDIO_EXTRACTION' ? (
            <Button
              onClick={handleStartTranscription}
              variant="default"
              disabled={accordionAiJobStatus?.status !== 'COMPLETED' || accordionAiJobStatus?.task !== 'AUDIO_EXTRACTION'}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white dark:text-[#0D0D0D] font-semibold shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              < Play />
              Start Transcription Task
              <Sparkles/>
            </Button>
          ) : (
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
                  toast.success(`${title} restarted.`);
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
            className="flex items-center justify-between gap-2 bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white dark:text-[#0D0D0D] font-semibold px-4 sm:px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play />
            {runs.some(r => r.status === 'stopped') ? `Restart ${title}` :  `Start ${title}`}
            <Sparkles />
          </Button>
          )}
          {aiJobId && (
            runs.some(r => r.status === "loading") ||
            runs.some(r => r.status === "stopped") ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.audioExtraction === 'RUNNING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'PENDING' || accordionAiJobStatus?.jobStatus?.audioExtraction === 'WAITING') && accordionAiJobStatus?.jobStatus?.audioExtraction !== 'FAILED') ||
            (task === 'transcription' && (accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.transcriptGeneration === 'WAITING') && accordionAiJobStatus?.jobStatus?.transcriptGeneration !== 'FAILED') ||
            (task === 'segmentation' && (accordionAiJobStatus?.jobStatus?.segmentation === 'RUNNING' || accordionAiJobStatus?.jobStatus?.segmentation === 'PENDING' || accordionAiJobStatus?.jobStatus?.segmentation === 'WAITING') && accordionAiJobStatus?.jobStatus?.segmentation !== 'FAILED') ||
            (task === 'question' && (accordionAiJobStatus?.jobStatus?.questionGeneration === 'RUNNING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'PENDING' || accordionAiJobStatus?.jobStatus?.questionGeneration === 'WAITING') && accordionAiJobStatus?.jobStatus?.questionGeneration !== 'FAILED') ||
            (task === 'upload' && (accordionAiJobStatus?.jobStatus?.uploadContent === 'RUNNING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'PENDING' || accordionAiJobStatus?.jobStatus?.uploadContent === 'WAITING') && accordionAiJobStatus?.jobStatus?.uploadContent !== 'FAILED')
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
           {task === 'segmentation' && (
            <div className="flex flex-col sm:flex-row gap-3 items-center ml-0 sm:ml-4 bg-gray-100 dark:bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700">
              {segFields.map(({ key, type }) => (
                <div key={key} className="flex flex-col items-start min-w-0 flex-1">
                  <label
                    htmlFor={`seg-${key}`}
                    className="text-[11px] font-semibold mb-1 text-gray-700 dark:text-[#a8a29e]"
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
                    className="w-20 h-9 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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
                  toast.success('Transcription rerun started.');
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
                  toast.success('Question generation rerun started.');
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
                  toast.success('Segmentation rerun started.');
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
        )}     

        {runs.length > 0 && (
          <Accordion
            type="multiple"
            collapsible
            value={expandedAccordionItems}
            onValueChange={(newValue) => {
              const currentlyExpanded = expandedAccordionItems;
              const newlyCollapsed = currentlyExpanded.filter(id => !newValue.includes(id));
              const newlyExpanded = newValue.filter(id => !currentlyExpanded.includes(id));

              if (newlyCollapsed.length > 0) {
                setManuallyCollapsedItems(prev => {
                  const updated = [...prev, ...newlyCollapsed];
                  return updated;
                });
              }

              if (newlyExpanded.length > 0) {
                setManuallyCollapsedItems(prev => prev.filter(id => !newlyExpanded.includes(id)));
              }

              setExpandedAccordionItems(newValue);
            }}
            className="w-full"
          >
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
                const mainKeys = ["model", "SOL", "SML", "NAT", "DES"];
                const promptKey = paramKeys.find(k => k.toLowerCase() === "prompt");
                readableParams = (
                  <div className="text-sm text-gray-600 dark:text-[#a8a29e] mb-2">
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
                <AccordionItem key={run.id} value={run.id} className="border rounded my-2 last:border-b dark:bg-[#202020]">
                  <AccordionTrigger className="flex items-center gap-2 px-2 py-1">
                    <span>Run {index + 1}</span>
                    <span className="text-sm text-gray-600 dark:text-[#a8a29e]">{run.timestamp.toLocaleTimeString()}</span>
                    {getStatusIcon(run.status)}
                    {acceptedRunId === run.id && <span className="text-blue-500">Accepted</span>}
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-2">
                    {run.parameters && (
                      <div className="text-sm text-gray-600 dark:text-[#F2F8FF] flex flex-wrap gap-4 mb-2">
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
        <div className="flex items-center justify-center text-[#6A7282] dark:text-[#FFFFFF] text-[11px]">
        {/* {currentUiStep <= 2 && ( */}
          <>
          {(currentUiStep === 1 && aiJobStatus === null) &&
            <span>Extracts audio from uploaded files (video or audio) for further processing.</span>
          }
          {(currentUiStep === 1 && aiJobStatus?.task === "AUDIO_EXTRACTION") &&
            (aiJobStatus?.status === "COMPLETED" || aiJobStatus?.status === "RUNNING") && (
              <span>Extracts audio from uploaded files (video or audio) for further processing.</span>
            )
          }
          {aiJobStatus?.task === "TRANSCRIPT_GENERATION" &&
            (aiJobStatus?.status === "COMPLETED" || aiJobStatus?.status === "RUNNING") && (
              <span>Converts extracted audio into accurate text transcripts.</span>
            )}
            {aiJobStatus?.task === "SEGMENTATION" &&
            (<span>Breaks down the transcript into logical sections or chunks.</span>)}
            {aiJobStatus?.task === "QUESTION_GENERATION" &&
            (<span>Automatically generates relevant questions from the segmented transcript.</span>)}
            {aiJobStatus?.task === "UPLOAD_CONTENT" &&
            (<span>Saves and uploads the processed content with questions for later use.</span> )}
            </>
           {/* )} */}
           {/* {currentUiStep >= 2 && aiJobStatus?.task == "SEGMENTATION" && (
              WORKFLOW_STEPS.find(s => s.key === task)?.explanation || WORKFLOW_STEPS[0].explanation
            )} */}
        </div>
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

    const canSave = questionText.trim() && options.length >= 2 && options.every((o: any) => o.text.trim()) && options.some((o: any) => o.correct);

    const buildSolution = () => {
      const correctOpts = options.filter((o: any) => o.correct).map((o: any) => ({ text: o.text, explaination: o.explaination.trim() || "Nil" }));
      const incorrectOpts = options.filter((o: any) => !o.correct).map((o: any) => ({ text: o.text, explaination: o.explaination.trim() || "Nil" }));
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
              idx === idxToUpdate ? { ...run, status: 'loading', result: status } : run // Keep as 'loading' until transcription completes
            ),
          };
        });
        toast.success('Audio extraction completed!');
      }
      if (
        didMountRef.current &&
        status?.task === 'TRANSCRIPT_GENERATION' && status?.status === 'COMPLETED'
      ) {
        let completedRunId: string | null = null;
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.transcription].reverse().findIndex(run => run.status === 'loading');
          if (lastLoadingIdx === -1) return prev;
          const idxToUpdate = prev.transcription.length - 1 - lastLoadingIdx;
          const updatedRun = prev.transcription[idxToUpdate];
          completedRunId = updatedRun.id;

          return {
            ...prev,
            transcription: prev.transcription.map((run, idx) =>
              idx === idxToUpdate ? { ...run, status: 'done', result: status } : run
            ),
          };
        });

        if (completedRunId && !manuallyCollapsedItems.includes(completedRunId)) {
          setTimeout(() => {
            setExpandedAccordionItems(prevExpanded => {
              if (!prevExpanded.includes(completedRunId!)) {
                const newExpanded = [...prevExpanded, completedRunId!];
                return newExpanded;
              }
              return prevExpanded;
            });
          }, 500);
        }
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
      if (task === 'transcription' || !task) {
        setPausedProgress(audioExtractionProgress);
        setPausedStartTime(audioExtractionStartTime);
        setAudioExtractionStatus('paused');
        setEstimatedTimeRemaining('');
      }
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

    // const es = connectToLiveStatusUpdates(aiJobId, (incoming) => {

    //   setAiJobStatus((prev) => {
    //     let next: any = incoming ? { ...incoming } : incoming;
    //     const failing = optimisticFailedTaskRef.current;
    //     if (next && failing) {
    //       const ensureJobStatus = () => { next.jobStatus = { ...(next.jobStatus || {}) }; };
    //       const setTop = (taskStr: string) => { next.task = taskStr; next.status = 'FAILED'; };
    //       switch (failing) {
    //         case 'AUDIO_EXTRACTION':
    //           setTop('AUDIO_EXTRACTION');
    //           ensureJobStatus();
    //           next.jobStatus.audioExtraction = 'FAILED';
    //           break;
    //         case 'TRANSCRIPT_GENERATION':
    //           setTop('TRANSCRIPT_GENERATION');
    //           ensureJobStatus();
    //           next.jobStatus.transcriptGeneration = 'FAILED';
    //           break;
    //         case 'SEGMENTATION':
    //           setTop('SEGMENTATION');
    //           ensureJobStatus();
    //           next.jobStatus.segmentation = 'FAILED';
    //           break;
    //         case 'QUESTION_GENERATION':
    //           setTop('QUESTION_GENERATION');
    //           ensureJobStatus();
    //           next.jobStatus.questionGeneration = 'FAILED';
    //           break;
    //         case 'UPLOAD_CONTENT':
    //           setTop('UPLOAD_CONTENT');
    //           ensureJobStatus();
    //           next.jobStatus.uploadContent = 'FAILED';
    //           break;
    //       }
    //     }
    //     if (next?.status === 'FAILED' || next?.status === 'STOPPED') {
    //       optimisticFailedTaskRef.current = null;
    //     }

    //     if (next?.task === 'AUDIO_EXTRACTION') {
    //       if (next?.status === 'RUNNING') {
    //         setAudioExtractionStatus('processing');
    //       }
    //       if (next?.status === 'COMPLETED') {
    //         setAudioExtractionStatus('completed');
    //         setAudioExtractionProgress(100);
    //         setEstimatedTimeRemaining('');
    //       }
    //       if (next?.status === 'STOPPED') {
    //         setAudioExtractionStatus('ready');
    //         setAudioExtractionProgress(0);
    //         setEstimatedTimeRemaining('');
    //       }
    //     }

    //     if (next?.task === 'TRANSCRIPT_GENERATION' && next?.status === 'COMPLETED') {
    //       setTimeout(() => {
    //         setTaskRuns((prevTaskRuns: any) => {
    //           const lastLoadingIdx = [...prevTaskRuns.transcription].reverse().findIndex(run => run.status === 'loading');
    //           if (lastLoadingIdx === -1) {
    //             return prevTaskRuns;
    //           }

    //           const idxToUpdate = prevTaskRuns.transcription.length - 1 - lastLoadingIdx;
    //           const updatedRun = prevTaskRuns.transcription[idxToUpdate];
    //           const completedRunId = updatedRun.id;

    //           const updatedTaskRuns = {
    //             ...prevTaskRuns,
    //             transcription: prevTaskRuns.transcription.map((run: any, idx: number) =>
    //               idx === idxToUpdate ? { ...run, status: 'done', result: next } : run
    //             ),
    //           };

    //           if (completedRunId && !manuallyCollapsedItems.includes(completedRunId)) {

    //             setExpandedAccordionItems(prevExpanded => {
    //               if (!prevExpanded.includes(completedRunId)) {
    //                 const newExpanded = [...prevExpanded, completedRunId];
    //                 return newExpanded;
    //               }
    //               return prevExpanded;
    //             });
    //           } else {
    //             console.log('Live update: Not expanding accordion - completedRunId:', completedRunId, 'manuallyCollapsed:', manuallyCollapsedItems.includes(completedRunId));
    //           }

    //           return updatedTaskRuns;
    //         });
    //         toast.success('Transcription completed!');
    //       }, 50);
    //     }

    //     return next;
    //   });
    // });
    // return () => es.close();


    const interval=setInterval(()=>{
      handleRefreshStatus();
    },5000);

    return () => clearInterval(interval);
  }, [aiJobId, manuallyCollapsedItems]);

  useEffect(() => {
    if (!aiJobStatus) return;

    handleRefreshStatus();
  }, [aiJobStatus])

  // New: Manual trigger for transcript generation
  const handleStartTranscription = async () => {
    if (!aiJobId) return;
    try {
      let status = await aiSectionAPI.getJobStatus(aiJobId);
      setAiJobDate(status?.createdAt);
      if (status.jobStatus?.transcriptGeneration === 'PENDING') {
        await aiSectionAPI.approveContinueTask(aiJobId);
        toast.success('Approved transcript task.');
        // Immediately check status and start if now WAITING
        status = await aiSectionAPI.getJobStatus(aiJobId);
        if (status.jobStatus?.transcriptGeneration === 'WAITING') {
          await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION');
          setAiWorkflowStep('transcription');
          toast.success('Transcript generation started.');
          await handleRefreshStatus();
        } else {
          toast.info('Transcript generation is not ready to start yet.');
        }
      } else if (status.jobStatus?.transcriptGeneration === 'WAITING') {
        await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION');
        setAiWorkflowStep('transcription');
        toast.success('Transcript generation started.');
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
      <>
       {showTranscript && (
        <>
        <div className="flex items-center justify-between mt-4">
          <p className="flex items-center gap-2"><MessageSquare color="#AD46FF" size={16}/> <span className="text-[#1E2939] text-sm dark:text-[#C6D2E1]">Generated Transcript</span></p>
          <p className="flex items-center gap-2"><CircleCheckBig color="#009966" size={14}/> <span className="text-[#009966] text-xs">AI processing complete</span></p>
        </div>
          <div className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.8)_0%,_rgba(249,250,251,0.8)_100%)] backdrop-blur-md dark:bg-[linear-gradient(135deg,_rgba(58,58,61,0.8)_0%,_rgba(42,42,45,0.8)_100%)] text-gray-900 dark:text-[#F9FBFF] p-3 rounded-[14px] max-h-48 overflow-y-auto text-sm border border-[#E5E7EB] dark:border-gray-700 mt-2">
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && (
              <div className="flex lg:flex-nowrap flex-wrap-reverse items-start justify-between gap-1.5">
                <div className="mt-2 whitespace-pre-line text-[#1E2939] dark:text-[#F9FBFF] leading-[22.75px] text-[13px]">
                  {transcriptChunks
                    ? transcriptChunks.map((chunk: { text: string }) => chunk.text).join(' ')
                    : transcript}
                </div>
                  <div className="bg-[#DBEAFE] text-[#1447E6] rounded-[9px] text-[10px] py-1.5 px-2 w-full max-w-max min-w-max dark:bg-[]">
                  AI Generated
                </div>
              </div>
            )}
          </div>
          </>
        )}
      <div className="space-y-2 flex lg:flex-nowrap flex-wrap gap-2.5 items-center justify-center mt-4">
        <Button size="sm" variant="secondary" onClick={handleShowTranscript} className="bg-transparent border border-[#D1D5DC] text-[#0A0A0A] dark:text-[#a8a29e] font-medium px-4 py-2 rounded-[12px] shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showTranscript ? <EyeOff /> : <Eye />}
          {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </Button>
        {/* Edit button for transcript run */}
        <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="bg-transparent dark:bg-[#0D0D0D] border border-[#DAB2FF] dark:border-[#350067] text-[#9810FA] dark:test-[#A329FB] font-medium px-4 py-2 rounded-[12px] shadow-md hover:bg-transparent hover:shadow-lg hover:text-[#9810FA] transition-all duration-300 transform hover:scale-105 btn-beautiful">
          <Pencil />
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
                      Segment: {formatTime(chunk.timestamp[0])} - {formatTime(chunk.timestamp[1])}
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
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="mb-2 bg-[linear-gradient(90deg,_#00D492_0%,_#009966_100%)] text-white dark:text-[#0D0D0D] rounded-[12px]"
          >
            <Check />
            Accept & Continue
            <Sparkles />
          </Button>
        )}
      </div>
      </>
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

    const formatTime = (seconds: number): string => {
      if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const parseTimeToSeconds = (time: string): number => {
      if (!time) return 0;
      const cleaned = time.replace(/\[|\]/g, '').trim().replace(',', '.');
      if (cleaned.includes(':')) {
        const [mStr, sStr] = cleaned.split(':');
        const m = parseInt(mStr || '0', 10);
        const s = parseInt(sStr || '0', 10);
        if (isNaN(m)) return 0;
        if (isNaN(s)) return m * 60;
        return m * 60 + s;
      }
      if (cleaned.includes('.')) {
        const [mStr, sStrRaw] = cleaned.split('.');
        const sStr = (sStrRaw || '').slice(0, 2);
        const m = parseInt(mStr || '0', 10);
        const s = parseInt(sStr || '0', 10);
        if (isNaN(m)) return 0;
        if (isNaN(s)) return m * 60;
        return m * 60 + s;
      }
      const sOnly = parseInt(cleaned, 10);
      return isNaN(sOnly) ? 0 : sOnly;
    };
    const formatTimeInput = (value: string): string => {
      const digits = value.replace(/\D/g, '').slice(0, 4);
      if (!digits) return '';
      if (digits.length <= 2) return digits;
      const minutes = digits.slice(0, -2);
      const seconds = digits.slice(-2);
      return `${minutes}:${seconds}`;
    };
    const formatTimeDot = (seconds: number): string => {
      const mins = Math.floor(Math.max(0, seconds) / 60);
      const secs = Math.floor(Math.max(0, seconds) % 60);
      const mm = mins.toString().padStart(2, '0');
      const ss = secs.toString().padStart(2, '0');
      return `${mm}.${ss}`;
    };

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
          const normalized: number[] = (arr[0].segmentationMap as any[]).map((v: any) => {
            if (typeof v === 'number') return parseTimeToSeconds(String(v));
            if (typeof v === 'string') return parseTimeToSeconds(v);
            return 0;
          });
          setEditSegMap(normalized);
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
      const masked = formatTimeInput(value);
      let seconds = parseTimeToSeconds(masked);
      const newMap = [...editSegMap];
      const prevEnd = idx > 0 ? newMap[idx - 1] : 0;
      const nextEnd = idx < newMap.length - 1 ? newMap[idx + 1] : Number.POSITIVE_INFINITY;
      seconds = Math.max(prevEnd + 1, Math.min(seconds, nextEnd - 1));
      newMap[idx] = Math.max(0, seconds);
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
        const payloadNumbers = editSegMap.map(s => Number(formatTimeDot(s)));
        await editSegmentMap(aiJobId, payloadNumbers, 0);
        toast.success('Segment map updated successfully!');
        setEditModalOpen(false);
      } catch (e: any) {
        setEditError(e.message || 'Failed to update segment map');
      } finally {
        setEditLoading(false);
      }
    };

    return (
      <>
      {showSegmentation && (
          <div className="mt-4 space-y-4">
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {/* Enhanced display: segmentationMap + transcript chunks */}
            {!loading && !error && segmentationMap && segmentationMap.length > 0 && segmentationChunks && (
              <>
              <div className="flex items-center justify-between mt-4">
                <p className="flex items-center gap-2"><Layers color="#00C950" size={20}/> <span className="text-[#1E2939] text-sm font-bold dark:text-[#C6D2E1]">Generated Segments</span></p>
                <p className="flex items-center gap-2"><CircleCheckBig color="#009966" size={14}/> <span className="text-[#009966] text-xs">AI processing complete</span></p>
              </div>
              <div className="space-y-2">
                {segmentationMap.map((end, idx) => {
                  const start = idx === 0 ? 0 : segmentationMap[idx - 1];
                  const segChunks = segmentationChunks[idx] || [];
                  return (
                    <div key={idx} className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.8)_0%,_rgba(249,250,251,0.8)_100%)] dark:bg-[linear-gradient(135deg,_rgba(13,13,13,0.7)_0%,_rgba(13,13,13,0.7)_100%)] backdrop-blur-md border border-[#E5E7EB] dark:border-[#1F2228] p-3 rounded-[12px]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-white h-7 w-7 flex items-center justify-center bg-[linear-gradient(135deg,_#05DF72_0%,_#2B7FFF_100%)] shadow-[0px_4px_12px_rgba(0,0,0,0.1)] rounded-[10px]">{idx + 1}</span>
                        <p className="flex gap-2.5 items-center">
                          <span className="flex items-center gap-1 text-[#6A7282] dark:text-[#F4F8FF]"><Clock size={12}/>{start.toFixed(2)}s </span>
                          <span className="text-[#6A7282] dark:text-[#F6F9FF]">Duration: {end.toFixed(2)}s</span>
                        </p>
                      </div>
                      {segChunks.length > 0 ? (
                        <div className="text-xs text-[#4A5565] dark:text-[#F0F4FA] mt-2.5">
                          {(segChunks as { text: string }[]).map((chunk: { text: string }) => chunk.text).join(' ')}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              </>
            )}
            {/* Fallback: old display if no segmentationMap+chunks */}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0 || !segmentationChunks) && segments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {segments.map((seg, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-gray-200 dark:border-[#26211E] p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                    <div><b>Segment {idx + 1}</b> ({seg.startTime ?? seg.timestamp?.[0]}s - {seg.endTime ?? seg.timestamp?.[1]}s)</div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-[#a8a29e]">{seg.text}</div>
                  </div>
                ))}
              </div>
            )}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0) && segments.length === 0 && <div className="mt-2">No segments found.</div>}
          </div>
        )}
      <div className="flex lg:flex-nowrap flex-wrap gap-2.5 justify-center mt-4">
        <div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShowSegmentation}
            className="bg-transparent border border-[#D1D5DC] text-[#0A0A0A] dark:text-[#a8a29e] font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            {showSegmentation ? <EyeOff /> : <Eye />}
            {showSegmentation ? 'Hide Segmentation' : 'Show Segmentation'}
          </Button>
          {/* Edit button for segmentation run */}
          {/* <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            Edit
          </Button> */}
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
                          type="text"
                          placeholder="0:00"
                          maxLength={5}
                          value={formatTime(value)}
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
                      <div className="text-xs text-gray-600 dark:text-[#a8a29e] bg-gray-100 dark:bg-gray-800 rounded p-2 mt-1">
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
        {run.status === 'done' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="bg-transparent dark:bg-[#0D0D0D] border border-[#7BF1A8] dark:border-[#7BF1A8] text-[#00A63E] font-medium px-4 py-2 rounded-[12px] shadow-md hover:bg-transparent hover:text-[#00A63E] hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          >
            <Pencil />
            Edit Segments
          </Button>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="bg-[linear-gradient(90deg,_#00D492_0%,_#009966_100%)] text-white dark:text-[#0D0D0D] rounded-[12px]"
          >
            <Check />
            Accept This Run
            <Sparkles />
          </Button>
        )}
      </div>
      </>
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
        SOL: Number(questionGenParams.SOL),
        SML: Number(questionGenParams.SML),
        NAT: Number(questionGenParams.NAT),
        DES: Number(questionGenParams.DES),
        prompt: questionGenParams.prompt
      };
      if (hasQuestionRun) {
        // Rerun logic
        await aiSectionAPI.rerunJobTask(aiJobId, 'QUESTION_GENERATION', params);
        toast.success('Question generation rerun started.');
      } else {
        // First run logic
        await aiSectionAPI.approveStartTask(aiJobId, {
          type: 'QUESTION_GENERATION',
          parameters: params
        });
        toast.success('Question generation started.');
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
        {showQuestions && (
          <>
          <div className="flex items-center justify-between mt-4">
           <p className="flex items-center gap-2"><BookOpen color="#AD46FF" size={20}/> <span className="text-[#1E2939] text-[15px] font-bold dark:text-[#C6D2E1]">Generated Questions</span></p>
           <p className="flex items-center gap-2"><CircleCheckBig color="#009966" size={14}/> <span className="text-[#009966] text-xs">AI generation complete</span></p>
          </div>
          <div className="text-gray-900 dark:text-[#F9FBFF] p-[18px] max-h-96 overflow-y-auto text-sm mt-2">
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && questions.length > 0 && (
              <ol className="mt-2 space-y-4">
                {questions.map((q: any, idx: number) => {
                  let segIdx = segmentIds.findIndex((sid: any) => sid === q.segmentId);
                  let segStart = segIdx === 0 ? 0 : segmentIds[segIdx - 1];
                  let segEnd = q.segmentId;
                  return (
                    <li key={q.question?.text || idx} className="border border-[#E5E7EB] dark:bg-[#151516] dark:border-[#1F2228] rounded-[12px] p-[18px]">
                      <div>
                        <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="font-semibold bg-gradient-to-br from-[#C27AFF] to-[#615FFF] w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-[#ffffff] dark:text-[#000000]">{idx + 1}</div>
                          <div className="bg-[#F3E8FF] text-[#9810FA] px-[6px] py-[4px] rounded-[8px]">{q.questionType || q.question?.type || 'N/A'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Segment: {typeof segStart === 'number' && typeof segEnd === 'number' ? `${segStart}–${segEnd}s` : 'N/A'}
                          </div>
                        </div>
                        <Button className="bg-transparent border border-[#D1D5DC] text-[#0A0A0A] dark:text-[#a8a29e] font-medium px-4 py-2 rounded-[12px] shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful" size="sm" variant="secondary" onClick={() => { setEditingIdx(idx); setEditQuestion(JSON.parse(JSON.stringify(q))); setEditModalOpen(true); }}>
                          <Edit className="w-4 h-4" /> Edit
                        </Button>
                        </div>
                        <div className="flex-1 text-[13px] text-[#1E2939] dark:text-[#C6D2E1] font-medium leading-[21px] pt-[12px] pb-[14px]">{q.question?.text}</div>
                      </div>
                      {q.solution && (
                        <div className="space-y-2.5">
                          {q.solution.incorrectLotItems?.map((opt: any, oIdx: number) => (
                            <div 
                              key={`inc-${oIdx}`} 
                              className="flex items-center gap-1 p-2 rounded-[9px] bg-[#F8FAFC] dark:bg-[#3A3A3D] text-[#364153] dark:text-[#F7F9FD]"
                            >
                              <div className="flex items-center justify-center w-5 h-5 dark:border-gray-500">
                                <span className="text-[14px] text-[#364153] dark:text-[#F7F9FD]">{String.fromCharCode(65 + oIdx)}</span>
                              </div>
                              <span className="text-gray-700 dark:text-gray-300">{opt.text}</span>
                            </div>
                          ))}
                          
                          {q.solution.correctLotItems?.map((opt: any, oIdx: number) => {
                            const optionIndex = (q.solution.incorrectLotItems?.length || 0) + oIdx;
                            return (
                              <div 
                                key={`cor-${oIdx}`} 
                                className="flex items-center gap-3 p-2 rounded bg-[#B9F8CF] dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                              >
                                <div className="flex items-center justify-center w-5 h-5">
                                  <span className="text-[14px] text-[#016630] dark:text-[#141615]">{String.fromCharCode(65 + optionIndex)}</span>
                                </div>
                                <span className="text-[#016630] dark:text-green-300 font-semibold">{opt.text}</span>
                                <span className="text-[#016630] dark:text-green-400 font-bold">✓</span>
                              </div>
                            );
                          })}
                          
                          {q.solution.correctLotItem && (
                            <div className="flex items-center gap-3 p-2 rounded-[9px] bg-[#DBEAFE] text-[#016630] dark:bg-[#21F4B1] border border-[#B9F8CF] dark:border-[#0A5D27]">
                              <div className="flex items-center justify-center w-5 h-5">
                                <span className="text-[14px] text-[#016630] dark:text-[#141615]">
                                  {String.fromCharCode(65 + (q.solution.incorrectLotItems?.length || 0))}
                                </span>
                              </div>
                              <span className="text-[#016630] dark:text-[#141615]">{q.solution.correctLotItem.text}</span>
                              <span className="text-[#016630] dark:text-[#141615] font-bold">✓</span>
                            </div>
                          )}
                        </div>
                      )}
                      {q.question?.hint && <div className="mt-2.5 text-xs text-[#6A7282] dark:text-[#F6F9FF] mb-1 bg-[#ECFDF5] dark:bg-transparent p-[8px] rounded-[4px] font-medium"><span className="font-bold">Hint:</span> {q.question.hint}</div>}
                    </li>
                  );
                })}
              </ol>
            )}
            {!loading && !error && questions.length === 0 && <div className="mt-2">No questions found.</div>}
          </div>
          </>
        )}
        <div className="w-full flex lg:flex-nowrap flex-wrap items-center justify-center gap-2 mt-4">
        <Button size="sm" variant="secondary" onClick={handleShowQuestions} className="bg-transparent border border-[#D1D5DC] text-[#0A0A0A] dark:text-[#a8a29e] font-medium px-4 py-2 rounded-[12px] shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showQuestions ? <EyeOff /> : <Eye />}
          {showQuestions ? 'Hide Questions' : 'Show Questions'}
        </Button>
        {/* Export PDF Button: appears below Show Questions, opens print-friendly HTML in new tab */}
        <Button
          size="sm"
          variant="outline"
          className="bg-transparent dark:bg-[#0D0D0D] border border-[#DAB2FF] dark:border-[#350067] text-[#9810FA] font-medium px-4 py-2 rounded-[12px] shadow-md hover:bg-transparent hover:shadow-lg hover:text-[#9810FA] transition-all duration-300 transform hover:scale-105 btn-beautiful"
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
          <Share />
          Export PDF
        </Button>
        
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="mb-2 bg-[linear-gradient(90deg,_#00D492_0%,_#009966_100%)] text-white dark:text-[#0D0D0D] rounded-[12px]"
          >
            <Check />
            Accept & Continue
            <Sparkles />
          </Button>
        )}
        </div>
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
                    await aiSectionAPI.editQuestionData(aiJobId, updatedQuestions, runIndex);
                    setQuestionsByRun(prev => ({
                      ...prev,
                      [run.id]: updatedQuestions
                    }));
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

  const YoutubeIcon = () => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="auto" 
      height="28" 
      viewBox="0 0 28 28" 
      fill="currentColor" 
      className="text-red-500"
    >
      <path d="M23.498 6.186a2.998 2.998 0 0 0-2.115-2.122C19.397 3.5 12 3.5 12 3.5s-7.397 0-9.383.564A2.998 2.998 0 0 0 .502 6.186C0 8.17 0 12 0 12s0 3.83.502 5.814a2.998 2.998 0 0 0 2.115 2.122C4.603 20.5 12 20.5 12 20.5s7.397 0 9.383-.564a2.998 2.998 0 0 0 2.115-2.122C24 15.83 24 12 24 12s0-3.83-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"/>
    </svg>
  );

  const getDynamicHeading = () => {
    if (!aiJobId) {
      return {
        text: "Generate Learning Content with AI",
        gradient: "from-[#101828] via-[#6E11B0] to-[#A3004C] dark:from-[#101828] dark:via-[#FA5460] dark:to-[#A3004C]"
      };
    }

    if (!aiJobStatus) {
      return {
        text: "Generate Learning Content with AI",
        gradient: "from-[#101828] via-[#6E11B0] to-[#A3004C] dark:text-[#FA5460]"
      };
    }

    switch (aiJobStatus?.task) {
      case 'AUDIO_EXTRACTION':
        if (aiJobStatus.status === 'RUNNING') {
          return {
            text: "Extracting Audio from Video",
            gradient: "from-[#101828] via-[#193CB8] to-[#6E11B0]"
          };
        } else if (aiJobStatus.status === 'COMPLETED') {
          return {
            text: "Audio Successfully Extracted",
            gradient: "from-[#101828] via-[#006045] to-[#193CB8]"
          };
        }
        return {
          text: "Extract Audio from Video",
          gradient: "from-blue-600 via-indigo-600 to-purple-600"
        };
      
      case 'TRANSCRIPT_GENERATION':
        return {
          text: "Convert Speech to Text",
          gradient: "from-[#101828] via-[#193CB8] to-[#6E11B0]"
        };
      
      case 'SEGMENTATION':
        return {
          text: "Organize Content into Sections",
          gradient: "from-[#101828] via-[#006045] to-[#193CB8]"
        };
      
      case 'QUESTION_GENERATION':
        return {
          text: "Generate Learning Questions",
          gradient: "from-[#101828] via-[#193CB8] to-[#6E11B0]"
        };
      
      case 'UPLOAD_CONTENT':
        return {
          text: "Publish Your Learning Module",
          gradient: "from-[#101828] via-[#006045] to-[#193CB8]"
        };
      
      default:
        return {
          text: "Generate Learning Content with AI",
          gradient: "from-[#101828] via-[#6E11B0] to-[#A3004C]"
        };
    }
  };

  const getBadgeConfig = () => {
    if (!aiJobId || !aiJobStatus) {
      return {
        text: "AI-Powered Processing",
        icon: <Brain size={16} />,
        bgGradient: "bg-[#F3E8FF]",
        textColor: "text-[#8200DB]",
        subtitle: "Transform your YouTube content into interactive learning materials using advanced artificial intelligence"
      };
    }
  
    switch (aiJobStatus.task) {
      case 'AUDIO_EXTRACTION':
        return {
          text: aiJobStatus.status === 'RUNNING' ? "Step 1: Processing Audio" : "Step 1: Audio Extraction Complete",
          icon: aiJobStatus.status === 'RUNNING' ? <FileMusic size={16} /> : <CheckCircle size={16} />,
          bgGradient: aiJobStatus.status === 'RUNNING' ? "bg-[#DBEAFE]" : "bg-[#D0FAE5]",
          textColor: aiJobStatus.status === 'RUNNING' ? "text-[#1447E6]" : "text-[#007A55]",
          subtitle: aiJobStatus.status === 'RUNNING' ? "Processing your YouTube video with advanced algorithms to extract high-quality audio" : "High-quality audio has been extracted from your video and is ready for transcription",
        };
      
      case 'TRANSCRIPT_GENERATION':
        return {
          text: "Step 2: AI Transcription",
          icon: <MessageSquare size={16} />,
          bgGradient: "bg-[#F3E8FF]",
          textColor: "text-[#8200DB]",
          subtitle: "Advanced AI-powered transcription that converts your audio into accurate, readable text"
        };
      
      case 'SEGMENTATION':
        return {
          text: "Step 3: Content Segmentation",
          icon: <Layers size={16} />,
          bgGradient: "bg-[#DBEAFE]",
          textColor: "text-[#008236]",
          subtitle: "Intelligently break down your transcript into meaningful sections for better learning structure"
        };
      
      case 'QUESTION_GENERATION':
        return {
          text: "Step 4: Question Generation",
          icon: <Brain size={16} />,
          bgGradient: "bg-[#F3E8FF]",
          textColor: "text-[#8200DB]",
          subtitle: "AI-powered question generation to create engaging assessments from your content"
        };
      
      case 'UPLOAD_CONTENT':
        return {
          text: "Step 5: Upload & Share",
          icon: <Upload size={16} />,
          bgGradient: "bg-[#D0FAE5]",
          textColor: "text-[#007A55]",
          subtitle: "Complete your AI-generated learning module and share it with the world"
        };
      
      default:
        return {
          text: "AI-Powered Processing",
          icon: <Brain size={16} />,
          bgGradient: "bg-[#F3E8FF]",
          textColor: "text-[#8200DB]",
          subtitle: "Transform your YouTube content into interactive learning materials using advanced artificial intelligence"
        };
    }
  };
  
  const heading = getDynamicHeading();
  const badge = getBadgeConfig();

  // Render the AI workflow UI and the quiz question editor
  return ( 
    <>
      <div className="mb-4">
        <Button className="bg-primary text-primary-foreground" onClick={() => navigate({ to: "/teacher/courses/view" })}>Back</Button>
      </div>
      <div className="max-w-6xl w-full mx-auto px-2 sm:px-4">
        {/* AI Section Workflow Inline */}
        <div className="bg-white dark:bg-[#202020] rounded-xl shadow-lg border border-gray-200 dark:border-[#26211E] p-4 sm:p-6 lg:p-8 mb-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-3">
              <div className={`rounded-3xl flex items-center justify-center gap-2 ${badge.bgGradient} ${badge.textColor} text-[11px] px-3.5 py-2 w-fit`}>
                {badge.icon}
                {badge.text}
              </div>
            </div>
            <h1 className={`text-3xl font-bold mb-3 bg-gradient-to-r ${heading.gradient} bg-clip-text text-transparent`}>
              {heading.text}
            </h1>
            <p className="text-[#4A5565] dark:text-[#F9FCFF] text-base">
              {badge.subtitle}
            </p>
          </div>
          {/* Stepper */}
          <Stepper jobStatus={aiJobStatus} />
            {aiJobStatus && (
              <div className="flex items-center gap-2.5 shadow-xl backdrop-blur bg-white/80 dark:bg-[#464545] border border-gray-200 dark:border-[#26211E] rounded-[14px] py-2.5 px-4 w-max mb-3.5 text-sm text-gray-900 dark:text-[#a8a29e]">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  aiJobStatus.status === 'RUNNING' ? 'bg-blue-500' :
                  aiJobStatus.status === 'COMPLETED' ? 'bg-green-500' :
                  aiJobStatus.status === 'FAILED' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`}></div>
                <span className="font-normal dark:text-[#FBFDFF]">
                  Job Status: {aiJobStatus.status === 'RUNNING' ? 'Processing' :
                        aiJobStatus.status === 'COMPLETED' ? 'Completed' :
                        aiJobStatus.status === 'FAILED' ? 'Failed' :
                        'Pending'}
                </span>
                {aiJobDate && (
                  <span className="ml-2 px-3 py-1 rounded-md bg-green-50 dark:bg-[#171717] text-[#6A7282] dark:text-[#F8FAFF] text-xs font-medium">
                    Created {new Date(aiJobDate).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                )}
              </div>
            )}
          <div className="space-y-8">
            <div className="flex lg:flex-nowrap flex-wrap items-center gap-6">
              <div className="flex items-center gap-2.5 shadow-xl backdrop-blur bg-white/80 dark:bg-[#464545] border border-gray-200 dark:border-[#0D0D0D33] rounded-[14px] p-[15px] w-full">
                <div><YoutubeIcon /></div>
                <div className="flex flex-col w-full">
                  <label className="text-[11px] font-medium text-gray-900 dark:text-[#C6D2E1] mb-1">Source Video</label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="Paste YouTube URL here"
                    className={`text-[11px] px-1.5 py-[3px] rounded-lg bg-[#ECFDF5] dark:bg-[#202020] text-gray-800 dark:text-[#FFFFFF] border border-transparent focus:outline-none w-full ${
                      urlError ? 'border-red-500 bg-red-50 text-red-700' : ''
                    }`}
                    disabled={!!aiJobId}
                  />
                  {urlError && (
                    <p className="mt-1 text-xs text-red-600">{urlError}</p>
                  )}
                </div>
            </div>
            <Button
                onClick={handleCreateJob}
                disabled={!youtubeUrl || !!aiJobId || isCreatingJob}
                className="w-full sm:w-auto mt-2 sm:mt-0 bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white dark:text-[#0D0D0D] font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
              >
                {isCreatingJob ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Creating Job...
                  </>
                ) : aiJobId ? (
                  "Job Created"
                ) : (
                  "Create AI Job"
                )}
              </Button>
            </div>

            {/* <div className="flex flex-col sm:flex-row gap-6 items-center w-full mt-4">
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
                disabled={!youtubeUrl || !!aiJobId || isCreatingJob}
                className="w-full sm:w-auto mt-2 sm:mt-0 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
              >
                {isCreatingJob ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Creating Job...
                  </>
                ) : aiJobId ? (
                  "Job Created"
                ) : (
                  "Create AI Job"
                )}
              </Button>
            </div> */}

            {/* Navigation to ai workflow */}
            {/* <Link to="/teacher/ai-workflow">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2">
                <Workflow className="w-5 h-5" />
                Go to AI Workflow
              </Button>
            </Link> */}


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
                  {currentUiStep === 1 && (
                    <div className=" shadow-xl backdrop-blur bg-white/80 dark:bg-[#504F4FCC] border border-gray-200 dark:border-[#26211E] rounded-[14px] p-[15px] w-full">
                      <div className="flex items-center gap-3.5 mb-7">
                        <div>
                          <div className="bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] h-12 w-12 rounded-[14px] flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white dark:text-[#0D0D0D]" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-xl text-gray-900 dark:text-[#C6D2E1]">Audio Extraction</p>
                          <span className="font-normal text-xs text-[#4A5565] dark:text-[#F6FAFF]">Extract high-quality audio from your video</span>
                        </div>
                        {/* <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {(currentUiStep === 1 && aiJobStatus === null) &&
                                <span>Extracts audio from uploaded files (video or audio) for further processing.</span>
                              }
                              {(currentUiStep === 1 && aiJobStatus?.task === "AUDIO_EXTRACTION") &&
                                (aiJobStatus?.status === "COMPLETED" || aiJobStatus?.status === "RUNNING") && (
                                  <span>Extracts audio from uploaded files (video or audio) for further processing.</span>
                                )
                              }
                              {aiJobStatus?.task === "TRANSCRIPT_GENERATION" &&
                                (aiJobStatus?.status === "COMPLETED" || aiJobStatus?.status === "RUNNING") && (
                                  <span>Converts extracted audio into accurate text transcripts.</span>
                                )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider> */}
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
                        expandedAccordionItems={expandedAccordionItems}
                        setExpandedAccordionItems={setExpandedAccordionItems}
                      />
                      {acceptedRuns.transcription && (
                        <div className="flex justify-center mt-4">
                          <Button className="bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white dark:text-[#0D0D0D]" onClick={() => setCurrentUiStep(2)}>Next Step</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Segmentation Section */}
                  {
                    currentUiStep === 2 && (
                      <div className="shadow-xl backdrop-blur bg-white/80 dark:bg-[#151516] border border-gray-200 rounded-[14px] p-[15px] w-full dark:border-[#26211E]">
                      <div className="flex items-center gap-3.5 mb-7">
                        <div>
                          <div className="bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] h-12 w-12 rounded-[14px] flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white dark:text-[#0D0D0D]" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-xl text-gray-900 dark:text-[#C6D2E1]">AI Segmentation</p>
                          <span className="font-normal text-xs text-[#4A5565] dark:text-[#FCFDFF]">Break content into meaningful sections</span>
                        </div>
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
                          expandedAccordionItems={expandedAccordionItems}
                          setExpandedAccordionItems={setExpandedAccordionItems}
                        />
                        {acceptedRuns.segmentation && currentUiStep === 2 && (
                          <div className="flex justify-end mt-4">
                            <Button className="bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white dark:text-[#0D0D0D]" onClick={() => setCurrentUiStep(3)}>Next Step</Button>
                          </div>
                        )}
                      </div>
                    )
                  }
                  {/* Question Generation Section */}
                  {
                    currentUiStep === 3 && (
                      <div className="shadow-xl backdrop-blur bg-white/80 dark:bg-[#151516] border border-gray-200 rounded-[14px] p-[15px] w-full dark:border-[#26211E]">
                        <div className="mb-4">
                          <div className="flex items-center gap-3.5 mb-7">
                            <div>
                              <div className="bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] h-12 w-12 rounded-[14px] flex items-center justify-center">
                                <Brain className="w-6 h-6 text-white dark:text-[#0D0D0D]" />
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-xl text-gray-900 dark:text-[#C6D2E1]">Question Generation Test</p>
                              <span className="font-normal text-xs text-[#4A5565] dark:text-[#FCFDFF]">Automatically generates relevant questions from the segmented transcript.</span>
                            </div>
                          </div>
                          {
                            aiJobStatus?.task === 'QUESTION_GENERATION' && aiJobStatus?.status === 'COMPLETED' && (
                              <div className="w-full rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-purple-50 dark:bg-[#171717] dark:from-[#171717] dark:to-[#171717] p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2 text-gray-900 dark:text-[#a8a29e] font-semibold text-lg">
                                    <div>
                                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white">
                                        <CheckCircle className="w-5 h-5 text-white dark:text-[#0D0D0D]" />
                                      </div>
                                    </div>
                                  <div>
                                    <div className="flex items-center gap-2.5">
                                      <div>AI Question Generation</div>
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500 text-white dark:text-[#0D0D0D] font-medium">Complete</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-emerald-600">Run {getCurrentActiveRunNumber('question')}</span>
                                      <span className="text-sm text-gray-600 dark:text-[#a8a29e]">{new Date().toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          {/* <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{WORKFLOW_STEPS.find(step => step.key === 'questionGeneration')?.explanation}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider> */}
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
                          expandedAccordionItems={expandedAccordionItems}
                          setExpandedAccordionItems={setExpandedAccordionItems}
                        />
                        {acceptedRuns.question && (
                          <div className="flex justify-end mt-4">
                            <Button className="bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white dark:text-[#0D0D0D]" onClick={() => setCurrentUiStep(4)}>Next Step</Button>
                          </div>
                        )}
                      </div>
                    )}
                  {/* Upload Section */}
                  {/* {
                  currentUiStep === 4 && (
                <div className="bg-gray-50 dark:bg-card rounded-xl p-6 shadow-lg border border-gray-200 dark:border-[#26211E] w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-xl text-gray-900 dark:text-[#C6D2E1]">Upload to Course</span>
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
                    expandedAccordionItems={expandedAccordionItems}
                    setExpandedAccordionItems={setExpandedAccordionItems}
                  />
                </div>
                  )} */}

                  {
                    currentUiStep === 4 && (
                      <div className="shadow-xl backdrop-blur bg-white/80 dark:bg-[#151516] border border-gray-200 rounded-[14px] p-[15px] w-full dark:border-[#26211E]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center gap-3.5 mb-7">
                            <div>
                            <div className="bg-[linear-gradient(90deg,#00D492_0%,#2B7FFF_100%)] h-12 w-12 rounded-[14px] flex items-center justify-center">
                              <Share className="w-6 h-6 text-white dark:text-[#0D0D0D]"/>
                            </div>
                            </div>
                            <div>
                              <p className="font-semibold text-xl text-gray-900 dark:text-[#C6D2E1]">Upload & Publish</p>
                              <span className="font-normal text-xs text-[#4A5565] dark:text-[#FCFDFF]">Saves and uploads the processed content with questions for later use.</span>
                            </div>
                          </div>
                          {/* <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{WORKFLOW_STEPS.find(step => step.key === 'uploadContent')?.explanation}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider> */}
                        </div>

                        {/* Simplified upload form */}
                        <div className="flex flex-col gap-4 mb-4">
                          <div className="flex flex-col">
                            <label className="font-medium mb-1">Video Item Base Name</label>
                            <Input
                              value="video_item"
                              readOnly
                              className="w-full bg-gray-100 dark:bg-[#3A3A3D] cursor-not-allowed"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="font-medium mb-1">Quiz Item Base Name</label>
                            <Input
                              value="quiz_item"
                              readOnly
                              className="w-full bg-gray-100 dark:bg-[#3A3A3D] cursor-not-allowed"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="font-medium mb-1">Questions Per Quiz</label>
                            <Input
                              type="number"
                              value={1}
                              readOnly
                              className="w-full bg-gray-100 dark:bg-[#3A3A3D] cursor-not-allowed"
                            />
                          </div>
                        </div>
                        <div className="w-full flex items-center justify-center">
                        <Button
                          onClick={async () => {
                            if (!aiJobId) return;
                            try {
                              // Use the simplified parameters as shown in the image
                              const params = {
                                videoItemBaseName: "video_item",
                                quizItemBaseName: "quiz_item",
                                questionsPerQuiz: 1
                              };

                              setTaskRuns(prev => ({
                                ...prev,
                                upload: [...prev.upload, {
                                  id: `run-${Date.now()}-${Math.random()}`,
                                  timestamp: new Date(),
                                  status: 'loading',
                                  parameters: params
                                }]
                              }));

                              await aiSectionAPI.postJobTask(aiJobId, 'UPLOAD_CONTENT', params);

                              setTaskRuns(prev => ({
                                ...prev,
                                upload: prev.upload.map(run =>
                                  run.status === 'loading' ? { ...run, status: 'done' } : run
                                )
                              }));

                              toast.success('Section successfully uploaded to course!');
                            } catch (error) {
                              setTaskRuns(prev => ({
                                ...prev,
                                upload: prev.upload.map(run =>
                                  run.status === 'loading' ? { ...run, status: 'failed' } : run
                                )
                              }));
                              toast.error('Upload to course failed.');
                            }
                          }}
                          disabled={!acceptedRuns.question || taskRuns.upload.some(r => r.status === "loading")}
                          className="w-auto bg-[linear-gradient(90deg,#00D492_0%,#2B7FFF_100%)] text-white dark:text-[#0D0D0D] font-normal px-6 py-3 rounded-[14px] shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
                        >
                          <Share />
                          Publish Learning Module
                          <Sparkles />
                        </Button>
                        </div>

                        {/* Upload Success Message */}
                        {taskRuns.upload.some(run => run.status === "done") && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-xl p-6 shadow-lg mt-4">
                            <div className="flex items-center gap-3 mb-3">
                              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                              <span className="font-semibold text-lg text-green-800 dark:text-green-200">Upload Successful!</span>
                            </div>
                            <p className="text-green-700 dark:text-green-300 mb-4">
                              Your AI-generated section has been successfully uploaded to the course.
                            </p>
                            <Button
                              onClick={() => {
                                // Navigate back to the course view
                                navigate({ to: "/teacher/courses/view" });
                              }}
                              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 btn-beautiful"
                            >
                              <UploadCloud className="w-4 h-4 mr-2" />
                              View Course
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  }

                  {/* Upload Success Message - Show outside accordion when upload is completed */}
                  {/* {taskRuns.upload.some(run => run.status === "done") && (
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
                  )} */}
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </>
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


