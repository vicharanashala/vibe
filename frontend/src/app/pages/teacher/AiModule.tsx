// @ts-nocheck

import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { useNavigate } from '@tanstack/react-router';;
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionGenerationView, SegmentationView, UploadContentView, UploadParams, YoutubeUrlInput } from "./AiWorkflow";
import { AudioTranscripter } from "./AudioTranscripter";
import { TranscriberData } from "@/hooks/useTranscriber";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";
import { aiSectionAPI, Chunk, QuestionGenerationParameters, SegmentationParameters, getJobStatus, getApiUrl } from "@/lib/genai-api";
import { CurrentJob } from "./AiWorkflow";




const AiModule = () => {
  const { currentCourse } = useCourseStore();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isURLValidated, setIsURLValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState(false);
  const [videoId, setVideoId] = useState<string | null>("");
  const [isAudioExtracting, setIsAudioExtracting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined)
  const [isCreatingAiJob, setIsCreatingAiJob] = useState(false);
  const [isAiJobStarted, setIsAiJobStarted] = useState(false);
  const [currentJob, setCurrentJob] = useState<CurrentJob>({ task: "AUDIO_EXTRACTION", status: "WAITING" })
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null);
  const [isApprovingTask, setIsApprovingTask] = useState(false);
  const [isWaitingServer, setIsWaitingServer] = useState(false);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [isTaskResultLoading, setIsTaskResultLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [segmentationMap, setSegmentationMap] = useState<number[] | null | string[]>(null)
  const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [chunkTranscription, setChunkTranscription] = useState<object[]>([]);
  const [showSegments, setShowSegments] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showUploadContent, setShowUploadContent] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [showGenerateQuestion, setShowGeneateQuestion] = useState(false)

  const STEP_ORDER = {
    AUDIO_EXTRACTION: 0,
    TRANSCRIPT_GENERATION: 1,
    SEGMENTATION: 2,
    QUESTION_GENERATION: 3,
    UPLOAD_CONTENT: 4
  };



  const navigate = useNavigate();



  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLDivElement>(null);
  const lastStartTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);

  const clearStoredQuestions = () => {
    localStorage.removeItem('questions');
  };

  const [uploadParams, setUploadParams] = useState<UploadParams>({
    videoItemBaseName: "video_item",
    quizItemBaseName: "quiz_item",
    audioProvided: true,
    questionsPerQuiz: null,
  });
  const [customQuestionParams, setCustomQuestionParams] =
    useState<QuestionGenerationParameters>({

      SOL: 10,
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
      numberOfQuestions: 10
    });
  const [customSegmentationParams, setCustomSegmentationParams] =
    useState<SegmentationParameters>({
      lam: 4.5,
      runs: 25,
      noiseId: -1,
    });

  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  };

  const extractIdFromUrl = (url: string): string | null => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
  const handleValidateURL = () => {
    if (!youtubeUrl.trim()) {
      setUrlError("YouTube URL is required");

      return;
    }
    if (!isValidYouTubeUrl(youtubeUrl.trim())) {
      setUrlError("Please enter a valid YouTube URL");
      return;
    }
    const id = extractIdFromUrl(youtubeUrl.trim());
    setVideoId(id);
    clearStoredQuestions();
    setIsLoading(true)

    setTimeout(() => {
      setIsURLValidated(true);
      setIsLoading(false);
    }, 500);
  }

  const handleCreateJob = async () => {
    clearStoredQuestions();
    // 1. Check transcription text is there
    if (!transcribedData?.text) {
      toast.error("No transcript found, Try again!");
      return;
    };
    // 2. Track creation for UI
    setIsCreatingAiJob(true);
    setError("");
    // 3. Chunks of transcription
    const chunks: Chunk[] = transcribedData.chunks.map(c => ({
      text: c.text,
      timestamp: c.timestamp.map(t => t ?? 0), // convert null to 0
    }));

    // 4. Get courseId and versionId from store
    const { currentCourse } = useCourseStore.getState();
    if (!currentCourse?.courseId || !currentCourse?.versionId) {
      toast.error("Missing course or version information");
      return;
    }

    try {
      // 5. Build job parameters
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


      jobParams.segmentationParameters = {
        lam: customSegmentationParams.lam ?? 4.5,
        runs: customSegmentationParams.runs ?? 25,
        noiseId: customSegmentationParams.noiseId ?? -1,
      };

      jobParams.questionGenerationParameters = {

        SOL: customQuestionParams.SOL ?? 10,
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

      // 6. Create AI Job
      const { jobId } = await aiSectionAPI.createJob(jobParams);
      setAiJobId(jobId);
      setIsAiJobStarted(true);
      // 7. Set current job status
      setCurrentJob({ status: "WAITING", task: 'SEGMENTATION' });

    } catch (error) {
      setCurrentJob({ status: "FAILED", task: 'TRANSCRIPT_GENERATION' })
      toast.error("An error occured. Please try again!");
      setError("Failed to create ai job");
    } finally {
      // 8. Stop progress bar and loading
      setIsCreatingAiJob(false);
    }
  };

    const handleDeleteSegmentation = (indexToDelete: number) => {

  setChunkTranscription((prev) =>
    prev.filter((_, index) => index !== indexToDelete)
  );
};


  const getCurrentTask = (jobStatus: JobStatus["jobStatus"]): { task: any, status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" } | null => {
    if (!jobStatus) return null;
    const TASK_ORDER: (keyof typeof jobStatus)[] = [
      "audioExtraction",
      "transcriptGeneration",
      "segmentation",
      "questionGeneration",
      "uploadContent",
    ];
    // Check running task
    const runningTask = TASK_ORDER.find((key) => jobStatus[key] === "RUNNING");
    if (runningTask) return { task: runningTask, status: "RUNNING" }
    // Check for failed task 
    const failedTask = TASK_ORDER.find((key) => jobStatus[key] === "FAILED");
    if (failedTask) return { task: failedTask, status: "FAILED" };

    // Check for pending/waiting task
    const pendingTask = TASK_ORDER.find(
      (key) => jobStatus[key] === "WAITING" || jobStatus[key] === "PENDING"
    );
    if (pendingTask) return { task: pendingTask, status: "PENDING" };

    // Return last completed task
    const completedTasks = TASK_ORDER.filter((key) => jobStatus[key] === "COMPLETED");
    if (completedTasks.length > 0) {
      const lastTask = completedTasks[completedTasks.length - 1];
      return { task: lastTask, status: "COMPLETED" };
    }

    return null;
  };

  const updateCurrentJob = (
    task: "segmentation" | "questionGeneration" | "uploadContent" | "audioExtraction",
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | "WAITING",
  ) => {
    const taskMap: Record<string, string> = {
      segmentation: "SEGMENTATION",
      questionGeneration: "QUESTION_GENERATION",
      uploadContent: "UPLOAD_CONTENT",
      audioExtraction: "AUDIO_EXTRACTION"
    };

    setCurrentJob({
      status,
      task: taskMap[task],
    });
  };

  const handleRefreshStatus = async () => {
    if (!aiJobId) return;
    try {
      const status = await aiSectionAPI.getJobStatus(aiJobId);
      const currentTaskData = getCurrentTask(status.jobStatus);

      if (!currentTaskData) {
        toast.error("Current task is missing");
        return;
      }

      const currentTask = currentTaskData.task;
      const currentStatus = currentTaskData.status;
      // const current
      setAiJobStatus({ ...status, task: currentTask, status: currentStatus });
      updateCurrentJob(currentTask, currentStatus);

      if (currentTask == "uploadContent" && currentStatus == "COMPLETED") {
        setTimeout(() => setIsLoading(false), 500);
      }

    } catch (error) {
      toast.error('Failed to refresh status.');
    }
  };


  const handleApproveTask = async (qnGenParams?: QuestionGenerationParameters, filteredQuestions?: any[]) => {
    try {
      // 1. Check aiJobId
      if (!aiJobId) {
        toast.error("Job not found");
        return;
      }
      setError("");
      setIsApprovingTask(true);

      setIsWaitingServer(false) // set to false, because now we are going to hit server again!
      // 2. Fetch status to get current job
      const status = await aiSectionAPI.getJobStatus(aiJobId);

      if (!status || !status.jobStatus) {
        toast.error("Failed to fetch job status, Try again!");
        return;
      }

      const currentTaskData = getCurrentTask(status.jobStatus);

      if (!currentTaskData) {
        toast.error("Current task is missing");
        return;
      }

      const currentTask = currentTaskData.task;
      const currentStatus = currentTaskData.status;

      if (currentTask == "uploadContent") // Manully adding upload status, becuae live status api will not trigger
        updateCurrentJob("uploadContent", "RUNNING");

      setAiJobStatus({ ...status, task: currentTask, status: currentStatus });


      const customUploadParams: any = {
        courseId: currentCourse?.courseId,
        versionId: currentCourse?.versionId,
        moduleId: currentCourse?.moduleId,
        sectionId: currentCourse?.sectionId,
        videoItemBaseName: uploadParams.videoItemBaseName,
        quizItemBaseName: uploadParams.quizItemBaseName,
        questionsPerQuiz: uploadParams.questionsPerQuiz
      };

      if (filteredQuestions && filteredQuestions.length > 0) {
        customUploadParams.questions = filteredQuestions;
      } else {
        try {
          const storedQuestions = sessionStorage.getItem('questions');
          if (storedQuestions) {
            const parsedQuestions = JSON.parse(storedQuestions);
            const acceptedQuestions = parsedQuestions.filter((q: any) => q.isAccept === true);
            if (acceptedQuestions.length > 0) {
              customUploadParams.questions = acceptedQuestions;
            }
          }
        } catch (error) {
          console.error('Error getting accepted questions from sessionStorage:', error);
        }
      }

      const customQuestionGenParams = qnGenParams || customQuestionParams;

      let params: Record<string, any> | null = null;
      // 3. Set proper request params
      switch (currentTask) {
        case 'segmentation':
          params = { parameters: customSegmentationParams, usePrevious: 0, type: "SEGMENTATION" };
          break;
        case 'questionGeneration':
          params = { parameters: customQuestionGenParams, type: "QUESTION_GENERATION" };
          break;
        case 'uploadContent':
          params = { parameters: customUploadParams, type: "UPLOAD_CONTENT", usePrevious: 0 };
          break;
        default:
          console.error("Invalid current task", currentTask);
          toast.error("Invalida current task");
          return;
      }
      // 4. Trigger continue and start task
      await aiSectionAPI.approveContinueTask(aiJobId);
      await aiSectionAPI.approveStartTask(aiJobId, params);

      toast.success("Task approved!");
      setShouldPoll(true);
      setIsWaitingServer(true) // setting true until we get response from live status ap

      if (currentTask == "uploadContent") {
        handleRefreshStatus(); // for upload content status refresh
        toast.success("Content upload successfully!");
      }

    } catch (error) {
      if (!isWaitingServer) {
        toast.error("Failed to approve task");
      } else {
        toast.error("Failed to retry task");
      }
      setTimeout(() => setIsLoading(false), 500);
      setIsWaitingServer(false);
      setError("Failed to approve task")
    } finally {
      setIsApprovingTask(false);
    }
  }


  useEffect(() => {

    function createPlayer() {

      if (!isURLValidated || !iframeRef.current || !videoId) {
        return;
      }

      playerRef.current = new window.YT!.Player(iframeRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          autoplay: 0,
        },
        events: {
          onReady: (event: any) => {

            const duration = event.target.getDuration();

            setVideoDuration(duration);
            setVideoPlayer(true);
          },
          onStateChange(event: any) {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              lastStartTimeRef.current = playerRef.current.getCurrentTime();

              setIsPaused(false);
              setStartTime(lastStartTimeRef.current);
            }
            if (event.data === window.YT?.PlayerState.PAUSED) {
              pauseTimeRef.current = playerRef.current.getCurrentTime();

              setIsPaused(true);
              setEndTime(pauseTimeRef.current);
            }
            if (event.data === window.YT?.PlayerState.ENDED) {
              const duration = playerRef.current.getDuration()
              endTimeRef.current = playerRef.current.getCurrentTime();
              if (Math.abs(duration - endTimeRef.current) < 1) {
                endTimeRef.current = duration
              }

              setIsPaused(true);
              setEndTime(endTimeRef.current);
              setShowGeneateQuestion(true)
            }
          },
        }
      })
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }


    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [isURLValidated, videoId]);


  useEffect(() => {

    const callHandleApproveTask = async () => {
      if (!aiJobId) {
        return
      }
      await handleApproveTask()
    }

    callHandleApproveTask()
  }, [aiJobId])

  const parseTimeToSeconds = (time: string): number => {
    if (!time) return 0;
    const cleaned = time.replace(/\[|\]/g, '').trim().replace(',', '.');

    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      if (parts.length === 3) {
        const [mStr, sStr, msStr] = parts;
        const m = parseInt(mStr || '0', 10);
        const s = parseInt(sStr || '0', 10);
        const ms = parseInt(msStr || '0', 10);
        if (isNaN(m)) return 0;
        if (isNaN(s)) return m * 60;
        if (isNaN(ms)) return m * 60 + s;
        return m * 60 + s + ms / 1000;
      } else if (parts.length === 2) {
        const [first, second] = parts;
        const isMs = (second || '').length <= 3 && /^(\d{1,3})$/.test(second || '');
        if (isMs && (first || '').length <= 3) {
          const sec = parseInt(first || '0', 10);
          const msRaw = (second || '').slice(0, 3);
          const msNum = parseInt(msRaw || '0', 10) || 0;
          if (isNaN(sec)) return 0;
          return sec + msNum / 1000;
        }
        const m = parseInt(first || '0', 10);
        const s = parseInt(second || '0', 10);
        if (isNaN(m)) return 0;
        if (isNaN(s)) return m * 60;
        return m * 60 + s;
      }
    }
    if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (parts.length === 3) {
        const [mStr, sStr, msStr] = parts;
        const m = parseInt(mStr || '0', 10);
        const s = parseInt(sStr || '0', 10);
        const ms = parseInt((msStr || '').slice(0, 3) || '0', 10) || 0;
        if (isNaN(m)) return 0;
        if (isNaN(s)) return m * 60;
        return m * 60 + s + ms / 1000;
      } else if (parts.length === 2) {
        const [secStr, msStrRaw] = parts;
        const sec = parseInt(secStr || '0', 10) || 0;
        const msNum = parseInt((msStrRaw || '').slice(0, 3) || '0', 10) || 0;
        return sec + msNum / 1000;
      }
    }
    const sOnly = parseInt(cleaned, 10);
    return isNaN(sOnly) ? 0 : sOnly;
  };

  const fetchSegmentationFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch segmentation file");
    const data = await response.json();

    if (Array.isArray(data.segments)) {
      return data.segments;
    }
    if (Array.isArray(data.chunks)) {
      return data.chunks;
    }
    return data;
  };

  const handleExtractSegmentationResponse = async (response: any) => {
    try {
      let segData = null;
      if (Array.isArray(response)) {
        const length = response.length;
        segData = response[length - 1]
      }
      // const segData = Array.isArray(response) ? response[0] : null;

      if (
        segData &&
        segData.segmentationMap &&
        Array.isArray(segData.segmentationMap) &&
        segData.transcriptFileUrl
      ) {
        setSegmentationMap(segData.segmentationMap);
        setIsTaskResultLoading(true);
        const transcriptRes = await fetch(segData.transcriptFileUrl);
        if (!transcriptRes.ok)
          throw new Error("Failed to fetch transcript file");

        const transcriptData = await transcriptRes.json();
        const chunks = Array.isArray(transcriptData.chunks)
          ? transcriptData.chunks
          : [];
        const segMap = (segData.segmentationMap || []).map((v: any) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') return parseTimeToSeconds(v);
          return 0;
        });
        const grouped: any[][] = [];

        let segStart = 0;
        for (let i = 0; i < segMap.length; ++i) {
          const segEnd = segMap[i];
          const segChunks = chunks.filter(
            (chunk: { timestamp: [number, number]; text: string }) =>
              chunk.timestamp &&
              typeof chunk.timestamp[0] === "number" &&
              chunk.timestamp[0] >= segStart &&
              chunk.timestamp[0] < segEnd
          );
          grouped.push(segChunks);
          segStart = segEnd;
        }
        setSegmentationChunks(grouped);
      } else if (segData?.transcriptFileUrl) {
        const segs = await fetchSegmentationFromUrl(segData.transcriptFileUrl);
        setSegments(segs);
        setSegmentationMap(null);
        setSegmentationChunks(null);
      } else {
        setError("Segmentation data not found.");
        setSegmentationChunks(null);
      }
    } catch (error) {
      console.error("Error extracting segmentation response:", error);
    } finally {
      setIsTaskResultLoading(false);
    }
  };

  const handleExtractQuestionResponse = async (response: any) => {
    try {
      let questionData = null;
      if (Array.isArray(response)) {
        const length = response.length;
        questionData = response[length - 1]
      }
      // const questionData = Array.isArray(response) ? response [0] : null;
      setIsTaskResultLoading(true);
      if (questionData?.fileUrl) {
        const questionsRes = await fetch(questionData.fileUrl);
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
        setQuestions(questionsArr);
      } else {
        setError('Questions file URL not found.');
      }

    } catch (error: any) {
      setError(error.message || 'Unknown error');
    } finally {
      setIsTaskResultLoading(false);
    }
  }

  const handleShowHandleResult = async (task: string): Promise<void> => {
    if (!aiJobId) return;
    try {
      if (!task) {
        toast.error("No task found to show result!");
        return;
      }
      setIsTaskResultLoading(true);
      const token = localStorage.getItem("firebase-auth-token");
      const url = getApiUrl(`/genai/${aiJobId}/tasks/${task}/status`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch task status");

      const data = await res.json();

      task == "SEGMENTATION" ?
        handleExtractSegmentationResponse(data) :
        handleExtractQuestionResponse(data);
    } catch (error) {
      console.error("Error fetching task result:", error);
      toast.error("Failed to fetch task result");
    } finally {
      setIsTaskResultLoading(false);
    }
  };

  const mapJobStatusToIncoming = (jobStatus: any) => {
    const order = [
      { key: "audioExtraction", task: "AUDIO_EXTRACTION" },
      { key: "transcriptGeneration", task: "TRANSCRIPT_GENERATION" },
      { key: "segmentation", task: "SEGMENTATION" },
      { key: "questionGeneration", task: "QUESTION_GENERATION" },
      { key: "uploadContent", task: "UPLOAD_CONTENT" },
    ];

    // 1️⃣ Check running first
    for (const step of order) {
      if (jobStatus?.[step.key] === "RUNNING") {
        return { task: step.task, status: "RUNNING" };
      }
    }

    // 2️⃣ Check failed
    for (const step of order) {
      if (jobStatus?.[step.key] === "FAILED") {
        return { task: step.task, status: "FAILED" };
      }
    }

    // 3️⃣ Return last completed step
    let lastCompleted = null;

    for (const step of order) {
      if (jobStatus?.[step.key] === "COMPLETED") {
        lastCompleted = step;
      } else {
        break;
      }
    }

    if (lastCompleted) {
      return { task: lastCompleted.task, status: "COMPLETED" };
    }

    return null;
  };

  useEffect(() => {
    if (!aiJobId || !shouldPoll) return;

    const interval = setInterval(async () => {
      const res = await getJobStatus(aiJobId);

      const incoming = mapJobStatusToIncoming(res.jobStatus);
      if (!incoming) return;
      setCurrentJob((prev) => {
        if (!prev) return incoming;

        const prevStep = STEP_ORDER[prev.task as keyof typeof STEP_ORDER];
        const incomingStep = STEP_ORDER[incoming.task as keyof typeof STEP_ORDER];

        if (incomingStep < prevStep) {
          return prev;
        }

        return incoming;
      });

      if (incoming.status === "COMPLETED") {

        handleShowHandleResult(incoming.task);

        setTimeout(() => setIsLoading(false), 500);
        // ⛔ stop polling when completed
        setShouldPoll(false);

        if (incoming.task === "SEGMENTATION") {
          toast.success("Segmentation completed!");
        }

        if (incoming.task === "QUESTION_GENERATION") {
          toast.success("Question generation completed!");
        }

      }
      else if (incoming.status === "RUNNING") {
        setIsWaitingServer(false);
        setIsLoading(true);
        // keep polling
        setShouldPoll(true);
      }
      else if (incoming.status === "FAILED") {
        setIsLoading(false);
        // stop polling
        setShouldPoll(false);
      }

      setAiJobStatus(res);

    }, 5000);

    return () => clearInterval(interval);

  }, [aiJobId, shouldPoll]);

  const lastSegmentRef = useRef<number | null>(null)

  useEffect(() => {
    if (startTime == null || endTime == null) return

    if (lastSegmentRef.current === endTime) return

    lastSegmentRef.current = endTime

    setChunkTranscription(prev => [
      ...prev,
      { startTime, endTime }
    ])

  }, [endTime])

  async function editSegmentMap(jobId: string, segmentMap: (number | string)[] | null, index?: number): Promise<void> {
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
    if (res.status === 200) {
      return;
    }
    let errMsg = 'Unknown error';
    try { errMsg = (await res.json()).message || errMsg; } catch { console.error("Failed to parse error message from response") }
    if (res.status === 400) throw new Error('Bad request: ' + errMsg);
    if (res.status === 403) throw new Error('Forbidden: ' + errMsg);
    if (res.status === 404) throw new Error('Job not found: ' + errMsg);
    throw new Error(errMsg);
  }

  const handleGenerateQuestions = async () => {
    const stringEndTimeArray = chunkTranscription.map((chunk: any) => chunk.endTime);

    await editSegmentMap(aiJobId!, stringEndTimeArray);
    const sortedSegments = [...stringEndTimeArray].sort((a, b) => a - b);
    const updatedChunks = sortedSegments.map((end, idx) => {
      const start = idx === 0 ? 0 : sortedSegments[idx - 1];
      return segmentationChunks.filter(chunk => {
        if (!chunk?.timestamp || !Array.isArray(chunk.timestamp) || chunk.timestamp.length < 2) {
          return false;
        }

        const chunkStart = chunk.timestamp[0];
        const chunkEnd = chunk.timestamp[1];
        const chunkMid = (chunkStart + chunkEnd) / 2;

        return chunkMid > start && chunkMid <= end;
      });
    });

    setSegmentationMap(stringEndTimeArray);
    setSegmentationChunks(updatedChunks);
    handleShowHandleResult("SEGMENTATION");
    setShowSegments(true);
    setShowContinueButton(true)
  }


  const handleContinueClick = () => {
    updateCurrentJob("questionGeneration", "WAITING");
    setShowQuestions(true);
    setShowContinueButton(false);
  }



  return (
    <>
      <div className="py-2">
        <div className="mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/teacher/courses/view" })}
            className="relative h-10 w-10 p-0 mr-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/10 hover:text-accent-foreground hover:shadow-lg hover:shadow-accent/10 before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Sparkles className="w-6 h-6" />
                AI Module Builder
              </CardTitle>
              <CardDescription className="text-base">
                Create AI-powered modules for your courses.
              </CardDescription>
            </div>
          </CardHeader>
          {!isURLValidated ? (<CardContent className="space-y-4">
            <div className="space-y-6">
            </div>
            <YoutubeUrlInput
              handleValidateURL={handleValidateURL}
              isLoading={isLoading}
              setUrlError={setUrlError}
              setYoutubeUrl={setYoutubeUrl}
              urlError={urlError}
              youtubeUrl={youtubeUrl}
              aiJobId={aiJobId}
            />
          </CardContent>) :
            (showUploadContent ? <UploadContentView
              currentJobStatus={currentJob.status}
              setUploadParams={setUploadParams}
              uploadParams={uploadParams}
              handleApproveTask={handleApproveTask}
              isLoading={isLoading}
              isApprovingTask={isApprovingTask}
              aiJobId={aiJobId} /> : <div className=" bg-linear-to-br from-background to-muted/20">
              {isURLValidated && videoId && (
                <>

                  <div>
                    {showSegments ? null : (<div className="flex items-center gap-3 p-4">
                      <Upload className="w-6 h-6 dark:text-white" />
                      <h2 className="text-xl font-bold">Upload Audio</h2>
                    </div>)}

                    {showSegments ? null : <p className="text-md text-gray-600 dark:text-gray-200 p-4">
                      Upload your audio file to generate a high-quality transcription of the spoken content.
                    </p>}

                    {showSegments === false ? <AudioTranscripter
                      setIsAudioExtracting={setIsAudioExtracting}
                      setIsTranscribing={setIsTranscribing}
                      transcribedData={transcribedData}
                      setTranscribedData={setTranscribedData}
                      isRunningAiJob={!!aiJobId}
                      jobError={error}
                      createAiJob={handleCreateJob}
                      isCreatingAiJob={isCreatingAiJob}
                      isAIModulePage={true}
                      startTimeRef={lastStartTimeRef}
                      pauseTimeRef={pauseTimeRef}
                      endTimeRef={endTimeRef}
                      startTime={startTime}
                      endTime={endTime}
                      isPaused={isPaused}
                      chunkTranscription={chunkTranscription}
                      handleDeleteSegmentation= {handleDeleteSegmentation}
                    /> : showQuestions ? null : <SegmentationView
                      isLoading={isLoading}
                      isTaskResultLoading={isTaskResultLoading}
                      error={error}
                      aiJobId={aiJobId}
                      segmentationMap={segmentationMap}
                      segmentationChunks={segmentationChunks}
                      segments={segments}
                      handleApproveTask={handleApproveTask}
                      currentJobStatus={currentJob.status}
                      setCustomSegmentationParams={setCustomSegmentationParams}
                      customSegmentationParams={customSegmentationParams}
                      updateCurrentJob={updateCurrentJob}
                      handleShowHandleResult={handleShowHandleResult}
                      isWaitingServer={isWaitingServer}
                      isApprovingTask={isApprovingTask}
                      setSegmentationMap={setSegmentationMap}
                      setSegmentationChunks={setSegmentationChunks}
                      showSegments={showSegments}
                    />}
                  </div>


                  {showSegments && showContinueButton && <Button onClick={handleContinueClick}>Continue</Button>}

                  {(endTime === videoDuration || showGenerateQuestion === true) && showSegments === false && (
                    <Button onClick={handleGenerateQuestions}>
                      Generate Questions
                    </Button>
                  )}

                  <hr className="my-6" />
                  {showQuestions ? <QuestionGenerationView
                    isLoading={isLoading}
                    isTaskResultLoading={isTaskResultLoading}
                    error={error}
                    questions={questions}
                    setQuestions={setQuestions}
                    aiJobId={aiJobId}
                    handleApproveTask={handleApproveTask}
                    setEditingIdx={setEditingIdx}
                    setEditQuestion={setEditQuestion}
                    setEditModalOpen={setEditModalOpen}
                    editModalOpen={editModalOpen}
                    editQuestion={editQuestion}
                    editingIdx={editingIdx}
                    currentJobStatus={currentJob.status}
                    customQuestionParams={customQuestionParams}
                    setCustomQuestionParams={setCustomQuestionParams}
                    updateCurrentJob={updateCurrentJob}
                    handleShowHandleResult={handleShowHandleResult}
                    isWaitingServer={isWaitingServer}
                    isApprovingTask={isApprovingTask}
                    setShowUploadContent={setShowUploadContent}
                  /> :
                    <div style={{ width: "100%", aspectRatio: "16/9", background: "#000" }}>
                      <div
                        ref={iframeRef}
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "#000",
                          borderRadius: "12px 12px 0 0",
                          overflow: "hidden",
                        }}
                      />
                    </div>}
                </>
              )}
            </div>)}
        </Card>
      </div>
    </>
  )
}


export default AiModule;
