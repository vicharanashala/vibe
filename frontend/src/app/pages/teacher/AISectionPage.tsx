import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI, JobStatus, getApiUrl } from "@/lib/genai-api";
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
  BookOpen,
  RotateCcw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCourseStore } from "@/store/course-store";
import { useNavigate } from "@tanstack/react-router";

// Enhanced question types to match backend
type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed" | "stopped";
  result?: any;
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
  model?: string;
  SOL: number;
  SML: number;
  NAT: number;
  DES: number;
  BIN: number;
  numberOfQuestions: number;
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
    if (status === 'waiting') return 'waiting';
    if (status === 'working' || status === 'pending') return 'pending';
    return 'pending';
  }
}


const Stepper = React.memo(({
  jobStatus,
  activeStep,
  progress,
  audioExtractionProgress
}: {
  jobStatus: any,
  activeStep: string | null,
  progress: number,
  audioExtractionProgress: number
}) => {

  // Calculate progress based on completed steps
  const getStepProgress = () => {
    if (!jobStatus) return 0;
    const taskToStep: Record<string, string> = {
      'AUDIO_EXTRACTION': 'audioExtraction',
      'TRANSCRIPT_GENERATION': 'transcriptGeneration',
      'SEGMENTATION': 'segmentation',
      'QUESTION_GENERATION': 'questionGeneration',
      'UPLOAD_CONTENT': 'uploadContent',
    };
    const stepOrder = ['audioExtraction', 'transcriptGeneration', 'segmentation', 'questionGeneration', 'uploadContent'];
    const currentTaskStep = taskToStep[jobStatus.task] || null;
    if (!currentTaskStep) return 0;

    const currentIndex = stepOrder.indexOf(currentTaskStep);
    if (currentIndex === -1) return 0;

    // Base progress from completed steps: 4 intervals for 5 steps = 25% each
    const baseProgress = currentIndex * 25;
    
    // Add partial progress of the current step (max 25% towards next dot)
    let stepPartialProgress = 0;
    if (jobStatus.task === 'AUDIO_EXTRACTION') {
      stepPartialProgress = audioExtractionProgress;
    } else {
      stepPartialProgress = progress;
    }
    
    const additionalProgress = (stepPartialProgress / 100) * 25;
    
    return Math.min(baseProgress + additionalProgress, 100);
  };

  const progressPercentage = getStepProgress();

  return (
    <div className="relative mb-12 px-1 sm:px-4">
      {/* Single continuous progress line - Centered with dots */}
      <div className="absolute left-6 right-6 top-[18px] sm:top-[22px] h-1 bg-gray-200 dark:bg-[#26211E] rounded-full overflow-hidden">
        {progressPercentage > 0 && (
          <div 
            className="h-full bg-gradient-to-r from-[#00D492] to-[#2B7FFF] transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        )}
      </div>
      
      <div className="flex items-start relative z-10 justify-between gap-0.5 sm:gap-2">
      {WORKFLOW_STEPS.map((step) => {
        const status = getStepStatus(jobStatus, step.key);
        const isActive = status === 'active' || (step.key === activeStep && status !== 'completed' && status !== 'failed' && status !== 'stopped');

        return (
          <React.Fragment key={step.key}>
            <div className="relative flex flex-col items-center min-w-0 flex-1">
          <div className="flex flex-col items-center w-full">
             {/* Step Circle */}
          <div className={`
      relative flex items-center justify-center
      w-9 h-9 sm:w-11 sm:h-11 rounded-[14px] transition-all duration-300 z-10
      ${status === 'completed' 
        ? 'bg-[linear-gradient(135deg,_#00D492_0%,_#009966_100%)] text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
        : isActive 
          ? 'bg-[linear-gradient(135deg,_#51A2FF_0%,_#9810FA_100%)] text-white shadow-lg ring-4 ring-blue-200' 
          : status === 'failed' 
            ? 'bg-red-500 text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
            : status === 'stopped' 
              ? 'bg-[linear-gradient(135deg,_#FF8904_0%,_#F6339A_100%)] text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)]' 
              : status === 'waiting'
                ? 'bg-[linear-gradient(135deg,_#7C3AED_0%,_#C026D3_100%)] text-white shadow-lg'
                : 'bg-gray-200 dark:bg-[#464545] text-gray-600 dark:text-[#FFFFFF]'}
    `}>
                      {status === 'completed' ? (
                        <CheckCircle className="w-3 h-3 sm:w-6 sm:h-6 dark:text-[#0D0D0D]" />
                      ) : isActive ? (
                        <span className="text-xs sm:text-base">{step.icon}</span>
                      ) : status === 'failed' ? (
                        <XCircle className="w-3 h-3 sm:w-6 sm:h-6" />
                      ) : status === 'stopped' ? (
                        <PauseCircle className="w-3 h-3 sm:w-6 sm:h-6" />
                      ) : status === 'waiting' ? (
                        <Clock className="w-3 h-3 sm:w-6 sm:h-6 animate-pulse" />
                      ) : (
                        <span className="font-medium text-xs sm:text-base">{step.icon}</span>
    )}
    {isActive && <div className="absolute -top-0.5 -right-0.5 sm:-top-1.5 sm:-right-1 bg-[#2B7FFF] rounded-full h-3 w-3 sm:h-5 sm:w-5 flex items-center justify-center"><Loader2 className="w-1.5 h-1.5 sm:w-3 sm:h-3 animate-spin text-white dark:text-[#0D0D0D]" /></div>}
    {status === 'completed' && <div className="absolute -top-0.5 -right-0.5 sm:-top-1.5 sm:-right-1 bg-[#00BC7D] rounded-full h-3 w-3 sm:h-5 sm:w-5 flex items-center justify-center"><Sparkles className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-white dark:text-[#0D0D0D]" /></div>}
  </div>

  {/* Step Label */}
  <div className="mt-1 sm:mt-2 flex flex-col items-center w-full px-0 sm:px-1">
    <div className={`text-[9px] lg:text-sm sm:text-xs md:text-[10px] font-medium text-center leading-tight max-w-full break-words
        ${status === 'completed' 
          ? 'text-[#009966]' 
          : isActive 
            ? 'text-[#155DFC]' 
            : status === 'failed' 
              ? 'text-red-600' 
              : status === 'stopped' 
                ? 'text-[#F54900]' 
                : status === 'waiting'
                  ? 'text-purple-600 animate-pulse'
                  : 'text-[#6A7282] dark:text-[#FFFFFF]'}
      `}>
      {step.label}
    </div>

    {/* Status Text */}
    <div className="mt-0.5 sm:mt-1 h-3 sm:h-4 text-[9px] sm:text-xs">
      {isActive && <span className="text-[#2B7FFF] dark:text-blue-400 bg-[#EEF2FF] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><Zap size={8} className="text-yellow-500 dark:text-yellow-400 sm:w-3.5 sm:h-3.5"/> <span className="hidden lg:inline">Processing</span><span className="sm:hidden">Proc</span></span>}
      {status === 'completed' && <span className="text-[#00BC7D] dark:text-green-400 bg-[#ECFDF5] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><Check size={8} className="text-green-600 dark:text-green-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Complete</span><span className="sm:hidden">Done</span></span>}
      {status === 'failed' && <span className="text-red-600 dark:text-red-400 bg-[#ffe9ea] dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><X size={8} className="text-red-600 dark:text-red-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Failed</span><span className="sm:hidden">Fail</span></span>}
      {status === 'stopped' && <span className="text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><PauseCircle size={8} className="text-orange-600 dark:text-orange-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Stopped</span><span className="sm:hidden">Stop</span></span>}
      {status === 'waiting' && <span className="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-[#171717] py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-[6px] sm:rounded-[10px] flex gap-0.5 sm:gap-1 items-center"><Clock size={8} className="text-purple-600 dark:text-purple-400 sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Waiting</span><span className="sm:hidden">Wait</span></span>}
    </div>
  </div>
  </div>
</div>


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

const TaskAccordionInternal = ({
  task,
  runs,
  title,
  acceptedRunId,
  handleRefreshStatus,
  aiJobStatus,
  aiJobId,
  handleAcceptRun,
  canRunTask,
  handleTask,
  localParams,
  setLocalParams,
  localSegParams,
  setLocalSegParams,
  rerunParams,
  setRerunParams,
  progress,
  handleStartTranscription,
  // Props previously captured from closure:
  audioExtractionStatus,
  audioExtractionProgress,
  setCurrentUiStep,
  getStatusIcon,
}: any) => {
  const fields = ["model", "SOL", "SML", "NAT", "DES", "BIN", "numberOfQuestions"];
  const segFields = [
    { key: 'lam', type: 'number' },
    { key: 'runs', type: 'number' },
  ];

  const handleParamChange = useCallback((
    field: string,
    value: string | number
  ) => {
    setLocalParams((prev: any) => ({
      ...prev,
      [field]: value
    }));
  }, [setLocalParams]);

  return (
    <div className="bg-white dark:bg-[#1A1A1C] border border-gray-200 dark:border-[#2D2D2F] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${
            task === 'transcription' ? 'from-blue-500/10 to-blue-600/10 text-blue-600' :
            task === 'segmentation' ? 'from-purple-500/10 to-purple-600/10 text-purple-600' :
            task === 'question' ? 'from-orange-500/10 to-orange-600/10 text-orange-600' :
            'from-green-500/10 to-green-600/10 text-green-600'
          }`}>
            {task === 'transcription' && <FileText className="w-6 h-6" />}
            {task === 'segmentation' && <Layers className="w-6 h-6" />}
            {task === 'question' && <Brain className="w-6 h-6" />}
            {task === 'upload' && <UploadCloud className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
            {task === 'transcription' && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  audioExtractionStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  audioExtractionStatus === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {audioExtractionStatus === 'processing' ? 'Processing Audio...' : 
                   audioExtractionStatus === 'completed' ? 'Audio Ready' : 
                   audioExtractionStatus === 'paused' ? 'Paused' : 'Waiting'}
                </span>
                {audioExtractionStatus === 'processing' && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">{Math.round(audioExtractionProgress)}%</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            variant="outline"
            onClick={handleRefreshStatus}
            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Task Progress (if active) */}
      {((task === 'transcription' && audioExtractionStatus === 'processing') || 
        ((aiJobStatus?.status === 'RUNNING' || aiJobStatus?.status === 'PENDING') && (
          (task === 'transcription' && (aiJobStatus?.task === 'TRANSCRIPT_GENERATION' || aiJobStatus?.jobStatus?.transcriptGeneration === 'RUNNING')) ||
          (task === 'segmentation' && (aiJobStatus?.task === 'SEGMENTATION' || aiJobStatus?.jobStatus?.segmentation === 'RUNNING')) ||
          (task === 'question' && (aiJobStatus?.task === 'QUESTION_GENERATION' || aiJobStatus?.jobStatus?.questionGeneration === 'RUNNING'))
        ))) && (
        <div className="mb-6 bg-gray-50 dark:bg-[#252527] rounded-xl p-4 border border-gray-100 dark:border-[#2D2D2F]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-[#a8a29e]">Current Progress</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {task === 'transcription' && audioExtractionStatus === 'processing' ? Math.round(audioExtractionProgress) : Math.round(progress)}%
            </span>
          </div>
          <Progress value={task === 'transcription' && audioExtractionStatus === 'processing' ? audioExtractionProgress : progress} className="h-2 rounded-full" />
        </div>
      )}

      {/* Setup Parameters (if no runs yet) */}
      {runs.length === 0 && (
        <div className="space-y-4">
          {task === 'transcription' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Language</label>
                <select 
                  value={rerunParams.language}
                  onChange={(e) => setRerunParams((prev: any) => ({ ...prev, language: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-[#252527] border border-gray-200 dark:border-[#2D2D2F] rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Model</label>
                <select 
                  value={rerunParams.modelSize}
                  onChange={(e) => setRerunParams((prev: any) => ({ ...prev, modelSize: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-[#252527] border border-gray-200 dark:border-[#2D2D2F] rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="default">Default</option>
                  <option value="large-v3">Large-v3 (Accurate)</option>
                  <option value="medium">Medium</option>
                  <option value="small">Small (Fast)</option>
                </select>
              </div>
            </div>
          )}

          {task === 'segmentation' && (
            <div className="grid grid-cols-2 gap-4">
              {segFields.map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">{f.key}</label>
                  <Input 
                    type="number"
                    value={localSegParams[f.key]}
                    onChange={(e) => setLocalSegParams((prev: any) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    className="bg-gray-50 dark:bg-[#252527] border-gray-200 dark:border-[#2D2D2F]"
                  />
                </div>
              ))}
            </div>
          )}

          {task === 'question' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {fields.filter(f => f !== 'model' && f !== 'prompt').map(f => (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">{f}</label>
                    <Input 
                      type="number"
                      value={localParams[f]}
                      onChange={(e) => handleParamChange(f, Number(e.target.value))}
                      className="h-9 text-xs bg-gray-50 dark:bg-[#252527] border-gray-200 dark:border-[#2D2D2F]"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">System Prompt</label>
                <Textarea 
                  value={localParams.prompt}
                  onChange={(e) => handleParamChange('prompt', e.target.value)}
                  className="min-h-[80px] text-sm bg-gray-50 dark:bg-[#252527] border-gray-200 dark:border-[#2D2D2F]"
                />
              </div>
            </div>
          )}

          <Button
            onClick={() => handleTask(task, localSegParams, localParams)}
            disabled={!canRunTask(task) || (task === 'transcription' && audioExtractionStatus === 'processing')}
            className="w-full py-6 rounded-2xl bg-gradient-to-r from-[#00D492] to-[#2B7FFF] text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50"
          >
            {task === 'transcription' && audioExtractionStatus === 'processing' ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Extracting Audio...</span>
            ) : (
              <span className="flex items-center gap-2"><Zap className="w-5 h-5" /> Start {title}</span>
            )}
          </Button>
        </div>
      )}

      {/* Existing Runs */}
      {runs.length > 0 && (
        <Accordion type="multiple" value={runs.map((r: any) => r.id)} className="space-y-3">
          {runs.map((run: any, index: number) => (
            <AccordionItem key={run.id} value={run.id} className="border border-gray-200 dark:border-[#2D2D2F] rounded-xl overflow-hidden bg-gray-50/30 dark:bg-[#1A1A1C]/30">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/30">
                <div className="flex items-center gap-3 w-full text-left">
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Run #{index + 1}</span>
                      {acceptedRunId === run.id && (
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">Accepted</span>
                      )}
                    </div>
                  </div>
                  <div className="mr-4">
                    {getStatusIcon(run.status)}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-[#2D2D2F]">
                {run.status === "done" && (
                  <div className="space-y-4">
                    {task === "segmentation" ? (
                      <>
                        <RunSegmentationSection 
                          aiJobId={aiJobId} 
                          run={run} 
                          acceptedRunId={acceptedRunId} 
                          onAccept={() => handleAcceptRun(task, run.id)} 
                          runIndex={index}
                          aiJobStatus={aiJobStatus}
                        />
                      </>
                    ) : task === "question" ? (
                      <RunQuestionSection aiJobId={aiJobId} run={run} acceptedRunId={acceptedRunId} onAccept={() => handleAcceptRun(task, run.id)} runIndex={index} />
                    ) : (
                      <RunTranscriptSection aiJobId={aiJobId} run={run} acceptedRunId={acceptedRunId} onAccept={() => handleAcceptRun(task, run.id)} runIndex={index} />
                    )}
                    
                    {acceptedRunId !== run.id && (
                      <Button 
                        onClick={() => handleAcceptRun(task, run.id)}
                        className="w-full mt-4 bg-gray-900 dark:bg-white dark:text-gray-900 font-bold py-2 rounded-xl text-sm"
                      >
                        Accept This Version
                      </Button>
                    )}
                  </div>
                )}
                {run.status === "loading" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 text-xs rounded-lg border border-blue-100 dark:border-blue-900/20">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {task === 'transcription' && audioExtractionStatus === 'processing' ? 'Extracting audio from video...' :
                         task === 'transcription' && audioExtractionStatus === 'completed' && aiJobStatus?.jobStatus?.transcriptGeneration === 'RUNNING' ? 'Transcribing content...' :
                         task === 'transcription' && audioExtractionStatus === 'completed' && aiJobStatus?.jobStatus?.transcriptGeneration === 'FAILED' ? 'Transcription failed in backend. Please retry.' :
                         task === 'transcription' && audioExtractionStatus === 'completed' ? 'Audio ready. Waiting for transcription to start...' :
                         'Processing task...'}
                      </span>
                    </div>
                    {task === 'transcription' && audioExtractionStatus === 'completed' && aiJobStatus?.jobStatus?.transcriptGeneration !== 'RUNNING' && aiJobStatus?.jobStatus?.transcriptGeneration !== 'COMPLETED' && (
                      <Button 
                        onClick={() => handleStartTranscription && handleStartTranscription()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4" /> {aiJobStatus?.jobStatus?.transcriptGeneration === 'FAILED' ? 'Retry Transcription' : 'Start Transcription Now'}
                      </Button>
                    )}
                  </div>
                )}
                {run.status === "failed" && (
                  <div className="space-y-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-900/20">
                      <div className="font-semibold">This run failed. Try restarting the task.</div>
                      {run.result?.error && (
                        <div className="mt-1 text-[11px] text-red-700 dark:text-red-300 whitespace-pre-wrap">
                          {typeof run.result.error === 'string' ? run.result.error : JSON.stringify(run.result.error)}
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        if (task === 'transcription') {
                          handleStartTranscription && handleStartTranscription();
                        } else {
                          handleTask(task, localSegParams, localParams);
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Restart {title}
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Start Next Task Shortcut */}
      {runs.some((r: any) => r.id === acceptedRunId) && task !== 'upload' && (
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[#2D2D2F]">
          <Button
            onClick={() => {
              const nextStep = task === 'transcription' ? 2 : task === 'segmentation' ? 3 : 4;
              setCurrentUiStep(nextStep);
            }}
            className="w-full py-4 rounded-xl bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white font-bold flex items-center justify-center gap-2 shadow-md transition-all"
          >
            Continue to {task === 'transcription' ? 'Segmentation' : task === 'segmentation' ? 'Question Generation' : 'Publish'} <Play className="w-3 h-3 fill-current" />
          </Button>
        </div>
      )}
    </div>
  );
};

const TaskAccordion = React.memo(TaskAccordionInternal);

// Component to edit questions
const QuestionEditForm = ({ question, onSave, onCancel }: {
  question: any;
  onSave: (edited: any) => void;
  onCancel: () => void;
}) => {
  const typeMap: Record<string, string> = {
    SOL: 'SELECT_ONE_IN_LOT',
    MUL: 'SELECT_MANY_IN_LOT',
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
    return {
      ...question,
      type: typeMap[question.type] || question.type,
    };
  }, [question]);

  const initialOptions = React.useMemo(() => {
    if (normalized.solution) {
      const correct = normalized.solution.correctLotItems
        ? normalized.solution.correctLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: true }))
        : normalized.solution.correctLotItem
          ? [{ text: normalized.solution.correctLotItem.text, explaination: normalized.solution.correctLotItem.explaination, correct: true }]
          : [];
      const incorrect = normalized.solution.incorrectLotItems
        ? normalized.solution.incorrectLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: false }))
        : [];
      return [...correct, ...incorrect];
    }
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

// Component to show transcript for a run
function RunTranscriptSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [transcriptChunks, setTranscriptChunks] = useState<{ text: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="bg-transparent dark:bg-[#0D0D0D] border border-[#DAB2FF] dark:border-[#350067] text-[#9810FA] dark:test-[#A329FB] font-medium px-4 py-2 rounded-[12px] shadow-md hover:bg-transparent hover:shadow-lg hover:text-[#9810FA] transition-all duration-300 transform hover:scale-105 btn-beautiful">
        <Pencil />
        Edit
      </Button>
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
function RunSegmentationSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0, aiJobStatus }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number, aiJobStatus: JobStatus | null }) {
  const [showSegmentation, setShowSegmentation] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
  const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSegMap, setEditSegMap] = useState<number[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [editTranscriptChunks, setEditTranscriptChunks] = useState<any[]>([]);

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
      return (isNaN(m) ? 0 : m * 60) + (isNaN(s) ? 0 : s);
    }
    const sOnly = parseInt(cleaned, 10);
    return isNaN(sOnly) ? 0 : sOnly;
  };
  const formatTimeInput = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  };
  const formatTimeDot = (seconds: number): string => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
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
        const segData = Array.isArray(arr) && arr.length > runIndex ? arr[runIndex] : arr[0];
        if (segData && segData.segmentationMap && Array.isArray(segData.segmentationMap)) {
          setSegmentationMap(segData.segmentationMap);
          
          let fileUrl = segData.transcriptFileUrl;
          if (!fileUrl && aiJobStatus?.transcriptGeneration) {
            const trans = aiJobStatus.transcriptGeneration;
            if (Array.isArray(trans) && trans.length > 0) {
              fileUrl = trans[trans.length - 1].fileUrl;
            }
          }

          if (fileUrl) {
            const transcriptRes = await fetch(fileUrl);
            if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
            const transcriptData = await transcriptRes.json();
            const chunks = Array.isArray(transcriptData.chunks) ? transcriptData.chunks : [];
            const grouped: any[][] = [];
            let segStart = 0;
            for (let i = 0; i < segData.segmentationMap.length; ++i) {
              const segEnd = segData.segmentationMap[i];
              const segChunks = chunks.filter((chunk: any) => chunk.timestamp[0] >= segStart && chunk.timestamp[0] < segEnd);
              grouped.push(segChunks);
              segStart = segEnd;
            }
            setSegmentationChunks(grouped);
          } else {
            setSegmentationChunks([]);
          }
        } else if (segData && segData.fileUrl) {
          const response = await fetch(segData.fileUrl);
          if (!response.ok) throw new Error('Failed to fetch segmentation file');
          const data = await response.json();
          if (Array.isArray(data.segments)) {
            setSegments(data.segments);
          } else if (Array.isArray(data.chunks)) {
            setSegments(data.chunks);
          } else {
            setSegments(data);
          }
        }
      } catch (e: any) {
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    setShowSegmentation(v => !v);
  };

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
      if (Array.isArray(arr) && arr.length > 0 && arr[0].segmentationMap) {
        const normalized = (arr[0].segmentationMap as any[]).map(v => parseTimeToSeconds(String(v)));
        setEditSegMap(normalized);

        let fileUrl = arr[0].transcriptFileUrl;
        if (!fileUrl && aiJobStatus?.transcriptGeneration) {
          const trans = aiJobStatus.transcriptGeneration;
          if (Array.isArray(trans) && trans.length > 0) {
            fileUrl = trans[trans.length - 1].fileUrl;
          }
        }

        if (fileUrl) {
          const transcriptRes = await fetch(fileUrl);
          setEditTranscriptChunks((await transcriptRes.json()).chunks || []);
        } else {
          setEditTranscriptChunks([]);
        }
      }
    } catch (e: any) {
      setEditError(e.message || 'Unknown error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEditSeg = async () => {
    if (!aiJobId) return;
    setEditLoading(true);
    try {
      await editSegmentMap(aiJobId, editSegMap.map(s => Number(formatTimeDot(s))), 0);
      toast.success('Segment map updated successfully!');
      setEditModalOpen(false);
      // Refresh UI
      setShowSegmentation(false);
      handleShowSegmentation();
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
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}
          {!loading && !error && segmentationMap && segmentationChunks && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mt-4">
                <p className="flex items-center gap-2"><Layers color="#00C950" size={20}/> <span className="text-[#1E2939] text-sm font-bold dark:text-[#C6D2E1]">Generated Segments</span></p>
                <p className="flex items-center gap-2"><CircleCheckBig color="#009966" size={14}/> <span className="text-[#009966] text-xs">AI processing complete</span></p>
              </div>
              {segmentationMap.map((end, idx) => {
                const start = idx === 0 ? 0 : segmentationMap[idx - 1];
                const segChunks = segmentationChunks[idx] || [];
                return (
                  <div key={idx} className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.8)_0%,_rgba(249,250,251,0.8)_100%)] dark:bg-[linear-gradient(135deg,_rgba(13,13,13,0.7)_0%,_rgba(13,13,13,0.7)_100%)] backdrop-blur-md border border-[#E5E7EB] dark:border-[#1F2228] p-3 rounded-[12px]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-white h-7 w-7 flex items-center justify-center bg-[linear-gradient(135deg,_#05DF72_0%,_#2B7FFF_100%)] shadow-[0px_4px_12px_rgba(0,0,0,0.1)] rounded-[10px]">{idx + 1}</span>
                      <p className="flex gap-2.5 items-center text-[#6A7282] dark:text-[#F4F8FF]">
                        <Clock size={12}/>{start.toFixed(2)}s - Duration: {end.toFixed(2)}s
                      </p>
                    </div>
                    <div className="text-xs text-[#4A5565] dark:text-[#F0F4FA] mt-2.5">
                      {segChunks.map((c: any) => c.text).join(' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && !error && segments.length > 0 && !segmentationMap && (
             <div className="space-y-2">
             {segments.map((seg, idx) => (
               <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                 <div className="font-bold text-xs mb-1">Section {idx + 1}</div>
                 <div className="text-sm">{seg.text || JSON.stringify(seg)}</div>
               </div>
             ))}
           </div>
          )}
        </div>
      )}
    <div className="flex lg:flex-nowrap flex-wrap gap-2.5 justify-center mt-4">
      <Button size="sm" variant="secondary" onClick={handleShowSegmentation} className="bg-transparent border border-[#D1D5DC] text-[#0A0A0A] dark:text-[#a8a29e] font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg btn-beautiful" disabled={run.status !== 'done'}>
        {showSegmentation ? <EyeOff /> : <Eye />} {showSegmentation ? 'Hide' : 'Show'} Segmentation
      </Button>
      {run.status === 'done' && (
        <Button size="sm" variant="outline" onClick={handleOpenEditModal} className="bg-transparent dark:bg-[#0D0D0D] border border-[#7BF1A8] text-[#00A63E] font-medium px-4 py-2 rounded-[12px] shadow-md hover:shadow-lg btn-beautiful">
          <Pencil /> Edit Segments
        </Button>
      )}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Segments</DialogTitle></DialogHeader>
          {editLoading && <div>Loading...</div>}
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
                      <Input type="text" value={formatTime(value)} onChange={e => {
                        const newMap = [...editSegMap];
                        newMap[idx] = parseTimeToSeconds(formatTimeInput(e.target.value));
                        setEditSegMap(newMap);
                      }} className="w-24" />
                      <Button variant="ghost" size="sm" onClick={() => setEditSegMap(editSegMap.filter((_, i) => i !== idx))} disabled={editSegMap.length <= 1}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      {segText || "No text in this segment"}
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => setEditSegMap([...editSegMap, editSegMap[editSegMap.length - 1] + 10])} className="w-full"><Plus className="h-4 w-4 mr-2"/>Add Segment</Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditSeg} disabled={editLoading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {acceptedRunId !== run.id && (
        <Button size="sm" onClick={onAccept} className="bg-[linear-gradient(90deg,_#00D492_0%,_#009966_100%)] text-white dark:text-[#0D0D0D] rounded-[12px]">
          <Check /> Accept This Run <Sparkles />
        </Button>
      )}
    </div>
    </>
  );
}

// Component to show questions for a question generation run
function RunQuestionSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
  const [showQuestions, setShowQuestions] = useState(false);
  const [questionsByRun, setQuestionsByRun] = useState<{ [runId: string]: any[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<any>(null);

  useEffect(() => {
    setQuestionsByRun(prev => { if (prev[run.id]) { const next = { ...prev }; delete next[run.id]; return next; } return prev; });
  }, [run.result, run.status, run.id]);

  const questions = questionsByRun[run.id] || [];

  const handleShowQuestions = async () => {
    if (!aiJobId) return;
    if (!showQuestions && !questionsByRun[run.id]) {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem('firebase-auth-token');
        const url = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const arr = await res.json();
        const dataRes = await fetch(arr[runIndex]?.fileUrl || arr[0]?.fileUrl);
        const data = await dataRes.json();
        setQuestionsByRun(prev => ({ ...prev, [run.id]: Array.isArray(data) ? data : (data.segments || []) }));
      } catch (e: any) {
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    setShowQuestions(v => !v);
  };

  const handleDeleteQuestion = async (idxToDelete: number) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    
    const updated = questions.filter((_, i) => i !== idxToDelete);
    if (aiJobId && typeof aiSectionAPI.editQuestionData === 'function') {
      try {
        await aiSectionAPI.editQuestionData(aiJobId, updated, runIndex);
        setQuestionsByRun(prev => ({ ...prev, [run.id]: updated }));
        toast.success('Question deleted successfully');
      } catch (err) {
        console.error('Failed to delete question:', err);
        toast.error('Failed to delete question');
      }
    }
  };

  if (run.status !== 'done') return <div className="flex items-center gap-2 text-blue-400"><Loader2 className="animate-spin" /> Generating questions...</div>;

  return (
    <div className="space-y-2">
      {showQuestions && (
        <>
        <div className="flex items-center justify-between mt-4">
         <p className="flex items-center gap-2"><BookOpen color="#AD46FF" size={20}/> <span className="text-[#1E2939] text-[15px] font-bold dark:text-[#C6D2E1]">Generated Questions</span></p>
         <p className="flex items-center gap-2"><CircleCheckBig color="#009966" size={14}/> <span className="text-[#009966] text-xs">AI generation complete</span></p>
        </div>
        <div className="text-gray-900 dark:text-[#F9FBFF] p-[18px] max-h-96 overflow-y-auto text-sm mt-2">
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}
          {!loading && !error && (
            <ol className="mt-2 space-y-4">
              {questions.map((q: any, idx: number) => (
                <li key={idx} className="border border-[#E5E7EB] dark:bg-[#151516] dark:border-[#1F2228] rounded-[12px] p-[18px]">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="font-semibold bg-gradient-to-br from-[#C27AFF] to-[#615FFF] w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-white">{idx + 1}</div>
                      <div className="bg-[#F3E8FF] text-[#9810FA] px-[6px] py-[4px] rounded-[8px]">{q.questionType || q.question?.type || 'N/A'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingIdx(idx); setEditQuestion(q); setEditModalOpen(true); }} className="btn-beautiful"><Edit className="w-4 h-4" /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteQuestion(idx)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /> Delete</Button>
                    </div>
                  </div>
                  <div className="text-[13px] font-medium pt-[12px] pb-[14px]">{q.question?.text}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
        </>
      )}
      <div className="w-full flex items-center justify-center gap-2 mt-4">
        <Button size="sm" variant="secondary" onClick={handleShowQuestions} className="btn-beautiful">
          {showQuestions ? <EyeOff /> : <Eye />} {showQuestions ? 'Hide' : 'Show'} Questions
        </Button>
        {acceptedRunId !== run.id && (
          <Button size="sm" onClick={onAccept} className="bg-[linear-gradient(90deg,_#00D492_0%,_#009966_100%)] text-white dark:text-[#0D0D0D] rounded-[12px]">
            <Check /> Accept This Version <Sparkles />
          </Button>
        )}
      </div>
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
          {editQuestion && <QuestionEditForm question={editQuestion} onSave={async (edited) => {
            const updated = questions.map((q, i) => i === editingIdx ? { ...q, question: { ...q.question, text: edited.text }, solution: edited.solution } : q);
            if (aiJobId && typeof aiSectionAPI.editQuestionData === 'function') {
              await aiSectionAPI.editQuestionData(aiJobId, updated, runIndex);
              setQuestionsByRun(prev => ({ ...prev, [run.id]: updated }));
            }
            setEditModalOpen(false);
          }} onCancel={() => setEditModalOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}


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

export default function AISectionPage() {
  const { currentCourse } = useCourseStore();
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
  const [shouldPoll, setShouldPoll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

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
  const [rerunParams, setRerunParams] = useState({ language: 'en', modelSize: 'large' });

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
    model: "gpt-4o",
    SOL: 10,
    SML: 0,
    NAT: 0,
    DES: 0,
    BIN: 0,
    numberOfQuestions: 10,
    prompt: `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`
  });

  const [questionsPerQuiz, setQuestionsPerQuiz] = useState(1);

  // Local parameter states for editing before running tasks
  const [localParams, setLocalParams] = useState<QuestionGenParams>({ ...questionGenParams });
  const [localSegParams, setLocalSegParams] = useState({ ...segParams });
  const [videoItemBaseName, setVideoItemBaseName] = useState("video_item");
  const [quizItemBaseName, setQuizItemBaseName] = useState("quiz_item");

  // Define activeStep for Stepper
  const activeStep = React.useMemo(() => {
    if (!aiJobStatus) return null;

    if (aiJobStatus.task === 'AUDIO_EXTRACTION') {
      return 'audioExtraction';
    }
    if (aiJobStatus.task === 'TRANSCRIPT_GENERATION') {
      return 'transcriptGeneration';
    }
    if (aiJobStatus.task === 'SEGMENTATION') {
      return 'segmentation';
    }
    if (aiJobStatus.task === 'QUESTION_GENERATION') {
      return 'questionGeneration';
    }
    if (aiJobStatus.task === 'UPLOAD_CONTENT') {
      return 'uploadContent';
    }

    return null;
  }, [aiJobStatus]);

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

    if (!currentCourse?.courseId || !currentCourse?.versionId) {
      toast.error("Missing course or version information");
      return;
    }

    const isValidMongoId = (id: string): boolean => /^[a-fA-F0-9]{24}$/.test(id);
    if (!isValidMongoId(currentCourse.courseId) || !isValidMongoId(currentCourse.versionId)) {
      toast.error("Invalid course/version ID format. Please reopen the AI modal and try again.");
      return;
    }

    if (currentCourse.moduleId && !isValidMongoId(currentCourse.moduleId)) {
      toast.error("Invalid module ID format. Please reselect the section and try again.");
      return;
    }
    if (currentCourse.sectionId && !isValidMongoId(currentCourse.sectionId)) {
      toast.error("Invalid section ID format. Please reselect the section and try again.");
      return;
    }

    setIsCreatingJob(true);
    try {
      const jobParams: Parameters<typeof aiSectionAPI.createJob>[0] = {
        videoUrl: youtubeUrl.trim(),
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId,
        moduleId: currentCourse.moduleId || undefined,
        sectionId: currentCourse.sectionId || undefined,
        videoItemBaseName: 'video_item',
        quizItemBaseName: 'quiz_item',
        segmentationParameters: {
          lam: 4.5,
          runs: 25,
          noiseId: -1,
        },
        questionGenerationParameters: {
          SOL: 10,
          SML: 0,
          NAT: 0,
          DES: 0,
          prompt: `Focus on conceptual understanding\n- Test comprehension of key ideas, principles, and relationships discussed in the content\n- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content\n- The answer of questions should be present within the content, but not directly quoted\n- Make all the options roughly the same length\n- Set isParameterized to false unless the question uses variables\n- Do not mention the word 'transcript' for giving references, use the word 'video' instead`,
          numberOfQuestions: 10,
        },
      };
      console.debug('Creating AI job with params', jobParams);

      let jobId: string | null = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await aiSectionAPI.createJob(jobParams);
          jobId = result.jobId;
          break;
        } catch (err: any) {
          lastError = err;
          if (attempt === 0) {
            console.warn('Create AI job attempt failed, retrying once', err);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!jobId) {
        throw lastError ?? new Error('Unknown error while creating AI job');
      }

      setAiJobId(jobId);
      toast.success("AI job created successfully!");
      setCurrentUiStep(1); // Move to first step
    } catch (error: any) {
      const message = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      if (message.includes('timeout') || message.includes('ECONNABORTED')) {
        toast.error('AI job timed out while connecting to backend AI service. Please retry in a moment.');
      } else {
        toast.error(`Failed to create AI job: ${message}`);
      }
      console.error('Create AI job error', error);
    } finally {
      setIsCreatingJob(false);
    }
  };

  // Refactored handleTask for transcription (no polling)
  const handleTask = async (task: keyof typeof taskRuns, segParams: any, taskParams: any) => {

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
      if (task !== "transcription") {
        if (task === 'question') {
          sessionStorage.removeItem('questions');
        }
        
        // Only approve continue if the task is currently in PENDING state
        // to avoid incorrect state transitions in the production backend
        const isPending = (
          (task === 'segmentation' && aiJobStatus?.jobStatus?.segmentation === 'PENDING') ||
          (task === 'question' && aiJobStatus?.jobStatus?.questionGeneration === 'PENDING') ||
          (task === 'upload' && aiJobStatus?.jobStatus?.uploadContent === 'PENDING')
        );

        if (isPending) {
          await aiSectionAPI.approveContinueTask(aiJobId);
        }
      }

      if (task === "transcription") {
        const hasStoppedRun = taskRuns.transcription.some(r => r.status === 'stopped');
        if (hasStoppedRun) {
          setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
          await aiSectionAPI.postJobTask(aiJobId, 'AUDIO_EXTRACTION', {}, 1);
          
          setAudioExtractionStatus('processing');
          setAudioExtractionProgress(pausedProgress);
          setAudioExtractionStartTime(pausedStartTime || new Date());
          setEstimatedTimeRemaining('');
          
          toast.success("Transcription restarted");
          setIsLoading(true);
          setProgress(0);
          setShouldPoll(true);
          await handleRefreshStatus();
          return;
        }

        if (aiJobStatus?.jobStatus?.transcriptGeneration === 'COMPLETED') {
          // Rerun transcription with selected parameters
          await aiSectionAPI.rerunJobTask(aiJobId, 'TRANSCRIPT_GENERATION', rerunParams);
          toast.success("Transcription rerun started.");
          setIsLoading(true);
          setProgress(0);
          setShouldPoll(true);
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
        await aiSectionAPI.postJobTask(aiJobId, 'AUDIO_EXTRACTION', {}, 0);
        
        setAudioExtractionStatus('processing');
        setAudioExtractionProgress(audioExtractionStatus === 'paused' ? pausedProgress : 0);
        setAudioExtractionStartTime(audioExtractionStatus === 'paused' ? pausedStartTime || new Date() : new Date());
        setEstimatedTimeRemaining('');
        
        toast.success("Audio extraction started.");
        setIsLoading(true);
        setProgress(0);
        setShouldPoll(true);
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
      let localParams: Record<string, any> | undefined = undefined;
      switch (task) {
        case "segmentation": {
          taskType = "SEGMENTATION";
          const hasFailedOrStoppedRun = taskRuns.segmentation.some(r => r.status === 'failed' || r.status === 'stopped');
          if (hasFailedOrStoppedRun) {
            setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
            localParams = { lam: segParams.lam, runs: segParams.runs, noiseId: segParams.noiseId };
            await aiSectionAPI.approveContinueTask(aiJobId);
            await aiSectionAPI.rerunJobTask(aiJobId, taskType, localParams, 0);
            toast.success("Segmentation restarted.");
            setIsLoading(true);
            setProgress(0);
            setShouldPoll(true);
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
          // Always use the latest values from segParams for the payload
          localParams = { lam: segParams.lam, runs: segParams.runs, noiseId: segParams.noiseId };
          await aiSectionAPI.postJobTask(aiJobId, taskType, localParams, 0);
          setIsLoading(true);
          setProgress(0);
          setShouldPoll(true);
          await handleRefreshStatus();
          return;
        }
        case "question":
          taskType = "QUESTION_GENERATION";
          const isCompleted = aiJobStatus?.jobStatus?.questionGeneration === 'COMPLETED';

          setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));

          try {
            const jobData = (await aiSectionAPI.getJobStatus(aiJobId!)) as any;
            const segmentationRuns = Array.isArray(jobData.segmentation) ? jobData.segmentation : [];
            let segMap: number[] | undefined = undefined;
            let transcriptUrl: string | undefined = undefined;

            for (let i = segmentationRuns.length - 1; i >= 0; i--) {
              const run = segmentationRuns[i];
              if (!segMap && Array.isArray(run?.segmentationMap) && run.segmentationMap.length > 0) {
                segMap = run.segmentationMap;
              }
              if (!transcriptUrl && typeof run?.transcriptFileUrl === 'string') {
                transcriptUrl = run.transcriptFileUrl;
              }
              if (segMap && transcriptUrl) break;
            }

            if ((!segMap || segMap.length === 0) || !transcriptUrl) {
              const segTaskRes = await aiSectionAPI.getTaskStatus(aiJobId, 'SEGMENTATION');
              if (Array.isArray(segTaskRes)) {
                for (let i = segTaskRes.length - 1; i >= 0; i--) {
                  const run = segTaskRes[i] as any;
                  if (!segMap && Array.isArray(run?.segmentationMap) && run.segmentationMap.length > 0) {
                    segMap = run.segmentationMap;
                  }
                  if (!transcriptUrl && typeof run?.transcriptFileUrl === 'string') {
                    transcriptUrl = run.transcriptFileUrl;
                  }
                  if (segMap && transcriptUrl) break;
                }
              }
            }

            if (!transcriptUrl) {
              const lastTranscript = jobData.transcriptGeneration?.[jobData.transcriptGeneration?.length - 1];
              transcriptUrl = lastTranscript?.fileUrl;
            }
            if (!transcriptUrl) {
              const transTaskRes = await aiSectionAPI.getTaskStatus(aiJobId, 'TRANSCRIPT_GENERATION');
              if (Array.isArray(transTaskRes) && transTaskRes.length > 0) {
                const lastTrans = transTaskRes[transTaskRes.length - 1] as any;
                transcriptUrl = lastTrans?.fileUrl || transcriptUrl;
              }
            }

            if (!segMap || segMap.length === 0) {
              const hasSegmentation = segmentationRuns.length > 0 || (await aiSectionAPI.getTaskStatus(aiJobId, 'SEGMENTATION')).length > 0;
              throw new Error(
                hasSegmentation
                  ? 'Cannot generate questions: segmentation map missing or invalid. Please re-run segmentation or edit the segment map before retrying question generation.'
                  : 'Cannot generate questions: segmentation has not been run yet. Please run segmentation first and then retry question generation.',
              );
            }

            if (!transcriptUrl) {
              throw new Error('Could not find transcript file URL for question generation. Please ensure transcription and segmentation are complete.');
            }

            await aiSectionAPI.editSegmentMap(aiJobId, segMap);

            if (!transcriptUrl) {
              const lastTranscript = jobData.transcriptGeneration?.[jobData.transcriptGeneration?.length - 1];
              transcriptUrl = lastTranscript?.fileUrl;
            }
            if (!transcriptUrl) {
              const transTaskRes = await aiSectionAPI.getTaskStatus(aiJobId, 'TRANSCRIPT_GENERATION');
              if (Array.isArray(transTaskRes) && transTaskRes.length > 0) {
                transcriptUrl = transTaskRes[transTaskRes.length - 1]?.fileUrl || transcriptUrl;
              }
            }
            if (!transcriptUrl) {
              throw new Error('Could not find transcript file URL for question generation. Please ensure transcription and segmentation are complete.');
            }

            const effectivePrompt = taskParams?.prompt?.trim() || questionGenParams.prompt || "";
            if (!effectivePrompt) {
              throw new Error('Question generation prompt is empty. Please provide a prompt.');
            }

            const finalQnParams: Record<string, any> = {
              SOL: Number(taskParams?.SOL ?? 0),
              SML: Number(taskParams?.SML ?? 0),
              NAT: Number(taskParams?.NAT ?? 0),
              DES: Number(taskParams?.DES ?? 0),
              BIN: Number(taskParams?.BIN ?? 0),
              prompt: effectivePrompt,
            };
            const qnTypes = ['SOL', 'SML', 'NAT', 'DES', 'BIN'];
            const totalRequested = qnTypes.reduce(
              (sum, type) => sum + (Number(finalQnParams[type] ?? 0) || 0),
              0,
            );
            if (totalRequested === 0) {
              finalQnParams.NAT = Number(taskParams?.numberOfQuestions || 10);
            }

            // Keep transcript file URL for the AI server to use
            finalQnParams.transcriptFileUrl = transcriptUrl;

            if (isCompleted) {
              await aiSectionAPI.rerunJobTask(aiJobId, 'QUESTION_GENERATION', finalQnParams, 0);
              toast.success('Question generation re-run started.');
            } else {
              await aiSectionAPI.approveContinueTask(aiJobId);
              await aiSectionAPI.approveStartTask(aiJobId, {
                type: 'QUESTION_GENERATION',
                parameters: finalQnParams,
              });
              toast.success('Question generation started.');
            }
          } catch (e: any) {
            console.error('Failed to prepare or start question generation:', e);
            throw new Error(e?.message || 'Failed to start question generation.');
          }
          break;

        case "upload":
          taskType = "UPLOAD_CONTENT";
          setTaskRuns(prev => ({ ...prev, [task]: [...prev[task], newRun] }));
          await aiSectionAPI.postJobTask(aiJobId, taskType, taskParams || {}, 0);
          break;
        default:
          throw new Error(`Unknown task: ${task}`);
      }
      setIsLoading(true);
      setProgress(0);
      setShouldPoll(true);

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
      if (task === "upload") {
        console.warn("Upload content might have deadlocked but succeeded. Verifying status...");
        try {
          // Wait longer (5s) for the DB to settle
          await new Promise(resolve => setTimeout(resolve, 5000));
          const status = await aiSectionAPI.getJobStatus(aiJobId!) as any;
          const uploadStatus = status.jobStatus?.uploadContent;
          const hasResults = Array.isArray(status.uploadContent) && status.uploadContent.length > 0;

          if (uploadStatus === "COMPLETED" || hasResults) {
            setTaskRuns(prev => ({
              ...prev,
              [task]: prev[task].map(run =>
                run.id === runId ? { ...run, status: "done", result: status } : run
              ),
            }));
            toast.success("Section verified as uploaded successfully!");
            setAiJobStatus(status);
            setIsLoading(false);
            setShouldPoll(false);
            return;
          } else if (uploadStatus === "RUNNING" || uploadStatus === "PENDING") {
            console.info("Upload detected as active on server. Proceeding with polling.");
            setTaskRuns(prev => ({
              ...prev,
              [task]: prev[task].map(run =>
                run.id === runId ? { ...run, status: "loading", result: status } : run
              ),
            }));
            setAiJobStatus(status);
            setShouldPoll(true);
            setIsLoading(true);
            toast.info("Upload is processing in the background...");
            return;
          }
        } catch (innerError) {
          console.error("Failed to verify status after upload error:", innerError);
        }
      }

      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run =>
          run.id === runId ? { ...run, status: "failed" } : run
        ),
      }));
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


  const getCurrentActiveRunNumber = (taskType: keyof TaskRuns): number => {
    const runs = taskRuns[taskType];
    if (!runs || runs.length === 0) return 1;
    
    const latestRun = runs.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
    
    return runs.indexOf(latestRun) + 1;
  };



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
      const status = await aiSectionAPI.getJobStatus(aiJobId) as any;

      // Enrich status with detailed task runs if a task failed
      const failedTask = Object.entries(status.jobStatus || {}).find(([_, s]) => s === 'FAILED')?.[0];
      if (failedTask) {
        try {
          const taskType = failedTask === 'transcriptGeneration' ? 'TRANSCRIPT_GENERATION'
            : failedTask === 'segmentation' ? 'SEGMENTATION'
              : failedTask === 'questionGeneration' ? 'QUESTION_GENERATION'
                : failedTask.toUpperCase();
          const runs = await aiSectionAPI.getTaskStatus(aiJobId, taskType);
          status[failedTask] = runs;
        } catch (e) {
          console.error(`Failed to fetch task details for ${failedTask}:`, e);
        }
      }
      
      setAiJobStatus(status);
      
      const js = status?.jobStatus as any || {};

      // Sync Audio Extraction status from sub-task if available
      if (js.audioExtraction === 'RUNNING') {
        setAudioExtractionStatus('processing');
      } else if (js.audioExtraction === 'COMPLETED') {
        setAudioExtractionStatus('completed');
        setAudioExtractionProgress(100);
        setEstimatedTimeRemaining('');
      }

      // 1. Audio Extraction completion (more robust check)
      if (
        didMountRef.current &&
        js.audioExtraction === 'COMPLETED' &&
        prevJobStatusRef.current?.jobStatus?.audioExtraction !== 'COMPLETED'
      ) {
        setAudioExtractionStatus('completed');
        setAudioExtractionProgress(100);
        setEstimatedTimeRemaining('');
        
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

        // Auto-trigger disabled - waiting for manual confirmation
      }

      // 2. Transcript Generation completion (more robust check)
      if (
        didMountRef.current &&
        js.transcriptGeneration === 'COMPLETED' &&
        prevJobStatusRef.current?.jobStatus?.transcriptGeneration !== 'COMPLETED'
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

      // Handle failures for Transcription
      if (
        didMountRef.current &&
        js.transcriptGeneration === 'FAILED' &&
        prevJobStatusRef.current?.jobStatus?.transcriptGeneration !== 'FAILED'
      ) {
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.transcription].reverse().findIndex(run => run.status === 'loading');
          if (lastLoadingIdx === -1) return prev;
          const idxToUpdate = prev.transcription.length - 1 - lastLoadingIdx;
          
          // Get the detailed error from enriched status
          const runsHistory = (status as any).transcriptGeneration || [];
          const lastRunDetails = runsHistory[runsHistory.length - 1];

          return {
            ...prev,
            transcription: prev.transcription.map((run, idx) =>
              idx === idxToUpdate ? { ...run, status: 'failed', result: { ...run.result, error: lastRunDetails?.error } as any } : run
            ),
          };
        });
        toast.error('Transcription failed. You can try restarting it.');
      }
      if (
        didMountRef.current &&
        js.segmentation === 'COMPLETED' &&
        prevJobStatusRef.current?.jobStatus?.segmentation !== 'COMPLETED'
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

      // Handle failures for Segmentation
      if (
        didMountRef.current &&
        js.segmentation === 'FAILED' &&
        prevJobStatusRef.current?.jobStatus?.segmentation !== 'FAILED'
      ) {
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.segmentation].reverse().findIndex(run => run.status === 'loading');
          if (lastLoadingIdx === -1) return prev;
          const idxToUpdate = prev.segmentation.length - 1 - lastLoadingIdx;
          
          // Get the detailed error from enriched status
          const runsHistory = (status as any).segmentation || [];
          const lastRunDetails = runsHistory[runsHistory.length - 1];

          return {
            ...prev,
            segmentation: prev.segmentation.map((run, idx) =>
              idx === idxToUpdate ? { ...run, status: 'failed', result: { ...run.result, error: lastRunDetails?.error } as any } : run
            ),
          };
        });
        toast.error('Segmentation failed.');
      }
      if (
        didMountRef.current &&
        js.questionGeneration === 'COMPLETED' &&
        prevJobStatusRef.current?.jobStatus?.questionGeneration !== 'COMPLETED'
      ) {
        try {
          const token = localStorage.getItem('firebase-auth-token');
          const backendUrl = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
          const res = await fetch(backendUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) {
            throw new Error('Failed to fetch question generation task status from backend.');
          }
          const arr = await res.json();
          const fileUrl = Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1]?.fileUrl : null;

          const questions = [] as any[];
          let questionFetchError = '';
          if (fileUrl) {
            try {
              const qRes = await fetch(fileUrl);
              if (!qRes.ok) {
                questionFetchError = `Failed to fetch question output file: ${qRes.status} ${qRes.statusText}`;
              } else {
                const data = await qRes.json();
                if (Array.isArray(data)) {
                  questions.push(...data);
                } else if (Array.isArray(data.segments)) {
                  data.segments.forEach((seg: any) => {
                    if (Array.isArray(seg.questions)) questions.push(...seg.questions);
                  });
                  if (Array.isArray(data.questions)) questions.push(...data.questions);
                } else if (Array.isArray(data.questionsData)) {
                  questions.push(...data.questionsData);
                } else if (Array.isArray(data.questions)) {
                  questions.push(...data.questions);
                } else {
                  questionFetchError = 'Question output format not recognized.';
                }
              }
            } catch (err) {
              questionFetchError = `Failed to fetch or parse question output file: ${err}`;
            }
          } else {
            questionFetchError = 'No question output file URL found.';
          }

          setTaskRuns(prev => {
            const lastLoadingIdx = [...prev.question].reverse().findIndex(run => run.status === 'loading');
            const lastDoneIdx = [...prev.question].reverse().findIndex(run => run.status === 'done');
            let idxToUpdate = lastLoadingIdx !== -1 ? prev.question.length - 1 - lastLoadingIdx : lastDoneIdx !== -1 ? prev.question.length - 1 - lastDoneIdx : -1;
            if (idxToUpdate === -1) return prev;

            if (!fileUrl || questions.length === 0) {
              const errMsg = questionFetchError || 'No questions were generated in the output file.';
              toast.error(`Question generation completed but no valid questions were generated. ${errMsg}`);
              return {
                ...prev,
                question: prev.question.map((run, idx) =>
                  idx === idxToUpdate
                    ? { ...run, status: 'failed', result: { ...run.result, error: errMsg, questionTaskStatus: arr } }
                    : run
                ),
              };
            }

            return {
              ...prev,
              question: prev.question.map((run, idx) =>
                idx === idxToUpdate
                  ? { ...run, status: 'done', result: { ...run.result, questionTaskStatus: arr, questionCount: questions.length } }
                  : run
              ),
            };
          });

          if (fileUrl && questions.length > 0) {
            toast.success(`Questions generated! (${questions.length} questions)`);
          }
        } catch (err) {
          console.error('Question generation completion handler error:', err);
          toast.error('Questions generated but failed to validate output. Check run details.');
        }
      }

      // Handle failures for Question Generation
      if (
        didMountRef.current &&
        js.questionGeneration === 'FAILED' &&
        prevJobStatusRef.current?.jobStatus?.questionGeneration !== 'FAILED'
      ) {
        setTaskRuns(prev => {
          const lastLoadingIdx = [...prev.question].reverse().findIndex(run => run.status === 'loading');
          if (lastLoadingIdx === -1) return prev;
          const idxToUpdate = prev.question.length - 1 - lastLoadingIdx;

          const runsHistory = (status as any).questionGeneration || [];
          const lastRunDetails = runsHistory[runsHistory.length - 1] || {};

          let errorMessage = lastRunDetails?.error || lastRunDetails?.message || 'Question generation failed with no detailed error.';
          if (typeof errorMessage === 'object') {
            errorMessage = JSON.stringify(errorMessage, null, 2);
          }

          return {
            ...prev,
            question: prev.question.map((run, idx) =>
              idx === idxToUpdate
                ? { ...run, status: 'failed', result: { ...run.result, error: errorMessage } as any }
                : run
            ),
          };
        });
        toast.error('Question generation failed. See details in the run output.');
      }

      // 3. Upload Content completion
      if (
        didMountRef.current &&
        js.uploadContent === 'COMPLETED' &&
        prevJobStatusRef.current?.jobStatus?.uploadContent !== 'COMPLETED'
      ) {
        setTaskRuns(prev => ({
          ...prev,
          upload: prev.upload.map(run =>
            run.status === 'loading' ? { ...run, status: 'done', result: status } : run
          ),
        }));
        toast.success('Section uploaded successfully!');
      }

      // Safeguard for deadlock false-failure/stuck WAITING
      const isUploadTask = status.task === "UPLOAD_CONTENT" || status.task === "uploadContent" || status.task === "upload";
      const hasUploadResults = Array.isArray(status.uploadContent) && status.uploadContent.length > 0;

      if (isUploadTask && (js.uploadContent === 'FAILED' || js.uploadContent === 'WAITING') && (hasUploadResults)) {
        console.warn("Server reported FAILED/WAITING for upload, but we have server results. Likely deadlock false-positive. Ignoring server status.");
        if (hasUploadResults) {
          setTaskRuns(prev => ({
            ...prev,
            upload: prev.upload.map(run =>
              run.status === 'loading' ? { ...run, status: 'done', result: status } : run
            ),
          }));
          setAiJobStatus(status);
          setShouldPoll(false);
          setIsLoading(false);
          setProgress(100);
        }
        return;
      }
      if (status?.status === 'COMPLETED' || status?.status === 'FAILED' || status?.status === 'STOPPED') {
        setProgress(100);
        setTimeout(() => setIsLoading(false), 500);
        setShouldPoll(false);
        
        if (status?.status === 'FAILED') {
          toast.error('A step failed.');
        }
        if (status?.status === 'STOPPED') {
          toast.info('A step was stopped.');
        }
      }

      // Update reference for next call
      prevJobStatusRef.current = status;
      if (!didMountRef.current) didMountRef.current = true;

    } catch (error) {
      setShouldPoll(false);
      setIsLoading(false);
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
        setShouldPoll(false);
      } else {
        toast.error('Failed to stop task.');
      }
    } catch (error) {
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
    if (!aiJobId || !shouldPoll) return;

    const interval=setInterval(()=>{
      handleRefreshStatus();
    },5000);

    return () => clearInterval(interval);
  }, [aiJobId, manuallyCollapsedItems, shouldPoll]);

  // Mock progress % bar (Added to match AiWorkflow.tsx)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let slowInterval: NodeJS.Timeout | null = null;

    if (isLoading) {
      interval = setInterval(() => {
        setProgress((prev: number) => {
          if (prev >= 99.99) {
            if (interval) clearInterval(interval);
            return 99.99;
          }

          let increment: number;
          if (prev >= 90) {
            if (interval) clearInterval(interval);

            slowInterval = setInterval(() => {
              setProgress((p: number) => {
                if (p >= 95) {
                  if (slowInterval) clearInterval(slowInterval);
                  return 95; // Cap at 95% to leave room for the final 100% jump
                }
                return p + 0.1;
              });
            }, 5000);

            return 90;
          } else {
            increment = Math.max(0.2, (99.99 - prev) / 25);
            if (prev >= 85) {
              increment = Math.max(0.05, increment / 3);
            }
            // Estimate based on task complexity
            if (aiJobStatus?.task === "TRANSCRIPT_GENERATION" || aiJobStatus?.task === "QUESTION_GENERATION") {
              increment = Math.max(0.05, increment / 2);
            }
            return Math.min(prev + increment, 90);
          }
        });
      }, 1600);
    } else {
      // Don't reset to 0 immediately to allow for final 100% jump if needed
      // Actually per AiWorkflow.tsx:
      // setProgress(0);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (slowInterval) clearInterval(slowInterval);
    };
  }, [isLoading, aiJobStatus?.task]);

  // useEffect(() => {
  //   if (!aiJobStatus) return;

  //   handleRefreshStatus();
  // }, [aiJobStatus])

  // New: Manual trigger for transcript generation
  const handleStartTranscription = async (isAuto = false) => {
    if (!aiJobId) return;

    try {
      let status = await aiSectionAPI.getJobStatus(aiJobId) as any;

      // Enrich status with detailed task runs if a task failed
      const failedTask = Object.entries(status.jobStatus || {}).find(([_, s]) => s === 'FAILED')?.[0];
      if (failedTask) {
        try {
          const taskType = failedTask === 'transcriptGeneration' ? 'TRANSCRIPT_GENERATION'
            : failedTask === 'segmentation' ? 'SEGMENTATION'
              : failedTask === 'questionGeneration' ? 'QUESTION_GENERATION'
                : failedTask.toUpperCase();
          const runs = await aiSectionAPI.getTaskStatus(aiJobId, taskType);
          status[failedTask] = runs;
        } catch (e) {
          console.error(`Failed to fetch task details for ${failedTask}:`, e);
        }
      }
      setAiJobDate(status?.createdAt);
      
      const startTask = async () => {
        await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION', rerunParams);
        if (!isAuto) toast.success('Transcript generation started.');
        setIsLoading(true);
        setProgress(0);
        setShouldPoll(true);
        await handleRefreshStatus();
      };

      const rerunTask = async () => {
        await aiSectionAPI.rerunJobTask(aiJobId, 'TRANSCRIPT_GENERATION', rerunParams);
        if (!isAuto) toast.success('Transcript generation restarted.');
        setIsLoading(true);
        setProgress(0);
        setShouldPoll(true);
        await handleRefreshStatus();
      };

      if (status.jobStatus?.transcriptGeneration === 'PENDING') {
        await aiSectionAPI.approveContinueTask(aiJobId);
        if (!isAuto) toast.success('Approved transcript task.');
        // Immediately check status and start if now WAITING
        status = await aiSectionAPI.getJobStatus(aiJobId);
        if (status.jobStatus?.transcriptGeneration === 'WAITING' || status.jobStatus?.transcriptGeneration === 'PENDING') {
          await startTask();
        } else if (!isAuto) {
          toast.info('Transcript generation is not ready to start yet.');
        }
      } else if (status.jobStatus?.transcriptGeneration === 'WAITING') {
        await startTask();
      } else if (status.jobStatus?.transcriptGeneration === 'FAILED') {
        await rerunTask();
      } else if (!isAuto) {
        toast.info(`Transcript generation is not ready to start. Status: ${status.jobStatus?.transcriptGeneration}`);
      }
    } catch (error) {
      if (!isAuto) toast.error('Failed to start transcript generation.');
      await handleRefreshStatus();
    }
  };


  // Component to show transcript for a run





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
          <Stepper 
            jobStatus={aiJobStatus} 
            activeStep={activeStep}
            progress={progress}
            audioExtractionProgress={audioExtractionProgress}
          />
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
                          title="Transcription"
                          jobStatus={aiJobStatus}
                          runs={taskRuns.transcription}
                          taskRuns={taskRuns}
                          acceptedRuns={acceptedRuns}
                          aiJobId={aiJobId}
                          aiJobStatus={aiJobStatus}
                          handleAcceptRun={handleAcceptRun}
                          localParams={localParams}
                          setLocalParams={setLocalParams}
                          localSegParams={localSegParams}
                          setLocalSegParams={setLocalSegParams}
                          rerunParams={rerunParams}
                          videoItemBaseName={videoItemBaseName}
                          setVideoItemBaseName={setVideoItemBaseName}
                          quizItemBaseName={quizItemBaseName}
                          setQuizItemBaseName={setQuizItemBaseName}
                          questionsPerQuiz={questionsPerQuiz}
                          setQuestionsPerQuiz={setQuestionsPerQuiz}
                          acceptedRunId={acceptedRuns.transcription}
                          handleTask={handleTask}
                          handleStartTranscription={handleStartTranscription}
                          handleRefreshStatus={handleRefreshStatus}
                          handleStopTask={handleStopTask}
                          canRunTask={canRunTask}
                          expandedAccordionItems={expandedAccordionItems}
                          setExpandedAccordionItems={setExpandedAccordionItems}
                          manuallyCollapsedItems={manuallyCollapsedItems}
                          setManuallyCollapsedItems={setManuallyCollapsedItems}
                          currentCourse={currentCourse}
                          audioExtractionStatus={audioExtractionStatus}
                          audioExtractionProgress={audioExtractionProgress}
                          audioExtractionStartTime={audioExtractionStartTime}
                          estimatedTimeRemaining={estimatedTimeRemaining}
                          getCurrentActiveRunNumber={getCurrentActiveRunNumber}
                          getStatusIcon={getStatusIcon}
                          setIsLoading={setIsLoading}
                          setProgress={setProgress}
                          setShouldPoll={setShouldPoll}
                          setQuestionGenParams={setQuestionGenParams}
                          setSegParams={setSegParams}
                          setRerunParams={setRerunParams}
                          currentUiStep={currentUiStep}
                          setCurrentUiStep={setCurrentUiStep}
                          progress={progress}
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
                          jobStatus={aiJobStatus}
                          runs={taskRuns.segmentation}
                          taskRuns={taskRuns}
                          acceptedRuns={acceptedRuns}
                          aiJobId={aiJobId}
                          aiJobStatus={aiJobStatus}
                          handleAcceptRun={handleAcceptRun}
                          localParams={localParams}
                          setLocalParams={setLocalParams}
                          localSegParams={localSegParams}
                          setLocalSegParams={setLocalSegParams}
                          rerunParams={rerunParams}
                          videoItemBaseName={videoItemBaseName}
                          setVideoItemBaseName={setVideoItemBaseName}
                          quizItemBaseName={quizItemBaseName}
                          setQuizItemBaseName={setQuizItemBaseName}
                          questionsPerQuiz={questionsPerQuiz}
                          setQuestionsPerQuiz={setQuestionsPerQuiz}
                          acceptedRunId={acceptedRuns.segmentation}
                          handleTask={handleTask}
                          handleStartTranscription={handleStartTranscription}
                          handleRefreshStatus={handleRefreshStatus}
                          handleStopTask={handleStopTask}
                          canRunTask={canRunTask}
                          expandedAccordionItems={expandedAccordionItems}
                          setExpandedAccordionItems={setExpandedAccordionItems}
                          manuallyCollapsedItems={manuallyCollapsedItems}
                          setManuallyCollapsedItems={setManuallyCollapsedItems}
                          currentCourse={currentCourse}
                          audioExtractionStatus={audioExtractionStatus}
                          audioExtractionProgress={audioExtractionProgress}
                          audioExtractionStartTime={audioExtractionStartTime}
                          estimatedTimeRemaining={estimatedTimeRemaining}
                          getCurrentActiveRunNumber={getCurrentActiveRunNumber}
                          getStatusIcon={getStatusIcon}
                          setIsLoading={setIsLoading}
                          setProgress={setProgress}
                          setShouldPoll={setShouldPoll}
                          setQuestionGenParams={setQuestionGenParams}
                          setSegParams={setSegParams}
                          setRerunParams={setRerunParams}
                          currentUiStep={currentUiStep}
                          setCurrentUiStep={setCurrentUiStep}
                          progress={progress}
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
                          jobStatus={aiJobStatus}
                          runs={taskRuns.question}
                          taskRuns={taskRuns}
                          acceptedRuns={acceptedRuns}
                          aiJobId={aiJobId}
                          aiJobStatus={aiJobStatus}
                          handleAcceptRun={handleAcceptRun}
                          localParams={localParams}
                          setLocalParams={setLocalParams}
                          localSegParams={localSegParams}
                          setLocalSegParams={setLocalSegParams}
                          rerunParams={rerunParams}
                          videoItemBaseName={videoItemBaseName}
                          setVideoItemBaseName={setVideoItemBaseName}
                          quizItemBaseName={quizItemBaseName}
                          setQuizItemBaseName={setQuizItemBaseName}
                          questionsPerQuiz={questionsPerQuiz}
                          setQuestionsPerQuiz={setQuestionsPerQuiz}
                          acceptedRunId={acceptedRuns.question}
                          handleTask={handleTask}
                          handleStartTranscription={handleStartTranscription}
                          handleRefreshStatus={handleRefreshStatus}
                          handleStopTask={handleStopTask}
                          canRunTask={canRunTask}
                          expandedAccordionItems={expandedAccordionItems}
                          setExpandedAccordionItems={setExpandedAccordionItems}
                          manuallyCollapsedItems={manuallyCollapsedItems}
                          setManuallyCollapsedItems={setManuallyCollapsedItems}
                          currentCourse={currentCourse}
                          audioExtractionStatus={audioExtractionStatus}
                          audioExtractionProgress={audioExtractionProgress}
                          audioExtractionStartTime={audioExtractionStartTime}
                          estimatedTimeRemaining={estimatedTimeRemaining}
                          getCurrentActiveRunNumber={getCurrentActiveRunNumber}
                          getStatusIcon={getStatusIcon}
                          setIsLoading={setIsLoading}
                          setProgress={setProgress}
                          setShouldPoll={setShouldPoll}
                          setQuestionGenParams={setQuestionGenParams}
                          setSegParams={setSegParams}
                          setRerunParams={setRerunParams}
                          currentUiStep={currentUiStep}
                          setCurrentUiStep={setCurrentUiStep}
                          progress={progress}
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
                    jobStatus={aiJobStatus}
                    taskRuns={taskRuns}
                    acceptedRuns={acceptedRuns}
                    aiJobId={aiJobId}
                    aiJobStatus={aiJobStatus}
                    onAcceptRun={handleAcceptRun}
                    localParams={localParams}
                    setLocalParams={setLocalParams}
                    localSegParams={localSegParams}
                    setLocalSegParams={setLocalSegParams}
                    rerunParams={rerunParams}
                    videoItemBaseName={videoItemBaseName}
                    setVideoItemBaseName={setVideoItemBaseName}
                    quizItemBaseName={quizItemBaseName}
                    setQuizItemBaseName={setQuizItemBaseName}
                    questionsPerQuiz={questionsPerQuiz}
                    setQuestionsPerQuiz={setQuestionsPerQuiz}
                    acceptedRunId={acceptedRuns.upload}
                    handleTask={handleTask}
                    handleStartTranscription={handleStartTranscription}
                    handleRefreshStatus={handleRefreshStatus}
                    handleStopTask={handleStopTask}
                    canRunTask={canRunTask}
                    expandedAccordionItems={expandedAccordionItems}
                    setExpandedAccordionItems={setExpandedAccordionItems}
                    manuallyCollapsedItems={manuallyCollapsedItems}
                    setManuallyCollapsedItems={setManuallyCollapsedItems}
                    currentCourse={currentCourse}
                    audioExtractionStatus={audioExtractionStatus}
                    audioExtractionProgress={audioExtractionProgress}
                    audioExtractionStartTime={audioExtractionStartTime}
                    estimatedTimeRemaining={estimatedTimeRemaining}
                    getCurrentActiveRunNumber={getCurrentActiveRunNumber}
                    getStatusIcon={getStatusIcon}
                    setIsLoading={setIsLoading}
                    setProgress={setProgress}
                    setShouldPoll={setShouldPoll}
                    setQuestionGenParams={setQuestionGenParams}
                    setSegParams={setSegParams}
                    setRerunParams={setRerunParams}
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
                              console.warn("Publish might have deadlocked but succeeded. Verifying status...");
                              try {
                                // Wait longer (5s) for the DB to settle
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                const status = await aiSectionAPI.getJobStatus(aiJobId!) as any;
                                const uploadStatus = status.jobStatus?.uploadContent;
                                const hasResults = Array.isArray(status.uploadContent) && status.uploadContent.length > 0;

                                if (uploadStatus === "COMPLETED" || hasResults) {
                                  setTaskRuns(prev => ({
                                    ...prev,
                                    upload: prev.upload.map(run =>
                                      run.status === 'loading' ? { ...run, status: 'done', result: status } : run
                                    )
                                  }));
                                  toast.success('Section verified as uploaded successfully!');
                                  setAiJobStatus(status);
                                  return;
                                } else if (uploadStatus === "RUNNING" || uploadStatus === "PENDING") {
                                  console.info("Upload detected as active on server. Proceeding with polling.");
                                  setAiJobStatus(status);
                                  setShouldPoll(true);
                                  setIsLoading(true);
                                  toast.info("Upload is processing in the background...");
                                  return;
                                }
                              } catch (innerError) {
                                console.error("Failed to verify status after upload error:", innerError);
                              }
                              
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





