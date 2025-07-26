import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI, JobStatus } from "@/lib/genai-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle, 
  Loader2, 
  Play, 
  Check, 
  Edit, 
  Save, 
  X, 
  GripVertical,
  Plus,
  Trash2,
  Trophy,
  Clock,
  Lightbulb,
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

// Sample data with all question types
const sampleVideoData: VideoData = {
  "_id": "6831b558b4dee3410d3142eb",
  "id": "6ab9b5c0-9acd-4479-a0f2-74e30c3e093a",
  "filename": "video-1748088151484-122418722.mp4",
  "originalName": "Video Editing Demo - Made with Clipchamp.mp4",
  "mimetype": "video/mp4",
  "size": 62955908,
  "status": "completed",
  "progress": 100,
  "currentStep": "Processing completed successfully!",
  "uploadDate": "2025-05-24T12:02:32.577Z",
  "transcript": "Sample transcript...",
  "segments": [
    {
      "id": "cc0c2bff-92d8-4fab-b256-067ef9cf6639",
      "startTime": 0,
      "endTime": 300,
      "text": "Sample segment text...",
      "questions": [
        {
          "id": "8a1dd040-4df7-4845-85aa-8d2d0bf6c0f0",
          "type": "SELECT_ONE_IN_LOT",
          "question": "What is the main purpose of the application discussed in this walkthrough?",
          "options": [
            "To build a simple video player",
            "To create a scalable backend for a web-based video editor",
            "To develop a photo editing software",
            "To design a database management system"
          ],
          "correctAnswer": 1,
          "difficulty": "medium",
          "topic": "Application Purpose",
          "points": 10,
          "timeLimit": 60,
          "hint": "Think about what the application does with videos"
        },
        {
          "id": "d0fb88fc-32cf-473c-ba7c-a804fa1832b9",
          "type": "SELECT_MANY_IN_LOT",
          "question": "Which technologies are used in the video editor application?",
          "options": [
            "ExpressJS",
            "WordPress SQL",
            "FFmpeg",
            "MongoDB",
            "React"
          ],
          "correctAnswer": [0, 2, 4],
          "difficulty": "easy",
          "topic": "Technologies",
          "points": 15,
          "timeLimit": 90,
          "hint": "Select all technologies mentioned in the video"
        },
        {
          "id": "54cbe356-2240-41a7-a364-607a8ee62684",
          "type": "ORDER_THE_LOTS",
          "question": "Arrange the following steps in the correct order for video processing:",
          "options": [
            "Upload video",
            "Extract metadata",
            "Process video",
            "Save to database",
            "Generate output"
          ],
          "correctAnswer": ["Upload video", "Extract metadata", "Save to database", "Process video", "Generate output"],
          "difficulty": "medium",
          "topic": "Video Processing",
          "points": 20,
          "timeLimit": 120,
          "hint": "Think about the logical flow of video processing"
        },
        {
          "id": "6822db19-c2b6-4983-bcbf-59f220593a9a",
          "type": "NUMERIC_ANSWER_TYPE",
          "question": "What is the result of 15 * 3?",
          "correctAnswer": 45,
          "difficulty": "easy",
          "topic": "Mathematics",
          "points": 5,
          "timeLimit": 30,
          "decimalPrecision": 0,
          "expression": "15 * 3"
        },
        {
          "id": "9f3e7a1b-8c4d-4e5f-9a2b-3c4d5e6f7a8b",
          "type": "DESCRIPTIVE",
          "question": "Explain the main benefits of using a scalable backend for video processing.",
          "correctAnswer": "A scalable backend allows for handling multiple video processing requests simultaneously, provides better performance under load, and can be easily expanded as user demand grows.",
          "difficulty": "hard",
          "topic": "Architecture",
          "points": 25,
          "timeLimit": 180,
          "hint": "Consider performance, scalability, and user experience"
        }
      ]
    }
  ],
  "createdAt": "2025-05-24T12:02:32.586Z",
  "updatedAt": "2025-05-24T12:09:32.565Z",
  "duration": 3000
};

// Removed fakeApiCall - now using real API calls

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
  <div className="flex items-center justify-between mb-8 px-2">
    {WORKFLOW_STEPS.map((step, idx) => {
      const status = getStepStatus(jobStatus, step.key);
      const isLast = idx === WORKFLOW_STEPS.length - 1;
      return (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center">
            <div
              className={`rounded-full p-2 mb-1
                ${status === 'completed' ? 'bg-green-600 text-white' : ''}
                ${status === 'active' ? 'bg-blue-600 text-white animate-pulse' : ''}
                ${status === 'failed' ? 'bg-red-600 text-white' : ''}
                ${status === 'pending' ? 'bg-gray-700 text-gray-400' : ''}
              `}
              style={{ minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                status === 'active' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                status === 'failed' ? <XCircle className="w-5 h-5" /> :
                step.icon}
            </div>
            <span className="text-xs text-center mt-1" style={{ width: 80 }}>{step.label}</span>
          </div>
          {!isLast && <div className="flex-1 h-1 mx-1 bg-gray-700 rounded" style={{ minWidth: 24 }} />}
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



  // Drag and drop handlers for ORDER_THE_LOTS questions (unchanged)
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex === dropIndex) return;
    setEditedQuestion(prev => {
      const currentOptions = [...(prev.options || [])];
      const dragItem = currentOptions[dragIndex];
      currentOptions.splice(dragIndex, 1);
      currentOptions.splice(dropIndex, 0, dragItem);
      return { ...prev, options: currentOptions };
    });
  }, []);

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
  const [questionGenParams, setQuestionGenParams] = useState({
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
      console.log("[handleCreateJob] Set aiJobId:", jobId);
      toast.success("AI job created successfully!");
      // Do NOT start audio extraction here. Wait for user to click Transcription button.
    } catch (error) {
      toast.error("Failed to create AI job. Please try again.");
    }
  };

  // Refactored handleTask for transcription (no polling)
  const handleTask = async (task: keyof typeof taskRuns) => {
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
    } catch (error) {
      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run =>
          run.id === runId ? { ...run, status: "failed" } : run
        ),
      }));
      setAiWorkflowStep('error');
      toast.error(`Task ${task} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  const TaskAccordion = ({ task, title, jobStatus }: { task: keyof typeof taskRuns; title: string; jobStatus?: any }) => {
    console.log(`[TaskAccordion render] task: ${task}, runs:`, taskRuns[task]);
    const runs = taskRuns[task];
    const acceptedRunId = acceptedRuns[task];
    const { currentCourse } = useCourseStore();
    // Add state for upload parameters
    const [videoItemBaseName, setVideoItemBaseName] = useState("video_item");
    const [quizItemBaseName, setQuizItemBaseName] = useState("quiz_item");
    const [questionsPerQuiz, setQuestionsPerQuiz] = useState(1);
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
        {/* Always show question generation parameter inputs for 'question' task */}
        {task === 'question' && (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex flex-row gap-2">
              <div className="flex-1 flex flex-col">
                <label>Model:</label>
                <Input
                  type="text"
                  value={questionGenParams.model}
                  onChange={e => setQuestionGenParams(p => ({ ...p, model: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label>SOL:</label>
                <Input
                  type="number"
                  min={0}
                  value={questionGenParams.SQL}
                  onChange={e => setQuestionGenParams(p => ({ ...p, SQL: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label>SML:</label>
                <Input
                  type="number"
                  min={0}
                  value={questionGenParams.SML}
                  onChange={e => setQuestionGenParams(p => ({ ...p, SML: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label>NAT:</label>
                <Input
                  type="number"
                  min={0}
                  value={questionGenParams.NAT}
                  onChange={e => setQuestionGenParams(p => ({ ...p, NAT: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label>DES:</label>
                <Input
                  type="number"
                  min={0}
                  value={questionGenParams.DES}
                  onChange={e => setQuestionGenParams(p => ({ ...p, DES: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-col mt-2">
              <label>prompt:</label>
              <Textarea
                value={questionGenParams.prompt}
                onChange={e => setQuestionGenParams(p => ({ ...p, prompt: e.target.value }))}
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
              // ... existing logic for other tasks ...
              handleTask(task);
            }}
            disabled={!canRunTask(task) || runs.some(r => r.status === "loading")}
            className="flex-1"
          >
            {title}
          </Button>
          {/* Add three input boxes for segmentation parameters beside the Segmentation button */}
          {task === 'segmentation' && (
            <div className="flex flex-row gap-3 items-center ml-4 bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-700">
              <div className="flex flex-col items-start min-w-[80px]">
                <label htmlFor="seg-lam" className="text-[11px] font-semibold mb-1 text-gray-300">lam</label>
                <input
                  id="seg-lam"
                  type="text"
                  value={segParams.lam}
                  onChange={e => setSegParams(p => ({ ...p, lam: parseFloat(e.target.value) || 0 }))}
                  className="w-20 h-9 px-2 py-1 rounded-md border border-gray-600 bg-gray-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  style={{ fontSize: '15px' }}
                />
              </div>
              <div className="flex flex-col items-start min-w-[80px]">
                <label htmlFor="seg-runs" className="text-[11px] font-semibold mb-1 text-gray-300">runs</label>
                <input
                  id="seg-runs"
                  type="text"
                  value={segParams.runs}
                  onChange={e => setSegParams(p => ({ ...p, runs: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-9 px-2 py-1 rounded-md border border-gray-600 bg-gray-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  style={{ fontSize: '15px' }}
                />
              </div>
              <div className="flex flex-col items-start min-w-[80px]">
                <label htmlFor="seg-noiseId" className="text-[11px] font-semibold mb-1 text-gray-300">noiseId</label>
                <input
                  id="seg-noiseId"
                  type="text"
                  value={segParams.noiseId}
                  onChange={e => setSegParams(p => ({ ...p, noiseId: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-9 px-2 py-1 rounded-md border border-gray-600 bg-gray-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  style={{ fontSize: '15px' }}
                />
              </div>
            </div>
          )}
          {/* Add Re-run Transcription button */}
          {task === 'transcription' && jobStatus?.transcriptGeneration === 'COMPLETED' && (
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
          {task === 'question' && jobStatus?.questionGeneration === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!aiJobId) return;
                try {
                  // Use the current values from the parameter inputs
                  const params = questionGenParams;
                  await aiSectionAPI.rerunJobTask(aiJobId, 'QUESTION_GENERATION', params);
                  toast.success('Question generation rerun started. Click Refresh to check status.');
                  setTaskRuns(prev => ({
                    ...prev,
                    question: [
                      ...prev.question,
                      {
                        id: `run-${Date.now()}-${Math.random()}`,
                        timestamp: new Date(),
                        status: "loading",
                        parameters: { ...params }
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
        
          {task === 'segmentation' && jobStatus?.segmentation === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!aiJobId) return;
                try {
                  // Always use the latest values from segParams for the payload
                  const params = { lam: segParams.lam, runs: segParams.runs, noiseId: segParams.noiseId };
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
            {runs.map((run, index) => {
              // Declare segParamsNodes for this run
              const segParamsNodes: React.ReactNode[] =
                task === "segmentation" && run.parameters
                  ? [
                      run.parameters.lam !== undefined ? (<span key="lam"><strong>Lambda:</strong> {run.parameters.lam}</span>) : undefined,
                      run.parameters.runs !== undefined ? (<span key="runs"><strong>Runs:</strong> {run.parameters.runs}</span>) : undefined,
                      run.parameters.noiseId !== undefined ? (<span key="noiseId"><strong>Noise ID:</strong> {run.parameters.noiseId}</span>) : undefined,
                    ].filter((x): x is React.ReactNode => x != null)
                  : [];
              return (
                <AccordionItem key={run.id} value={run.id} className="border rounded my-2">
                  <AccordionTrigger className="flex items-center gap-2 px-2 py-1">
                      <span>Run {index + 1}</span>
                    <span className="text-sm text-muted-foreground">{run.timestamp.toLocaleTimeString()}</span>
                    {getStatusIcon(run.status)}
                    {acceptedRunId === run.id && <span className="text-blue-500">Accepted</span>}
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-2">
                      {run.parameters && (
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-4 mb-2">
                          {task === "segmentation" ? segParamsNodes : (
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
                        <div className="text-sm text-red-500">
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
  };

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

  const handleOptionText = (idx: number, value: string) => setOptions(opts => opts.map((o, i) => i === idx ? { ...o, text: value } : o));
  const handleOptionExplain = (idx: number, value: string) => setOptions(opts => opts.map((o, i) => i === idx ? { ...o, explaination: value } : o));
  const handleCorrect = (idx: number, checked: boolean) => {
    setOptions(opts => opts.map((o, i) =>
      normalized.type === 'SELECT_ONE_IN_LOT'
        ? { ...o, correct: i === idx }
        : i === idx ? { ...o, correct: checked } : o
    ));
  };
  const handleAddOption = () => setOptions(opts => [...opts, { text: '', explaination: '', correct: false }]);
  const handleRemoveOption = (idx: number) => setOptions(opts => opts.filter((_, i) => i !== idx));

  const canSave = questionText.trim() && options.length >= 2 && options.every(o => o.text.trim() && o.explaination.trim()) && options.some(o => o.correct);

  const buildSolution = () => {
    const correctOpts = options.filter(o => o.correct).map(o => ({ text: o.text, explaination: o.explaination }));
    const incorrectOpts = options.filter(o => !o.correct).map(o => ({ text: o.text, explaination: o.explaination }));
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
          {options.map((option, idx) => (
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
        const localUrl = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
        const backendUrl = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
        let res = await fetch(localUrl, { headers: { 'Authorization': `Bearer ${token}` } });
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
        } else {
          toast.info('Transcript generation is not ready to start yet.');
        }
      } else if (status.jobStatus?.transcriptGeneration === 'WAITING') {
        await aiSectionAPI.postJobTask(aiJobId, 'TRANSCRIPT_GENERATION');
        setAiWorkflowStep('transcription');
        toast.success('Transcript generation started. Click Refresh to check status.');
      } else {
        toast.info('Transcript generation is not ready to start.');
      }
    } catch (error) {
      setAiWorkflowStep('error');
      toast.error('Failed to start transcript generation.');
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
        <Button size="sm" variant="secondary" onClick={handleShowTranscript} className="w-full">
          {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </Button>
        {/* Edit button for transcript run */}
        <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="w-full">
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
          <div className="bg-gray-900 text-gray-100 p-3 rounded max-h-48 overflow-y-auto text-sm border border-gray-700">
            <strong>Transcript:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-400">{error}</div>}
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
            className="w-full"
            disabled={run.status !== 'done'}
          >
            {showSegmentation ? 'Hide Segmentation' : 'Show Segmentation'}
          </Button>
          {/* Edit button for segmentation run */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full"
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
                      <div className="text-xs text-gray-300 bg-gray-800 rounded p-2 mt-1">
                        {segText}
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={handleAddSeg} className="w-full"><Plus className="h-4 w-4 mr-2" />Add Segment</Button>
              </div>
            )}
            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEditSeg} disabled={editLoading}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {showSegmentation && (
          <div className="bg-gray-900 text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-700 mt-2">
            <strong>Segments:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-400">{error}</div>}
            {/* Enhanced display: segmentationMap + transcript chunks */}
            {!loading && !error && segmentationMap && segmentationMap.length > 0 && segmentationChunks && (
              <ol className="mt-2 space-y-4">
                {segmentationMap.map((end, idx) => {
                  const start = idx === 0 ? 0 : segmentationMap[idx - 1];
                  const segChunks = segmentationChunks[idx] || [];
                  return (
                    <li key={idx} className="border-b border-gray-700 pb-2">
                      <div><b>Segment {idx + 1}:</b> {start.toFixed(2)}s – {end.toFixed(2)}s</div>
                      {segChunks.length > 0 ? (
                        <div className="text-xs text-gray-300 mt-1">
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
                  <li key={idx} className="border-b border-gray-700 pb-1">
                    <div><b>Segment {idx + 1}</b> ({seg.startTime ?? seg.timestamp?.[0]}s - {seg.endTime ?? seg.timestamp?.[1]}s)</div>
                    <div className="text-xs text-gray-300">{seg.text}</div>
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
            className="w-full mt-2"
          >
            Edit Segments
          </Button>
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
        <Button size="sm" variant="secondary" onClick={handleShowQuestions} className="w-full">
          {showQuestions ? 'Hide Questions' : 'Show Questions'}
        </Button>
        {showQuestions && (
          <div className="bg-gray-900 text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-700 mt-2">
            <strong>Questions:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-400">{error}</div>}
            {!loading && !error && questions.length > 0 && (
              <ol className="mt-2 space-y-4">
                {questions.map((q: any, idx: number) => {
                  let segIdx = segmentIds.findIndex((sid: any) => sid === q.segmentId);
                  let segStart = segIdx === 0 ? 0 : segmentIds[segIdx - 1];
                  let segEnd = q.segmentId;
                  return (
                    <li key={q.question?.text || idx} className="border-b border-gray-700 pb-2">
                      <div className="text-xs text-gray-400 mb-1">
                        Segment: {typeof segStart === 'number' && typeof segEnd === 'number' ? `${segStart}–${segEnd}s` : 'N/A'} | Type: {q.questionType || q.question?.type || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold flex-1">Q{idx + 1}: {q.question?.text}</div>
                        <Button size="sm" variant="outline" onClick={() => { setEditingIdx(idx); setEditQuestion(JSON.parse(JSON.stringify(q))); setEditModalOpen(true); }}>
                          <Edit className="w-4 h-4" /> Edit
                        </Button>
                      </div>
                      {q.question?.hint && <div className="text-xs text-gray-400 mb-1">Hint: {q.question.hint}</div>}
                      {q.solution && (
                        <>
                          <div className="mt-1"><b>Options:</b></div>
                          <ul className="list-disc ml-6">
                            {q.solution.incorrectLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`inc-${oIdx}`} className="text-red-300">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`cor-${oIdx}`} className="text-green-400 font-semibold">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItem && (
                              <li className="text-green-400 font-semibold">{q.solution.correctLotItem.text}</li>
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
                    setEditingQuestion(null);
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
    <div className="max-w-6xl w-full mx-auto py-10 px-4">
      {/* AI Section Workflow Inline */}
      <div className="bg-muted/30 rounded-xl shadow p-8 mb-8">
        <h1 className="text-2xl font-bold mb-8 text-center">Generate Section using AI</h1>
        {/* Stepper */}
        <Stepper jobStatus={aiJobStatus?.jobStatus} />
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
              className="w-full sm:w-auto mt-2 sm:mt-0"
            >
              {aiJobId ? "Job Created" : "Create AI Job"}
            </Button>
          </div>
          {aiJobId && (
            <div className="space-y-6">
              {/* Refresh button and status */}
              <div className="flex items-center gap-4 mb-2">
                <Button onClick={handleRefreshStatus} variant="outline">
                  Refresh Status
                </Button>
                {/* Show Start Transcription button only when extraction is done and transcript is not completed */}
                {aiJobStatus?.jobStatus?.audioExtraction === 'COMPLETED' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleStartTranscription}
                          variant="default"
                          disabled={aiJobStatus?.jobStatus?.transcriptGeneration !== 'PENDING'}
                        >
                          Start Transcription Task
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {aiJobStatus?.jobStatus?.transcriptGeneration === 'PENDING' && (
                          <span>
                            Approves the transcript task. Click again when status is <b>WAITING</b> to actually start transcription.
                          </span>
                        )}
                        {aiJobStatus?.jobStatus?.transcriptGeneration === 'WAITING' && (
                          <span>
                            Starts the transcript generation task. Status will move to <b>RUNNING</b>.
                          </span>
                        )}
                        {aiJobStatus?.jobStatus?.transcriptGeneration !== 'PENDING' && aiJobStatus?.jobStatus?.transcriptGeneration !== 'WAITING' && (
                          <span>
                            Transcript generation is not ready to start yet.
                          </span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {/* Task Cards */}
              <div className="space-y-8 mt-8">
                {/* Transcription Section */}
                <div className="bg-gray-900 rounded-xl p-6 shadow border border-gray-800 w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-xl">Transcription</span>
                  </div>
              <TaskAccordion task="transcription" title="Audio Extraction" jobStatus={aiJobStatus?.jobStatus} />
                </div>

                {/* Segmentation Section */}
                <div className="bg-gray-900 rounded-xl p-6 shadow border border-gray-800 w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <ListChecks className="w-5 h-5 text-yellow-400" />
                    <span className="font-semibold text-xl">Segmentation</span>
                  </div>
              <TaskAccordion task="segmentation" title="Segmentation" jobStatus={aiJobStatus?.jobStatus} />
                </div>

                {/* Question Generation Section */}
                <div className="bg-gray-900 rounded-xl p-6 shadow border border-gray-800 w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquareText className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-xl">Question Generation</span>
                  </div>
              <TaskAccordion task="question" title="Question Generation" jobStatus={aiJobStatus?.jobStatus} />
                </div>

                {/* Upload Section */}
                <div className="bg-gray-900 rounded-xl p-6 shadow border border-gray-800 w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="w-5 h-5 text-green-400" />
                    <span className="font-semibold text-xl">Upload to Course</span>
                  </div>
              <TaskAccordion task="upload" title="Upload to Course" jobStatus={aiJobStatus?.jobStatus} />
                </div>
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
  try { errMsg = (await res.json()).message || errMsg; } catch {}
  if (res.status === 400) throw new Error('Bad request: ' + errMsg);
  if (res.status === 403) throw new Error('Forbidden: ' + errMsg);
  if (res.status === 404) throw new Error('Job not found: ' + errMsg);
  throw new Error(errMsg);
}