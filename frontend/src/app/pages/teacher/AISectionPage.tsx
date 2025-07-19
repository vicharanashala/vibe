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
  result?: string; // was any
  parameters?: Record<string, unknown>; // was any
}

interface TaskRuns {
  transcription: TaskRun[];
  segmentation: TaskRun[];
  question: TaskRun[];
  upload: TaskRun[];
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
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

  // json data for quiz questions
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
    "transcript": "Hi there, my name is Ganesh and this is my walkthrough of my video editor backend project. This is ExpressJS, WordPress SQL, with this over M and FM and PG for video processing. The goal of this application is to provide a scalable backend services for web-based video editor. Following the given assignment structure, it supports uploading videos, trimming, trimming and adding subtitles, rendering final of and downloading the result all by a few interesting APIs. So let me show you the GitHub repository. And here is the GitHub repository and readme file which includes the structured format of the application. So let me get through our project. So I have to build it. So let's start with the upload feature. So I have built a basic intent to interact with the backend here. Here I will select a sample file and upload it. So this is a basic intent to interact with the backend. So I will choose a video to... I will take this. So I will upload now. When I upload the video gets saved into the database and the server extracts metadata, like duration, size and file name using FM, FF, MP, and all of this is auditing database via Prisma. So when I take upload... So I will show the entry. So here is the entry of the new video product. So I will copy the idea of the video and I will upload it. So you can see the new entry made in database. And I am using super-based support presses 12 for database. So I selected the video ID. So let's go to the next part of the video, trimming the video. So in the front end, I will enter the video ID and I will like a wide to 15 seconds. So I will take a trim. So this ends the request to the AAS-Videos-ID slash trimming and what which was the FFM-BG to cut them that portion and save it to the directory. So the trimmer video gets a lot of... Here you can see the... As it ends successfully trim the video. So you can see the video is trimmed too. So the video is like one minute. Now we can see only 5 to 15 seconds of the... 10 seconds duration is trimmer term. So now let's go to the next part of the video. That is adding subtitles. So I will... Using the subtitle form, I can add a line of text and specify the start and intent. Correctly. This stores the subtitle into the database. And although the SAT file is not yet implemented. So the saving converting to SAT file is not working functionally. That's some... So the... When I enter the video ID and this is the... Triter... Start signal, let me give it to like 3 to 10 seconds. And I will add subtitles. So we can see that back and responded with success. So I will show... And since the subtitle is stored in the database, you can see the new entry in the database. Subtitle... See, this is the subtitle. We can see the new entry made in... And you can also see the ID to be made. It is also implemented in the database. We can see the start time file to 5 to 15 seconds. The video is streamed. And now let's go to the... Finally, we render the video. Like we select the ID. So... I will render this. So after rendering, I will download this video. So now let's go to our... I have implemented this locally. So I can see the final video of... I will show you. So you can see the successful accepted title has been laid on the video. And the video trimming has got down to... It's my part where I am matching with the postlates as well. And... I used it as a... Which was the routing. It's my overm for connection to... So the postlates as well database. So I created various functions for... To use fm. You can see the video pressing library. And here's the function secreted. So we can... So for trimming the video, it is the function like... The service has... And here is for creating a subtitle. And finally, adding text to the video. Which... It takes a subtitle from the database. And we'll always find out the video. And final render. And... Let's... So... The video panel which was the services of the fm.bj video. Processing library. Here it is the... Control of various controllers for uploading video. Trim video. And... Adding subtitles. The rendering video. And... Download video. So I am adding this controller to the... My router is as mentioned in the assignment. So the first... The uploadout. And second one is the... Trim route. And the one subtitle route. And fourth is render. And download. So... You can see the server is set up. And using express... For routing. And... This is the code for a security server. I... Basically... I use WilliamQ and... It is... It is implemented at the final stage. It is not working properly. But I tried my best to implement it for... Performing background tasks. So here is the code you can see. And... By now, I implemented local storage for... Floating and downloading videos. You can further scale it to... Make it... Getable by using Amazon history or like that. So... I also used the basic simple index arrangement too. So... The... The backend works. And the functioning of the backend. And... Here is the red memory file port. So... Thank you for taking the time to leave with this project. This was great tension challenge combining backend APIs. Video processing time for you. The full source code will be... In the GitHub repo. You can see this in my GitHub repo. You can visit and I will be posted in the... Assignment. Watch the meeting. Thank you.",
    "segments": [
      {
        "id": "cc0c2bff-92d8-4fab-b256-067ef9cf6639",
        "startTime": 0,
        "endTime": 300,
        "text": "Hi there, my name is Ganesh and this is my walkthrough of my video editor backend project...",
        "questions": [
          {
            "id": "8a1dd040-4df7-4845-85aa-8d2d0bf6c0f0",
            "question": "What is the main purpose of the application discussed in this walkthrough?",
            "options": [
              "To build a simple video player",
              "To create a scalable backend for a web-based video editor",
              "To develop a photo editing software",
              "To design a database management system"
            ],
            "correctAnswer": 1,
            "difficulty": "medium",
            "topic": "Application Purpose"
          },
          {
            "id": "d0fb88fc-32cf-473c-ba7c-a804fa1832b9",
            "question": "Which tool is used for video processing in the application?",
            "options": [
              "M and FM",
              "WordPress SQL",
              "PG",
              "FF, MP"
            ],
            "correctAnswer": 3,
            "difficulty": "easy",
            "topic": "Video Processing"
          },
          {
            "id": "54cbe356-2240-41a7-a364-607a8ee62684",
            "question": "Which database system is used for auditing in the application?",
            "options": [
              "PostgreSQL",
              "MySQL",
              "MongoDB",
              "SQLite"
            ],
            "correctAnswer": 1,
            "difficulty": "medium",
            "topic": "Database"
          },
          {
            "id": "6822db19-c2b6-4983-bcbf-59f220593a9a",
            "question": "What does the trimming feature allow in the video editor application?",
            "options": [
              "Allows users to add effects to videos",
              "Allows users to edit audio tracks of a video",
              "Allows users to split videos into multiple clips",
              "Allows users to adjust video resolution"
            ],
            "correctAnswer": 2,
            "difficulty": "hard",
            "topic": "Trimming Feature"
          }
        ]
      }
    ],
    "createdAt": "2025-05-24T12:02:32.586Z",
    "updatedAt": "2025-05-24T12:09:32.565Z",
    "duration":3000
  };



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
  const [showQuizQuestions, setShowQuizQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{ segmentId: string; questionId: string } | null>(null);
  const [editedQuestion, setEditedQuestion] = useState<Partial<Question>>({});
  const [videoDataState, setVideoDataState] = useState<VideoData>(sampleVideoData);

  
    // Use fetched data or fallback to sample data
    // const currentVideoData: VideoData = sampleVideoData;

    // Initialize videoDataState on mount or when currentVideoData changes
    // React.useEffect(() => {
    //   setVideoDataState(currentVideoData);
    // }, [currentVideoData]);

    const getDifficultyColor = (difficulty: Question['difficulty']): string => {
      switch (difficulty) {
        case 'easy': return 'text-green-600 bg-green-100';
        case 'medium': return 'text-yellow-600 bg-yellow-100';
        case 'hard': return 'text-red-600 bg-red-100';
        default: return 'text-gray-600 bg-gray-100';
      }
    };

     // Helper to start editing
  const handleEditClick = (segmentId: string, question: Question) => {
    setEditingQuestion({ segmentId, questionId: question.id });
    setEditedQuestion({ ...question });
  };

  // Helper to save edits
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
  };

  // Helper to cancel editing
  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setEditedQuestion({});
  };


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
    } catch {
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
      {/* Button to show/hide Quiz Questions Section */}
      <button
        className="bg-primary text-primary-foreground px-4 py-2 rounded mb-4 mt-8"
        onClick={() => setShowQuizQuestions((prev) => !prev)}
      >
        {showQuizQuestions ? "Hide Quiz Questions" : "Show Quiz Questions"}
      </button>
      {showQuizQuestions && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Quiz Questions</h3>
          <div className="space-y-6">
            {videoDataState?.segments.map((segment) => (
              <div key={segment.id}>
                <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 border p-3 sm:p-4 rounded-lg bg-muted">{`Questions for Segment ${(segment.startTime / 60)} min - ${(segment.endTime / 60)} min`}</h4>
                <div className="space-y-4 sm:space-y-6">
                  {segment.questions.map((question: Question, index: number) => {
                    const isEditing = editingQuestion && editingQuestion.segmentId === segment.id && editingQuestion.questionId === question.id;
                    return (
                      <div key={question.id} className="rounded-lg p-4 sm:p-6 bg-background border">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-2 mb-2 sm:mb-3">
                              <span className="text-xs sm:text-sm font-medium px-2 py-0.5 rounded bg-muted-foreground/10 text-foreground">
                                Question {index + 1}
                              </span>
                              <span className={`text-xs sm:text-sm font-medium px-2 py-0.5 rounded ${getDifficultyColor(question.difficulty)}`}>{question.difficulty}</span>
                              <span className="text-xs sm:text-sm px-2 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground">
                                {question.topic}
                              </span>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  className="w-full border rounded p-2 mb-2"
                                  value={editedQuestion.question || ''}
                                  onChange={e => setEditedQuestion(q => ({ ...q, question: e.target.value }))}
                                />
                                <div className="space-y-1">
                                  {editedQuestion.options?.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <input
                                        className="flex-1 border rounded p-1"
                                        value={opt}
                                        onChange={e => {
                                          const newOptions = [...(editedQuestion.options || [])];
                                          newOptions[optIdx] = e.target.value;
                                          setEditedQuestion(q => ({ ...q, options: newOptions }));
                                        }}
                                      />
                                      <input
                                        type="radio"
                                        name={`correct-${question.id}`}
                                        checked={editedQuestion.correctAnswer === optIdx}
                                        onChange={() => setEditedQuestion(q => ({ ...q, correctAnswer: optIdx }))}
                                      />
                                      <span className="text-xs">Correct</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    className="bg-green-600 text-white px-3 py-1 rounded"
                                    onClick={() => handleSaveEdit(segment.id, question.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="bg-gray-400 text-white px-3 py-1 rounded"
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-start mb-3 sm:mb-4">
                                  <h4 className="text-base sm:text-lg font-medium mb-0">{question.question}</h4>
                                  <button
                                    className="ml-2 px-3 py-1 rounded-full text-primary font-semibold hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary flex items-center text-xs sm:text-sm"
                                    style={{ minWidth: 48 }}
                                    onClick={() => handleEditClick(segment.id, question)}
                                    title="Edit Question"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {!isEditing && (
                          <div className="space-y-2">
                            {question.options.map((option: string, optionIndex: number) => (
                              <div
                                key={optionIndex}
                                className={`p-2 sm:p-3 rounded-lg border ${
                                  optionIndex === question.correctAnswer
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background border-muted text-foreground'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                                    optionIndex === question.correctAnswer
                                      ? ' text-primary-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {String.fromCharCode(65 + optionIndex)}
                                  </span>
                                  <span className="text-sm sm:text-base">{option}</span>
                                  {optionIndex === question.correctAnswer && (
                                    <CheckCircle className="h-4 w-4 text-green-600 ml-auto flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 