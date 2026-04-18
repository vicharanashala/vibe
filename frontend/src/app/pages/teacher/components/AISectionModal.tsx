import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Loader2, Play, Check } from "lucide-react";
import { toast } from "sonner";
import { aiSectionAPI, JobStatus } from "@/lib/genai-api";
import { useCourseStore } from "@/store/course-store";

interface AISectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSectionUploaded?: () => void;
}

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed";
  result?: any;
  parameters?: any;
}

interface TaskRuns {
  transcription: TaskRun[];
  segmentation: TaskRun[];
  question: TaskRun[];
  upload: TaskRun[];
}

function getApiUrl(path: string) {
  return `${import.meta.env.VITE_BASE_URL}${path}`;
}

// Removed fakeApiCall - now using real API calls

// YouTube URL validation function
const isValidYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
  return youtubeRegex.test(url);
};

export default function AISectionModal({ open, onOpenChange, onSectionUploaded }: AISectionModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [taskRuns, setTaskRuns] = useState<TaskRuns>({
    transcription: [],
    segmentation: [],
    question: [],
    upload: [],
  });
  const [acceptedRuns, setAcceptedRuns] = useState<{
    transcription?: string;
    segmentation?: string;
    question?: string;
    upload?: string;
  }>({});
  const [segParams, setSegParams] = useState({ segments: 5 });
  const [urlError, setUrlError] = useState<string | null>(null);
 


  
  const handleCreateJob = async () => {
    // Validate YouTube URL
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
      // Create a real GenAI job
      console.log('Creating GenAI job...');
      const { jobId } = await aiSectionAPI.createJob({
        videoUrl: youtubeUrl,
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId,
        moduleId: currentCourse.moduleId,
        sectionId: currentCourse.sectionId,
        videoItemBaseName: 'video_item',
        quizItemBaseName: 'quiz_item',
      });
      console.log('Job created with ID:', jobId);
      
      setAiJobId(jobId);
      toast.success("AI job created successfully!");
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error("Failed to create AI job. Please try again.");
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    
    // Clear error when user starts typing
    if (urlError) {
      setUrlError(null);
    }
  };

  const resetModal = () => {
    setYoutubeUrl("");
    setAiJobId(null);
    setTaskRuns({
      transcription: [],
      segmentation: [],
      question: [],
      upload: [],
    });
    setAcceptedRuns({});
    setSegParams({ segments: 5 });
    setUrlError(null);
  };

  const handleTask = async (task: keyof TaskRuns) => {
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

    setTaskRuns(prev => ({
      ...prev,
      [task]: [...prev[task], newRun],
    }));

    try {
      // Map UI task to backend task type and params
      let taskType = "";
      let params: Record<string, any> | undefined = undefined;
      switch (task) {
        case "transcription":
          taskType = "TRANSCRIPTION";
          break;
        case "segmentation":
          taskType = "SEGMENTATION";
          params = { segments: segParams.segments };
          break;
        case "question":
          taskType = "QUESTION_GENERATION";
          break;
        case "upload":
          taskType = "UPLOAD_TO_COURSE";
          break;
        default:
          throw new Error(`Unknown task: ${task}`);
      }
      
      // Post the task to the job
      await aiSectionAPI.postJobTask(aiJobId, taskType, params);

      // Poll for completion
      const finalStatus = await aiSectionAPI.pollForTaskCompletion(
        aiJobId,
        taskType,
        (status: JobStatus) => {
          setTaskRuns(prev => ({
            ...prev,
            [task]: prev[task].map(run =>
              run.id === runId
                ? {
                    ...run,
                    status:
                      status.currentTask?.type === taskType && status.currentTask.status === "COMPLETED"
                        ? "done"
                        : status.currentTask?.type === taskType && status.currentTask.status === "FAILED"
                        ? "failed"
                        : "loading",
                    result: status,
                  }
                : run
            ),
          }));
        }
      );

      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run => 
          run.id === runId ? { ...run, status: "done", result: finalStatus } : run
        ),
      }));

      if (task === "upload") {
        toast.success("Section successfully added to course!");
        if (onSectionUploaded) onSectionUploaded();
        setTimeout(() => {
          resetModal();
          onOpenChange(false);
        }, 1500);
      }
    } catch (error) {
      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run => 
          run.id === runId ? { ...run, status: "failed" } : run
        ),
      }));
      toast.error(`Task ${task} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleAcceptRun = (task: keyof TaskRuns, runId: string) => {
    setAcceptedRuns(prev => ({ ...prev, [task]: runId }));
    toast.success(`${task} run accepted!`);
  };

  const handleSegParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSegParams({ ...segParams, segments: Number(e.target.value) });
  };

  const canRunTask = (task: keyof TaskRuns): boolean => {
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

  const TaskAccordion = ({ task, title }: { task: keyof TaskRuns; title: string }) => {
    const runs = taskRuns[task];
    const acceptedRunId = acceptedRuns[task];

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleTask(task)}
            disabled={!canRunTask(task) || runs.some(r => r.status === "loading")}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2" />
            {title}
          </Button>
          {task === "segmentation" && (
            <>
              <span>Segments:</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={segParams.segments}
                onChange={handleSegParamChange}
                className="w-16"
                disabled={runs.some(r => r.status === "loading")}
              />
            </>
          )}
        </div>

        {runs.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {runs.map((run, index) => (
              <AccordionItem key={run.id} value={run.id}>
                <AccordionTrigger className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Run {index + 1}</span>
                    {run.status === "loading" && <Loader2 className="animate-spin w-4 h-4" />}
                    {run.status === "done" && <CheckCircle className="text-green-500 w-4 h-4" />}
                    {run.status === "failed" && <span className="text-red-500">Failed</span>}
                    {acceptedRunId === run.id && <Check className="text-blue-500 w-4 h-4" />}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {run.timestamp.toLocaleTimeString()}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {run.parameters && (
                      <div className="text-sm text-muted-foreground">
                        <strong>Parameters:</strong> {JSON.stringify(run.parameters)}
                      </div>
                    )}
                    {run.status === "done" && (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Result:</strong> {run.result}
                        </div>
                        {acceptedRunId !== run.id && (
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRun(task, run.id)}
                            className="w-full"
                          >
                            Accept This Run
                          </Button>
                        )}
                      </div>
                    )}
                    {run.status === "failed" && (
                      <div className="text-sm text-red-500">
                        This run failed. Try running the task again.
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Generate Section using AI</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-6 items-center w-full mt-4">
              <div className="flex-1 w-full">
                <Input
                  placeholder="YouTube URL"
                  value={youtubeUrl}
                  onChange={handleUrlChange}
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
                <TaskAccordion task="transcription" title="Transcription" />
                <TaskAccordion task="segmentation" title="Segmentation" />
                <TaskAccordion task="question" title="Question Generation" />
                <TaskAccordion task="upload" title="Upload to Course" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 