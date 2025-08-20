import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { aiSectionAPI } from "@/lib/genai-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Loader2,
  Edit,
  XCircle,
  PauseCircle,
  Plus,
  Trash2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCourseStore } from "@/store/course-store";
import { RunTranscriptSection } from "./run-transcription-section";
import { RunSegmentationSection } from "./run-segmentation-section";
import { RunQuestionSection } from "./run-question-section";

// Types (should match the main component)
type QuestionGenParams = {
  model: string;
  SQL: number;
  SML: number;
  NAT: number;
  DES: number;
  prompt: string;
};

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed";
  result?: any;
  parameters?: Record<string, unknown>;
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

interface TaskAccordionProps {
  task: keyof TaskRuns;
  title: string;
  jobStatus?: any;
  // State from parent component
  taskRuns: TaskRuns;
  acceptedRuns: Partial<Record<keyof TaskRuns, string>>;
  aiJobId: string | null;
  aiJobStatus: any;
  segParams: { lam: number; runs: number; noiseId: number };
  questionGenParams: QuestionGenParams;
  rerunParams: { language: string; model: string };
  // Functions from parent component
  handleTask: (task: keyof TaskRuns, segParams: any, questionGenParams: any) => Promise<void>;
  handleAcceptRun: (task: keyof TaskRuns, runId: string) => Promise<void>;
  canRunTask: (task: keyof TaskRuns) => boolean;
  setTaskRuns: React.Dispatch<React.SetStateAction<TaskRuns>>;
  setQuestionGenParams: React.Dispatch<React.SetStateAction<QuestionGenParams>>;
  setSegParams: React.Dispatch<React.SetStateAction<{ lam: number; runs: number; noiseId: number }>>;
  setRerunParams: React.Dispatch<React.SetStateAction<{ language: string; model: string }>>;
  handleStartTranscription: () => Promise<void>;
  getStatusIcon: (status: string) => React.ReactNode;
}

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
      return <TooltipProvider><Tooltip><TooltipTrigger asChild><span><div className="text-gray-400" /></span></TooltipTrigger><TooltipContent>Unknown</TooltipContent></Tooltip></TooltipProvider>;
  }
};

// EditSegmentsModalButton component
function EditSegmentsModalButton({ aiJobId, run, runIndex }: { aiJobId: string | null, run: TaskRun, runIndex: number }) {
  // This component logic would be moved here or kept in parent - simplified for now
  return null;
}

export const TaskAccordion = React.memo(({ 
  task, 
  title, 
  jobStatus,
  taskRuns,
  acceptedRuns,
  aiJobId,
  aiJobStatus,
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
  handleStartTranscription
}: TaskAccordionProps) => {
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
        {task === 'transcription' && aiJobStatus?.jobStatus?.audioExtraction === 'COMPLETED' && (
          <div className="mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleStartTranscription}
                    variant="default"
                    disabled={aiJobStatus?.jobStatus?.transcriptGeneration !== 'PENDING'}
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
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
              // ... existing logic for other tasks ...
              handleTask(task, localSegParams, localParams);
            }}
            disabled={!canRunTask(task) || runs.some(r => r.status === "loading")}
            className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none btn-beautiful"
          >
            {title}
          </Button>
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

          {task === 'segmentation' && jobStatus?.segmentation === 'COMPLETED' && (
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
                <AccordionItem key={run.id} value={run.id} className="border rounded my-2">
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