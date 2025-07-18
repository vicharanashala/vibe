import * as React from "react";
import { useState } from "react";
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

// No props needed for a page

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

const fakeApiCall = () => new Promise((res) => setTimeout(res, 1200));

// YouTube URL validation function
const isValidYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
  return youtubeRegex.test(url);
};

export default function AISectionPage() {
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
    // Simulate job creation
    setAiJobId("ai-job-" + Math.floor(Math.random() * 10000));
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    if (urlError) {
      setUrlError(null);
    }
  };

  const resetPage = () => {
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
      await fakeApiCall();
      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run =>
          run.id === runId
            ? { ...run, status: "done", result: `Sample result for ${task} run ${prev[task].length}` }
            : run
        ),
      }));
      if (task === "upload") {
        toast.success("Section successfully added to course!");
        setTimeout(() => {
          resetPage();
        }, 1500);
      }
    } catch (error) {
      setTaskRuns(prev => ({
        ...prev,
        [task]: prev[task].map(run =>
          run.id === runId
            ? { ...run, status: "failed" }
            : run
        ),
      }));
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
                    {task === 'upload' ? (
                      <>
                        {run.status === 'loading' && <><span>Creating course...</span> <Loader2 className="animate-spin w-4 h-4" /></>}
                        {run.status === 'done' && <><span>Done</span> <CheckCircle className="text-green-500 w-4 h-4" /></>}
                        {run.status === 'failed' && <span className="text-red-500">Failed</span>}
                      </>
                    ) : (
                      <>
                        <span>Run {index + 1}</span>
                        {run.status === "loading" && <Loader2 className="animate-spin w-4 h-4" />}
                        {run.status === "done" && <CheckCircle className="text-green-500 w-4 h-4" />}
                        {run.status === "failed" && <span className="text-red-500">Failed</span>}
                        {acceptedRunId === run.id && <Check className="text-blue-500 w-4 h-4" />}
                      </>
                    )}
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
                    {run.status === "done" && task !== 'upload' && (
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
    <div className="max-w-4xl w-full mx-auto py-10 px-4">
      <div className="bg-muted/30 rounded-xl shadow p-8">
        <h1 className="text-2xl font-bold mb-8 text-center">Generate Section using AI</h1>
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
    </div>
  );
} 