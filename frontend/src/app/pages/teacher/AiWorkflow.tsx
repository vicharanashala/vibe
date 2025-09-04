import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiSectionAPI, Chunk, connectToLiveStatusUpdates, getApiUrl, JobStatus, QuestionGenerationParameters, SegmentationParameters } from '@/lib/genai-api';
import { useCourseStore } from '@/store/course-store';
import {  ArrowLeft, ArrowRight, CheckCircle, Clock, Edit, FileText, HelpCircle, ListChecks, Loader2, MessageSquareText, PauseCircle, Pencil, Plus, Power, RefreshCw, Save, Scissors, Settings, Sparkles, Trash2, Upload, UploadCloud, X, XCircle, Zap } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner';
import { AudioTranscripter } from './AudioTranscripter';
import { TranscriberData } from '@/hooks/useTranscriber';
import { useNavigate } from '@tanstack/react-router';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmationModal from './components/confirmation-modal';

interface UploadParams {
  videoItemBaseName: string;
  quizItemBaseName: string;
  questionsPerQuiz: number | null;
  audioProvided: boolean;
}

interface CurrentJob {
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | "WAITING",
    task: any
}

const AiWorkflow = () => {

    // <<<<<<<<< Store >>>>>>>>>>
    const { currentCourse } = useCourseStore();

    // <<<<<<<<< State >>>>>>>>>>
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [showUrl, setShowUrl] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null); // yt url error
    const [aiJobId, setAiJobId] = useState<string | null>(null); 

    const [uploadParams, setUploadParams] = useState<UploadParams>({
    videoItemBaseName: "video_item",
    quizItemBaseName: "quiz_item",
    audioProvided: true,
    questionsPerQuiz: null,
    });
    const [customQuestionParams, setCustomQuestionParams] =
    useState<QuestionGenerationParameters>({
        model: "deepseek-r1:70b",
        SQL: 0,
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
    });
    const [customSegmentationParams, setCustomSegmentationParams] =
    useState<SegmentationParameters>({
        lam: 4.5,
        runs: 25,
        noiseId: -1,
    });

    const [aiJobStatus, setAiJobStatus] = useState<JobStatus | null>(null); // to track current job status
    const [transcribedData, setTranscribedData] = useState<TranscriberData | undefined>(undefined); // to store the generated transcription
    const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null)
    const [isTranscribing, setIsTranscribing] = useState(false); 
    const [isAudioExtracting, setIsAudioExtracting] = useState(false);
    const [isAiJobStarted, setIsAiJobStarted] = useState(false); //will true once segmentation starts (backend)
    const [isURLValidated, setIsURLValidated] = useState(false); // will true once yt url is validated
    const [isLoading, setIsLoading] = useState(false); // mock loading for yt url &% for progress % bar
    const [progress, setProgress] = useState(0); // to store the progress % count
    const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
    const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null); //  arrays of transcript chunks per segment
    const [segments, setSegments] = useState<any[]>([]); // to store the generated segments
    const [questions, setQuestions] = useState<any[]>([]); // to store the generated questions
    const [isCreatingAiJob, setIsCreatingAiJob] = useState(false); // to track ai job creation
    const [isTaskResultLoading, setIsTaskResultLoading] = useState(false); // to track completed task result loading
    const [error, setError] = useState("");
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editQuestion, setEditQuestion] = useState<any>(null);

    const [isWaitingServer, setIsWaitingServer] = useState(false);// to track live status state
    const [isApprovingTask, setIsApprovingTask] = useState(false); // to track approve task 
    const [isOpenEndJobModal, setIsOpenEndJobModal] = useState(false);

    // <<<<<<<<<< Ref >>>>>>>>>>
    const optimisticFailedTaskRef = useRef<string | null>(null);
    const errorRef = useRef<HTMLDivElement | null>(null);
    
    
    const navigate = useNavigate();



    // <<<<<<<<<< UseEffects >>>>>>>>>>
  
    // For live status
    useEffect(() => {
        if (!aiJobId) return;
        const es = connectToLiveStatusUpdates(aiJobId, (incoming) => {
            // 1. Set current job for live status update
            setCurrentJob({
                task: incoming.task,
                status: incoming.status
            })
            // 2. If status is completed then need to show result, need to hide the progress bar (%) and set next task status as waiting
            if(incoming.status == "COMPLETED"){
                handleShowHandleResult(incoming.task); // to show the result of the tasks
                setProgress(100);
                setTimeout(() => setIsLoading(false), 500);

                if (incoming.task == "SEGMENTATION"){
                    toast.success("Segmentation completed!")
                    // setCurrentJob({task: "QUESTION_GENERATION", status: "WAITING"}) // Setting next task as waiting
                }
                else if (incoming.task == "QUESTION_GENERATION"){
                    toast.success("Question generation completed!")
                    // setCurrentJob({task: "UPLOAD_CONTENT", status: "WAITING"})
                }
            } else if(incoming.status =="RUNNING") {
              setIsWaitingServer(false);
              setIsLoading(true); // for progress bar (%) 
            } else if(incoming.status == "FAILED") {
              setProgress(0);
              setIsLoading(false);
            }
            // 3. Set ai job status for live status (currently not using)
            setAiJobStatus(() => {
                let next: any =  { ...incoming } ;
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
        // 4. Clean up
        return () => es.close();
    }, [aiJobId]);

    // To track transcription status and start ai job for segementation
    useEffect(()=> {
        if(isAudioExtracting) {
          setCurrentJob({
            status: "RUNNING",
            task: 'AUDIO_EXTRACTION'
          });
          setProgress(0);
        }
        if (isTranscribing && transcribedData) {
            setIsLoading(true);
            setCurrentJob({
                status: "RUNNING",
                task: 'TRANSCRIPT_GENERATION'
            });
        }
        
        else if (!isTranscribing && transcribedData && !aiJobId) {
            setCurrentJob({status: "COMPLETED", task: 'TRANSCRIPT_GENERATION'});
            setProgress(100);
            setTimeout(() => setIsLoading(false), 500);
            toast.success("Transcription completed successfully!"); 
        }

    }, [isTranscribing, isAudioExtracting, transcribedData]);

    // Mock progress % bar
    useEffect(() => {
      let interval: NodeJS.Timeout | null = null;

      if (isLoading || isTranscribing) {
        interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 99.99) return 99.99;

            let increment = Math.max(0.2, (99.99 - prev) / 25);

            if (prev >= 85) {
              increment = Math.max(0.05, increment / 3);
            }

            // Extra slow for transcription or question generation
            if (isTranscribing || currentJob?.task === "QUESTION_GENERATION") {
              increment = Math.max(0.05, increment / 2);
            }

            return Math.min(prev + increment, 99.99);
          });
        }, 1600);
      } else {
        setProgress(0);
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isLoading, isTranscribing, currentJob?.task]);

    // <<<<<<<<<< Helpers >>>>>>>>>>

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

    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
        return youtubeRegex.test(url);
    };

    const scrollToError = () => {
        if (errorRef.current) {
        errorRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
        }
    };

    const getCurrentTask = (jobStatus: JobStatus["jobStatus"]): {task: any, status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING"} | null => {
        if (!jobStatus) return null;
        const TASK_ORDER: (keyof typeof jobStatus)[] = [
            "audioExtraction",
            "transcriptGeneration",
            "segmentation", 
            "questionGeneration",
            "uploadContent",
        ];
        // Check running task
        const runningTask = TASK_ORDER.find((key)=> jobStatus[key] === "RUNNING");
        if(runningTask) return {task: runningTask, status: "RUNNING"}
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


    // <<<<<<<<<< Handlers >>>>>>>>>>

    const handleShowHandleResult = async (task: string): Promise <void> => {
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

    const handleExtractSegmentationResponse = async (response: any) => {
    try {
        const segData = Array.isArray(response) ? response[0] : null;

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
        const segMap = segData.segmentationMap;
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

    const handleExtractQuestionResponse = async (response: any ) => {
        try {
            const questionData = Array.isArray(response) ? response [0] : null;
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

    const handleCreateJob = async () => {
        // 1. Check transcription text is there
        if(!transcribedData?.text){
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
            questionsPerQuiz: uploadParams.questionsPerQuiz ,
        };


        jobParams.segmentationParameters = {
            lam: customSegmentationParams.lam ?? 4.5,
            runs: customSegmentationParams.runs ?? 25,
            noiseId: customSegmentationParams.noiseId ?? -1,
        };

        jobParams.questionGenerationParameters = {
            model: customQuestionParams.model || "deepseek-r1:70b",
            SQL: customQuestionParams.SQL ?? 1,
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
        setCurrentJob({status: "WAITING", task: 'SEGMENTATION'}); 

        } catch (error) {
            setCurrentJob({status: "FAILED", task: 'TRANSCRIPT_GENERATION'})
            toast.error("An error occured. Please try again!");
            setError("Failed to create ai job");
        } finally {
            // 8. Stop progress bar and loading
            setIsCreatingAiJob(false);
        }
    };

    const handleValidateURL = () => {
        if (!youtubeUrl.trim()) {
            setUrlError("YouTube URL is required");
            scrollToError();
            return;
        }
        if (!isValidYouTubeUrl(youtubeUrl.trim())) {
            setUrlError("Please enter a valid YouTube URL");
            scrollToError();
            return;
        }
        setIsLoading(true)

        setTimeout(() => {
            setIsURLValidated(true);
            setIsLoading(false); 
        }, 500); 
    }

    const handleRefreshStatus = async () => {
        if (!aiJobId) return;
        try {
            setProgress(0);
            const status = await aiSectionAPI.getJobStatus(aiJobId);
            const currentTaskData = getCurrentTask(status.jobStatus);

            if (!currentTaskData) {
                toast.error("Current task is missing");
                return;
            }

            const currentTask = currentTaskData.task; 
            const currentStatus = currentTaskData.status;
            // const current
            setAiJobStatus( { ...status, task: currentTask, status: currentStatus  } );
            updateCurrentJob(currentTask, currentStatus);

            if (currentTask=="uploadContent" && currentStatus == "COMPLETED"){
                setProgress(100);
                setTimeout(() => setIsLoading(false), 500);
            }

        } catch (error) {
            toast.error('Failed to refresh status.');
        }
    };

    const handleApproveTask = async(qnGenParams?:QuestionGenerationParameters) => {
        try {
            // 1. Check aiJobId
            if (!aiJobId) {
              toast.error("Job not found");
              return;
            }
            setError(""); 
            setIsApprovingTask(true);
            setIsWaitingServer(false) // set to false, because now we are going to hit server again!
            setProgress(0);
            // 2. Fetch status to get current job
            const status = await aiSectionAPI.getJobStatus(aiJobId);
            
            if(!status || !status.jobStatus){
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
            
            if(currentTask == "uploadContent") // Manully adding upload status, becuae live status api will not trigger
              updateCurrentJob("uploadContent", "RUNNING");

            setAiJobStatus( { ...status, task: currentTask, status: currentStatus  } );
            
            
            const customUploadParams = { 
              courseId: currentCourse?.courseId, 
              versionId: currentCourse?.versionId, 
              moduleId: currentCourse?.moduleId, 
              sectionId: currentCourse?.sectionId, 
              videoItemBaseName: uploadParams.videoItemBaseName, 
              quizItemBaseName: uploadParams.quizItemBaseName, questionsPerQuiz: uploadParams.questionsPerQuiz
            };
            const customQuestionGenParams = qnGenParams || customQuestionParams;

            let params: Record<string, any> | null = null;
            // 3. Set proper request params
            switch (currentTask) {
              case 'segmentation':
                    params = {parameters: customSegmentationParams, usePrevious: 0, type: "SEGMENTATION"};
                    break;
                case 'questionGeneration':
                    params = { parameters: customQuestionGenParams, type: "QUESTION_GENERATION"};
                    break;
                case 'uploadContent': 
                    params = { parameters: customUploadParams , type: "UPLOAD_CONTENT", usePrevious: 0 };
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
              setIsWaitingServer(true) // setting true until we get response from live status ap
            
            if(currentTask == "uploadContent") {
                handleRefreshStatus(); // for upload content status refresh
                toast.success("Content upload successfully!");
              }

        } catch(error) {
            if(!isWaitingServer) {
              toast.error("Failed to approve task");
              console.log("Failed to approve task", error);
            } else {
              toast.error("Failed to retry task");
              console.log("Failed to retry task", error);
            }
            setProgress(100);
            setTimeout(() => setIsLoading(false), 500);
            setIsWaitingServer(false);
            setError("Failed to approve task")
        } finally {
          setIsApprovingTask (false);
        }
    }


  return (
    <div className='py-2'>
        <ConfirmationModal
          isOpen={isOpenEndJobModal}
          onClose={() => setIsOpenEndJobModal(false)}
          onConfirm={()=>{
            setAiJobId("");
            setIsOpenEndJobModal(false);
            setProgress(0);
            setError(""); 
            setIsLoading(false)
            setIsAiJobStarted(false);
            setIsWaitingServer(false);
            setTranscribedData(undefined);
            ([])
            setSegmentationChunks([]) ;
            setSegmentationMap([])
            setSegments([]);
            setQuestions([]);
            updateCurrentJob("audioExtraction","WAITING")
            }}
          title="End Current Job"
          description="Are you sure you want to end this job? Once confirmed, all generated data and progress will be cleared, and you will need to start again from the beginning."
          confirmText="End Job"
          isDestructive={true}
          isLoading={false}
        />
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
            <CardHeader >
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <CardTitle className="flex items-center gap-3 text-xl">
                        <Sparkles  className="w-6 h-6" />
                        Smart Content Builder
                        </CardTitle>
                        <CardDescription className="text-base">
                        Click to instantly generate engaging learning content. All essential steps are handled in the background.
                        </CardDescription>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                    {youtubeUrl && 
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowUrl((prev) => !prev)}
                        className="text-sm font-medium px-3 py-2 rounded border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition"
                      >
                        {showUrl ? "Hide URL" : "Show URL"}
                      </button>

                      {showUrl && (
                        <div className="absolute top-full right-0 mt-2 z-50 bg-card text-card-foreground px-3 py-2 rounded shadow text-sm font-medium break-words">
                          Uploaded URL: {youtubeUrl}
                        </div>
                      )}
                    </div>
                   }
                   {aiJobId && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsOpenEndJobModal((prev) => !prev)}
                          className={`flex items-center gap-2 text-sm text-red-400 font-medium px-3 py-2.5  rounded border transition
                            ${isOpenEndJobModal 
                              ? "bg-red-600 text-white hover:bg-red-700" 
                              : "bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    </div>
                </div>
            </CardHeader>
            {!isURLValidated ?
                <CardContent className="space-y-4">
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
                </CardContent>:
                <div className=" bg-gradient-to-br from-background to-muted/20 ">
                    
                    { isURLValidated && <Stepper currentJobData={currentJob}/> }

                    {isLoading && (
                        <div className="space-y-2  bg-card w-full">
                            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className="bg-yellow-500 h-3 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <div className="text-sm text-gray-600 font-medium text-center">
                            {progress.toFixed(2)}% Completed
                            </div>
                        </div>
                    )}
                    <div className="mx-auto border-t-1 border-gray-200 dark:border-gray-900 ">
                        <div className="bg-card shadow-lg p-8 space-y-2">
                            
                            <JobHeader currentJob={currentJob} handleRefreshStatus={handleRefreshStatus} aiJobId={!!aiJobId} />

                            {currentJob?.task === "SEGMENTATION" ? (
                                <SegmentationView
                                    isLoading={isLoading}
                                    isTaskResultLoading={isTaskResultLoading}
                                    error={error}
                                    aiJobId={aiJobId}
                                    segmentationMap={segmentationMap}
                                    segmentationChunks={segmentationChunks}
                                    segments={segments}
                                    handleApproveTask={handleApproveTask}
                                    currentJobStatus = {currentJob.status}
                                    setCustomSegmentationParams ={setCustomSegmentationParams}
                                    customSegmentationParams = {customSegmentationParams}
                                    updateCurrentJob={updateCurrentJob}
                                    handleShowHandleResult={handleShowHandleResult}
                                    isWaitingServer={isWaitingServer}
                                    isApprovingTask={isApprovingTask}
                                />
                            ) : currentJob?.task === "QUESTION_GENERATION" ? (
                                <QuestionGenerationView
                                    isLoading={isLoading}
                                    isTaskResultLoading={isTaskResultLoading}
                                    error={error}
                                    questions={questions}
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
                                />
                            ) : currentJob?.task === "UPLOAD_CONTENT" ? (
                                <UploadContentView
                                    currentJobStatus = {currentJob.status} 
                                    setUploadParams = {setUploadParams}
                                    uploadParams = {uploadParams} 
                                    handleApproveTask = {handleApproveTask} 
                                    isLoading = {isLoading}
                                    isApprovingTask={isApprovingTask}
                                />
                            ) : (
                            <>
                                <p className="text-md text-gray-600 dark:text-gray-200">
                                Select your preferred method to upload audio — via File, Link, or Recording.
                                </p>
                                <AudioTranscripter
                                    setIsAudioExtracting={setIsAudioExtracting}
                                    setIsTranscribing={setIsTranscribing}
                                    transcribedData={transcribedData}
                                    setTranscribedData={setTranscribedData}
                                    isRunningAiJob={!!aiJobId}
                                    jobError={error}
                                    createAiJob={handleCreateJob}
                                    isCreatingAiJob={isCreatingAiJob}
                                />
                                {isAiJobStarted && aiJobId && (
                                <div className="flex justify-center">
                                    <Button
                                    onClick={() => handleApproveTask()}
                                    disabled={isLoading}
                                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                    Next
                                    </Button>
                                </div>
                                )}
                            </>
                            )}
                        </div>
                    </div>
                </div>
            }
        </Card>
    </div>)}

interface JobHeaderProps {
  currentJob?: {status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | "WAITING", task: any} | null;
  handleRefreshStatus: () => void;
  aiJobId: boolean;
}
const JobHeader: React.FC<JobHeaderProps> = ({ currentJob, handleRefreshStatus, aiJobId }) => {
  const renderJobInfo = () => {
    switch (currentJob?.task) {
      case "SEGMENTATION":
        return (
          <>
            <Scissors className="w-6 h-6 dark:text-white" />
            <h2 className="text-xl font-bold">Segmenting Content</h2>
          </>
        );
      case "QUESTION_GENERATION":
        return (
          <>
            <HelpCircle className="w-6 h-6 dark:text-white" />
            <h2 className="text-xl font-bold">Generating Questions</h2>
          </>
        );
      case "UPLOAD_CONTENT":
        return (
          <>
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold">Course Upload</h2>
          </>
        );
      default:
        return (
          <>
            <Upload className="w-6 h-6 dark:text-white" />
            <h2 className="text-xl font-bold">Upload Audio</h2>
          </>
        );
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 pb-2 border-b dark:border-white/20 border-gray-300">
      <div className="flex items-center gap-3 pb-2">{renderJobInfo()}
        
      </div>
      {/* {aiJobId && 
        <Button
        onClick={handleRefreshStatus}
        variant="outline"
        className="bg-background border-primary/30 text-primary hover:text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 mb-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      } */}
    </div>
  );
};
interface YoutubeUrlInputProps {
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  urlError: string | null;
  setUrlError: (error: string | null) => void;
  aiJobId: string | null;
  isLoading: boolean;
  handleValidateURL: () => void;
}

export const YoutubeUrlInput = ({
  youtubeUrl,
  setYoutubeUrl,
  urlError,
  setUrlError,
  aiJobId,
  isLoading,
  handleValidateURL,
}: YoutubeUrlInputProps) => {

  return (
    <div className="flex-1 w-full mt-5 space-y-3">
      <div className="relative w-full">
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-red-500 transition-transform duration-300 ease-in-out ${
            youtubeUrl ? "scale-110" : "scale-100"
          }`}
        >
          <YoutubeIcon />
        </div>

        <Input
          placeholder="Enter YouTube URL"
          value={youtubeUrl}
          onChange={(e) => {
            setUrlError(null);
            setYoutubeUrl(e.target.value);
          }}
          disabled={!!aiJobId}
          className={`pl-10 flex-1 w-full border rounded-lg py-2.5 focus:ring-2 focus:ring-primary/50 transition-all duration-300 ease-in-out ${
            urlError ? "border-red-500" : "border-gray-300"
          }`}
        />

        {urlError && (
          <p
            className="absolute left-0 mt-1 text-red-500 text-sm"
            style={{ top: "100%" }}
          >
            {urlError}
          </p>
        )}
      </div>

      <Button
        onClick={handleValidateURL}
        variant="default"
        disabled={isLoading}
        className="flex items-center gap-2 w-full mx-auto mt-5 sm:w-auto bg-primary text-black hover:bg-primary/90 font-medium px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-transform duration-300 hover:scale-105"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Validating...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" /> Confirm URL
          </>
        )}
      </Button>
    </div>
  );
};

const YoutubeIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="18" 
    height="18" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="text-red-500"
  >
    <path d="M23.498 6.186a2.998 2.998 0 0 0-2.115-2.122C19.397 3.5 12 3.5 12 3.5s-7.397 0-9.383.564A2.998 2.998 0 0 0 .502 6.186C0 8.17 0 12 0 12s0 3.83.502 5.814a2.998 2.998 0 0 0 2.115 2.122C4.603 20.5 12 20.5 12 20.5s7.397 0 9.383-.564a2.998 2.998 0 0 0 2.115-2.122C24 15.83 24 12 24 12s0-3.83-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"/>
  </svg>
);

const Stepper = React.memo(({  currentJobData }: {  currentJobData: any }) => {

  const WORKFLOW_STEPS = [
    { key: 'audioExtraction', label: 'Audio Extraction', icon: <UploadCloud className="w-5 h-5" /> },
    { key: 'transcriptGeneration', label: 'Transcription', icon: <FileText className="w-5 h-5" /> },
    { key: 'segmentation', label: 'Segmentation', icon: <ListChecks className="w-5 h-5" /> },
    { key: 'questionGeneration', label: 'Question Generation', icon: <MessageSquareText className="w-5 h-5" /> },
    { key: 'uploadContent', label: 'Upload', icon: <UploadCloud className="w-5 h-5" /> },
  ];
  
  const getStepStatus = (currentJobData: any, stepKey: string) => {

    if (!currentJobData) return 'pending';
  
    const taskToStep: Record<string, string> = {
      'AUDIO_EXTRACTION': 'audioExtraction',
      'TRANSCRIPT_GENERATION': 'transcriptGeneration',
      'SEGMENTATION': 'segmentation',
      'QUESTION_GENERATION': 'questionGeneration',
      'UPLOAD_CONTENT': 'uploadContent',
    };
  
    const currentTaskStep = taskToStep[currentJobData.task] || null;
  
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
      let status = currentJobData.status?.toLowerCase() || 'pending';
      if (status === 'running') return 'active';
      if (status === 'completed') return 'completed';
      if (status === 'failed') return 'failed';
      if (status === 'stopped') return 'stopped';
      if (status === 'waiting' ) return 'waiting';
      return 'pending';
    }
  }  

  const activeStep = React.useMemo(() => {
    if (!currentJobData) return null;

    if (currentJobData.task === 'AUDIO_EXTRACTION') {
      return 'audioExtraction';
    }
    if (currentJobData.task === 'TRANSCRIPT_GENERATION') {
      return 'transcriptGeneration';
    }
    if (currentJobData.task === 'SEGMENTATION') {
      return 'segmentation';
    }
    if (currentJobData.task === 'QUESTION_GENERATION') {
      return 'questionGeneration';
    }
    if (currentJobData.task === 'UPLOAD_CONTENT') {
      return 'uploadContent';
    }

    return null;
  }, [currentJobData]);

  return (
    <div className=" bg-card pb-3">
        <div className="flex items-center justify-between  px-8 relative animate-fade-in ">
        {WORKFLOW_STEPS.map((step, idx) => {
            const status = getStepStatus(currentJobData, step.key);
            const isCurrent = step.key === activeStep;

            const isLast = idx === WORKFLOW_STEPS.length - 1;
            const isCompleted = status === 'completed';
            const isFailed = status === 'failed';
            const isStopped = status === 'stopped' ;
            const isWaiting = status == 'waiting';
            const isActive = status === 'active' || (isCurrent && !isCompleted && !isFailed && !isStopped && !isWaiting);

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
                    isWaiting ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-500/20 animate-stepper-pending-glow':
                    'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground shadow-md ring-1 ring-border/50 hover:shadow-lg hover:ring-2 hover:ring-primary/20'
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
                    ) : isWaiting ? (
                        <Clock className="w-6 h-6 animate-pulse" />
                    )
                     : (
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
                        isWaiting ? 'text-purple-600 dark:text-purple-400 animate-pulse':
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
                   {isWaiting && (
                    <div className="mt-1 flex items-center justify-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                        <span className="ml-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                         Wating ...
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
    </div>
  );
});

interface QuestionGenerationResultProps {
  isLoading: boolean;
  isTaskResultLoading: boolean;
  isApprovingTask: boolean;
  error: string | null;
  questions: any[];
  editModalOpen: boolean;
  aiJobId: string | null;
  handleApproveTask: (qnGenParams?: QuestionGenerationParameters, jobStatus?: CurrentJob) => void;
  setEditingIdx: (idx: number) => void;
  setEditQuestion: (q: any) => void;
  setEditModalOpen: (open: boolean) => void;
  editQuestion: any
  editingIdx: number | null
  currentJobStatus: string;
  customQuestionParams: QuestionGenerationParameters,
  setCustomQuestionParams: React.Dispatch<React.SetStateAction<QuestionGenerationParameters>>
  updateCurrentJob: (task: "segmentation" | "questionGeneration" | "uploadContent", status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | "WAITING") => void
  handleShowHandleResult: (task: string) => void
  isWaitingServer: boolean
}

const QuestionGenerationView: React.FC<QuestionGenerationResultProps> = ({
    isLoading,
    isTaskResultLoading,
    error,
    questions,
    aiJobId,
    handleApproveTask,
    setEditingIdx,
    setEditQuestion,
    setEditModalOpen,
    editModalOpen,
    editQuestion,
    editingIdx,
    currentJobStatus,
    customQuestionParams,
    setCustomQuestionParams,
    updateCurrentJob,
    handleShowHandleResult,
    isWaitingServer,
    isApprovingTask
    }) => {

    const isLocked = Boolean(!aiJobId) || isWaitingServer || isLoading || isApprovingTask;
    // const [mcqCount, setMcqCount] = useState(2);
    // const [binaryCount, setBinaryCount] = useState(0);
    const [isMCQ, setIsMCQ] = useState(true);
    const [isMSQ, setIsMSQ] = useState(false);
    const [isBinary, setIsBinary] = useState(false);
    const binaryPrompt = `Generate only Yes/No questions (binary type).
Each question must contain exactly two options: "Yes" and "No".
Phrase each question neutrally so the answer is not obvious from wording.
Test comprehension of key ideas, principles, and relationships discussed in the content.
Avoid questions that require memorizing exact numerical values, dates, or statistics.
Ensure the correct answer is supported by the content, but not directly quoted.
All questions must strictly follow the Yes/No format (no multiple-choice, open-ended, or True/False).
Set isParameterized to false unless the question involves variables.
Do not mention the word 'transcript' for giving references, use the word 'video' instead.`
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // const clampInt = (val: string, min = 0, max = 100) => {
    //     const n = Number.parseInt(val, 10)
    //     if (Number.isNaN(n)) return min
    //     return Math.min(max, Math.max(min, n))
    // }
    const segmentIds = Array.from(
        new Set(questions.map((q) => q.segmentId).filter((sid) => typeof sid === "number"))
    ).sort((a, b) => a - b);


    const handleNext = () => {
        updateCurrentJob ("uploadContent", "WAITING");
    }

    const handleAddParams = async() => {

      if(!aiJobId){
        toast.error("Failed to find jobId!")
        return;      
      }

      const newParams = {
        ...customQuestionParams,
        SQL: (isMCQ || isBinary) ? 2 : 0,
        SML: isMSQ  ? 2 : 0,
        prompt: isBinary ? binaryPrompt : customQuestionParams.prompt,
      };

      setCustomQuestionParams(newParams);

      if (currentJobStatus === "COMPLETED") {
          try {
            await aiSectionAPI.rerunJobTask(aiJobId, "QUESTION_GENERATION", newParams);
            toast.error("Re-run success!");
          } catch (err) {
            toast.error("Re-run failed, try again!");
            console.error("Re-run failed:", err);
          }
        } else {
          handleApproveTask(newParams);
      }
    }

    return (
        <div className="py-12 text-center text-gray-500">
          {currentJobStatus === "FAILED" && (
              <div className="flex items-center justify-center gap-2 mb-12 text-red-600 dark:text-red-400 font-medium">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Job failed. Please try again.</span>
              </div>
            )}
            {(isLoading || isTaskResultLoading || isWaitingServer) && (
            <div className="flex items-center gap-2 text-primary font-medium mb-2">
                <svg
                  className="animate-spin h-5 w-5 text-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                {isLoading
                  ? "Generating questions ..."
                  : isTaskResultLoading
                  ? "Processing results ..."
                  : isWaitingServer
                  ? "Waiting for server response ..."
                  : "Generating questions ..."}
              </div>
             )}
             
          {(currentJobStatus !== "COMPLETED" || isSettingsOpen) && (
            <section className="border mb-3 rounded-xl p-6 bg-card text-gray-800 dark:text-gray-200 shadow-sm"
              aria-labelledby="question-generation-settings-heading"
              role="region"
              >
                     <div className="flex items-center mb-8">
                      <Settings className="h-5 w-5 text-gray-600 mr-2" />
                      <h3 id="question-generation-settings-heading" className="text-base font-medium text-pretty ">
                        Question Generation Settings
                      </h3>
                    </div>

                  <div className="space-y-6">
                      <div className="flex flex-wrap items-end justify-between gap-6">
                      <div className="space-y-2 min-w-[220px]">
                          <Label className="text-sm font-medium" htmlFor="model-select">
                          Model
                          </Label>
                          <Select
                          value={customQuestionParams.model}
                          onValueChange={(value) => setCustomQuestionParams((prev) => ({ ...prev, model: value }))}
                          disabled={isLocked}
                          >
                          <SelectTrigger id="model-select" className="h-10">
                              <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="deepseek-r1:70b">DeepSeek R1 70B</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">Choose the model used to generate questions.</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Question Types</Label>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant={isMCQ ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setIsMCQ(true);
                              setIsMSQ(false);
                              setIsBinary(false);
                            }}
                            aria-pressed={isMCQ}
                            disabled={isLocked}
                          >
                            MCQ
                          </Button>

                          <Button
                            type="button"
                            variant={isMSQ ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setIsMCQ(false);
                              setIsMSQ(true);
                              setIsBinary(false);
                            }}
                            aria-pressed={isMSQ}
                            disabled={isLocked}
                          >
                            MSQ
                          </Button>

                          <Button
                            type="button"
                            variant={isBinary ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setIsMCQ(false);
                              setIsMSQ(false);
                              setIsBinary(true);
                            }}
                            aria-pressed={isBinary}
                            disabled={isLocked}
                          >
                            Binary
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Toggle which type to include. Only one type can be selected at a time.
                        </p>
                      </div>
                      </div>

                      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {showMCQ && (
                          <div className="space-y-2">
                          <Label className="text-sm font-medium" htmlFor="mcq-count">
                              MCQ Count
                          </Label>
                          <Input
                              id="mcq-count"
                              type="number"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              value={mcqCount || 0}
                              // value={Number.isFinite(customQuestionParams.SQL) ? customQuestionParams.SQL : 0}
                              onChange={(e) =>
                              // setCustomQuestionParams((prev) => ({
                              //     ...prev,
                              //     SQL: clampInt(e.target.value, 0, 100),
                              // }))
                              setMcqCount( clampInt(e.target.value, 0, 100) )
                              }
                              disabled={isLocked}
                              className="h-10"
                              aria-describedby="mcq-help"
                          />
                          <p id="mcq-help" className="text-sm text-muted-foreground">
                              Number of single-answer multiple choice questions to generate.
                          </p>
                          </div>
                      )}

                      {showMSQ && (
                          <div className="space-y-2">
                          <Label className="text-sm font-medium" htmlFor="msq-count">
                              MSQ Count
                          </Label>
                          <Input
                              id="msq-count"
                              type="number"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              value={Number.isFinite(customQuestionParams.SML) ? customQuestionParams.SML : 0}
                              onChange={(e) =>
                              setCustomQuestionParams((prev) => ({
                                  ...prev,
                                  SML: clampInt(e.target.value, 0, 100),
                              }))
                              }
                              disabled={isLocked}
                              className="h-10"
                              aria-describedby="msq-help"
                          />
                          <p id="msq-help" className="text-sm text-muted-foreground">
                              Number of multi-select questions to generate.
                          </p>
                          </div>
                      )}

                      {showBinary && (
                          <div className="space-y-2">
                          <Label className="text-sm font-medium" htmlFor="binary-count">
                              Binary question Count
                          </Label>
                          <Input
                              id="binary-count"
                              type="number"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              value={binaryCount || 0}
                              // value={Number.isFinite(customQuestionParams.SML) ? customQuestionParams.SML : 0}
                              onChange={(e) =>
                              // setCustomQuestionParams((prev) => ({
                              //     ...prev,
                              //     SML: clampInt(e.target.value, 0, 100),
                              // }))
                              setBinaryCount( clampInt(e.target.value, 0, 100) )
                              }
                              disabled={isLocked}
                              className="h-10"
                              aria-describedby="binary-help"
                          />
                          <p id="binary-help" className="text-sm text-muted-foreground">
                              Number of binary questions to generate.
                          </p>
                          </div>
                      )}
                      </div> */}

                      {/* <div className="flex items-center gap-3">
                      <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {

                            setCustomQuestionParams((prev) => ({
                              ...prev,
                              SML: 0,
                            }))
                            setMcqCount(2);
                            setBinaryCount(0)
                          }
                        }
                          disabled={isLocked}
                      >
                          Reset Counts
                      </Button>
                      </div> */}
                  </div>
              </section>
          )}

          {currentJobStatus == "COMPLETED" && !isLoading &&
            <div className=" bg-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Questions</h3>
                <Button
                  variant="outline"
                  className={`px-5 py-2.5 flex items-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm text-gray-800 dark:text-white
                    ${isSettingsOpen 
                      ? "bg-primary hover:bg-primary/90 dark:bg-primary/90 hover:dark:bg-primary/80 dark:text-black" 
                      : "hover:bg-muted"
                    }`}
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  aria-pressed={isSettingsOpen}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </Button>
              </div>

              <div className="p-4">
                {isTaskResultLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Loading questions...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                      <span className="text-red-700 dark:text-red-400 font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {!isLoading && !error && questions.length > 0 && (
                  <div className="space-y-4">
                    {questions.map((q: any, idx: number) => {
                      const segIdx = segmentIds.findIndex((sid) => sid === q.segmentId)
                      const segStart = segIdx === 0 ? 0 : segmentIds[segIdx - 1]
                      const segEnd = q.segmentId

                      return (
                        <div
                          key={q.question?.text || idx}
                          className="bg-card/90 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                        >
                          {/* Question Metadata */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4 text-xs">
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                                {typeof segStart === "number" && typeof segEnd === "number" ? `${segStart}–${segEnd}s` : "N/A"}
                              </span>
                              <span className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full font-medium">
                                {q.questionType || q.question?.type || "N/A"}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-white transition-colors bg-transparent"
                              onClick={() => {
                                setEditingIdx(idx)
                                setEditQuestion(JSON.parse(JSON.stringify(q)))
                                setEditModalOpen(true)
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>

                          {/* Question Text */}
                          <div className="mb-3">
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                              Q{idx + 1}: {q.question?.text}
                            </h4>
                            {q.question?.hint && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">💡 Hint: {q.question.hint}</p>
                            )}
                          </div>

                          {/* Answer Options */}
                          {q.solution && (
                            <div className="space-y-2">
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Answer Options:</h5>
                              <div className="space-y-1">
                                {/* Incorrect Options */}
                                {q.solution.incorrectLotItems?.map((opt: any, oIdx: any) => (
                                  <div
                                    key={`inc-${oIdx}`}
                                    className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm"
                                  >
                                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                      <span className="text-white text-xs">✕</span>
                                    </div>
                                    <span className="text-red-700 dark:text-red-300">{opt.text}</span>
                                  </div>
                                ))}

                                {/* Correct Options */}
                                {q.solution.correctLotItems?.map((opt: any, oIdx: any) => (
                                  <div
                                    key={`cor-${oIdx}`}
                                    className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm"
                                  >
                                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                      <span className="text-white text-xs">✓</span>
                                    </div>
                                    <span className="text-green-700 dark:text-green-300 font-medium">{opt.text}</span>
                                  </div>
                                ))}

                                {/* Single Correct Option */}
                                {q.solution.correctLotItem && (
                                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm">
                                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                      <span className="text-white text-xs">✓</span>
                                    </div>
                                    <span className="text-green-700 dark:text-green-300 font-medium">
                                      {q.solution.correctLotItem.text}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!isTaskResultLoading && !error && questions.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">❓</span>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Questions Found</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">There are currently no questions to display.</p>
                  </div>
                )}
              </div>
            </div>
          }
          <EditQuestionDialog
             editModalOpen={editModalOpen}
             setEditModalOpen={setEditModalOpen}
             editQuestion={editQuestion}
             questions={questions}
             editingIdx={editingIdx || 0}
             aiJobId={aiJobId}
             aiSectionAPI={aiSectionAPI}
             handleShowHandleResult={handleShowHandleResult}
          />
          <div className="flex items-center justify-between mt-5">
          <div className="flex-1"></div>

          <div className="flex-1 flex justify-center">
            {/* {(currentJobStatus == "WAITING" || isLoading || currentJobStatus === "FAILED") && currentJobStatus != "COMPLETED" && */}
                  <Button
                  onClick={handleAddParams}
                  disabled = { isLoading || isWaitingServer || currentJobStatus == "COMPLETED"}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary 
                              text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg 
                              hover:shadow-xl transition-all duration-300 transform hover:scale-105 
                              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none 
                              flex items-center justify-center gap-2"
                  >
                      { error || currentJobStatus === "FAILED" || currentJobStatus == "COMPLETED"? (
                        <>
                          {isApprovingTask
                            ? currentJobStatus === "COMPLETED"
                              ? "Re-running..."
                              : "Retry..."
                            : currentJobStatus === "COMPLETED"
                              ? "Re - run"
                              : "Retry"}
                          <RefreshCw className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          {isApprovingTask ? "Generating...": "Generate Question"}
                          <Zap className="w-5 h-5" />
                        </>
                      )}
                  </Button>
              {/* } */}
              
          </div>

          <div className="flex-1 flex justify-end">
              {currentJobStatus == "COMPLETED"  &&
                  <Button
                  variant="secondary"
                  onClick={handleNext}
                  disabled={isTaskResultLoading || isLoading}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary 
                              text-primary-foreground font-semibold px-8 py-5 rounded-xl shadow-lg 
                              hover:shadow-xl transition-all duration-300 transform hover:scale-105 
                              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none 
                              flex items-center justify-center gap-2"
                  >
                  Next
                  <ArrowRight className="w-5 h-5" />
                  </Button>
              }
          </div>
          </div>
        </div>
)};

interface EditQuestionDialogProps {
  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  editQuestion: any;
  questions: any[];
  editingIdx: number;
  aiJobId: string | null;
  aiSectionAPI: any;
  handleShowHandleResult: (task: string) => void
}

const EditQuestionDialog: React.FC<EditQuestionDialogProps> = ({
  editModalOpen,
  setEditModalOpen,
  editQuestion,
  questions,
  editingIdx,
  aiJobId,
  aiSectionAPI,
  handleShowHandleResult
}) => {
  return (
    <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="mb-5">Edit Question</DialogTitle>
        </DialogHeader>
        {editQuestion && (
          <QuestionEditForm
            question={editQuestion}
            onSave={async (edited) => {
              if (!aiJobId || typeof aiSectionAPI.editQuestionData !== 'function') return;
              try {
                const updatedQuestions = questions.map((q, idx) =>
                  idx !== editingIdx ? q : { ...q, question: { ...q.question, text: edited.text }, solution: edited.solution }
                );
                await aiSectionAPI.editQuestionData(aiJobId, 0, updatedQuestions);
                handleShowHandleResult("QUESTION_GENERATION");
                toast.success('Question Updated.');
              } catch (e) {
                toast.error("Failed update question!")
              } finally {
                setEditModalOpen(false);
              }
            }}
            onCancel={() => setEditModalOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

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
      <div
        className="space-y-4 max-h-[80vh] overflow-y-auto"
        role="region"
        aria-labelledby="qg-editor-title"
        >
        <h3 id="qg-editor-title" className="sr-only mb-5">
            Edit Question and Options
        </h3>

        <div>
            <Label htmlFor="question-text" className="text-sm font-medium text-foreground">
            Question Text
            </Label>
            <Textarea
            id="question-text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Enter question text"
            className="mt-1"
            aria-describedby="question-text-help"
            autoComplete="off"
            />
            <p id="question-text-help" className="text-xs text-muted-foreground mt-1">
            Keep it clear and concise. You can add any necessary context here.
            </p>
        </div>

        <fieldset aria-labelledby="options-legend">
            <legend id="options-legend" className="text-sm font-medium text-foreground">
            Options
            </legend>

            <div className="space-y-2 mt-2 max-h-[50vh] overflow-y-auto pr-2">
            {options.map((option: any, idx: number) => (
                <fieldset
                key={idx}
                className="flex flex-col gap-2 border rounded-md p-3 bg-card"
                aria-labelledby={`option-${idx}-legend`}
                >
                <legend id={`option-${idx}-legend`} className="sr-only">
                    Option {idx + 1}
                </legend>

                <div className="flex items-center gap-2">
                    <Label htmlFor={`opt-correct-${idx}`} className="sr-only">
                    {normalized.type === 'SELECT_ONE_IN_LOT'
                        ? `Mark option ${idx + 1} as correct`
                        : `Toggle option ${idx + 1} correctness`}
                    </Label>
                    {normalized.type === 'SELECT_ONE_IN_LOT' ? (
                    <input
                        id={`opt-correct-${idx}`}
                        name="correct-answer" 
                        type="radio"
                        checked={option.correct}
                        onChange={() => handleCorrect(idx, true)}
                        className="h-4 w-4 shrink-0 rounded border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-checked={option.correct}
                        aria-describedby={`opt-text-${idx}`}
                    />
                    ) : (
                    <input
                        id={`opt-correct-${idx}`}
                        type="checkbox"
                        checked={option.correct}
                        onChange={(e) => handleCorrect(idx, e.target.checked)}
                        className="h-4 w-4 shrink-0 rounded border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-checked={option.correct}
                        aria-describedby={`opt-text-${idx}`}
                    />
                    )}

                    <Label htmlFor={`opt-text-${idx}`} className="sr-only">
                    Option {idx + 1} text
                    </Label>
                    <Input
                    id={`opt-text-${idx}`}
                    value={option.text}
                    onChange={(e) => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1"
                    autoComplete="off"
                    />

                    <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove option ${idx + 1}`}
                    title={`Remove option ${idx + 1}`}
                    >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>

                <Label htmlFor={`opt-expl-${idx}`} className="sr-only">
                    Explanation for option {idx + 1}
                </Label>
                <Textarea
                    id={`opt-expl-${idx}`}
                    value={option.explaination}
                    onChange={(e) => handleOptionExplain(idx, e.target.value)}
                    placeholder="Explanation for this option (why correct/incorrect)"
                    className="mt-1"
                    rows={2}
                    aria-describedby={`opt-text-${idx}`}
                />
                </fieldset>
            ))}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="w-full"
                aria-label="Add a new option"
                title="Add a new option"
            >
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Add Option
            </Button>
            </div>
        </fieldset>

        <div className="flex gap-2 pt-4">
            <Button
            type="button"
            onClick={() => {
                const solution = buildSolution();
                onSave({ text: questionText, solution });
            }}
            className="flex-1"
            disabled={!canSave}
            aria-disabled={!canSave}
            title={canSave ? 'Save changes' : 'Complete required fields to save'}
            >
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            Save Changes
            </Button>

            <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            aria-label="Cancel and discard changes"
            title="Cancel"
            >
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            Cancel
            </Button>
        </div>
      </div>
    );
};

const SegmentationView = ({
  isLoading,
  isTaskResultLoading,
  error,
  aiJobId,
  segmentationMap,
  segmentationChunks,
  segments,
  handleApproveTask,
  currentJobStatus,
  customSegmentationParams,
  setCustomSegmentationParams,
  updateCurrentJob,
  handleShowHandleResult,
  isWaitingServer,
  isApprovingTask,
}: any) => {

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSegMap, setEditSegMap] = useState<number[]>([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

        // Add state for transcriptChunks in the edit modal
    const [editTranscriptChunks, setEditTranscriptChunks] = useState<{ timestamp: [number, number], text: string }[]>([]);

    const isJobCompleted = currentJobStatus == "COMPLETED"

    const isAnyLoading = isLoading || isTaskResultLoading;
    const hasSegmentationData = segmentationMap?.length > 0 && segmentationChunks;
    const hasFallbackSegments = segments.length > 0 && (!segmentationMap?.length || !segmentationChunks);
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

    const handleSaveEditSeg = async () => {
        setEditLoading(true);
        setEditError("");
        try {
          // Use index 0 for the backend (fixes 500 error)
          await editSegmentMap(aiJobId, editSegMap, 0);
          handleShowHandleResult("SEGMENTATION");
          toast.success('Segments updated successfully!');
          setEditModalOpen(false);
        } catch (e: any) {
          setEditError(e.message || 'Failed to update segment map');
        } finally {
          setEditLoading(false);
        }
    };
  
    const handleConfirm = async () => {
        if (currentJobStatus === "COMPLETED") {
          try {
            await aiSectionAPI.rerunJobTask(aiJobId, "SEGMENTATION", customSegmentationParams);
            // handleShowHandleResult("SEGMENTATION");
            toast.success("Re-run success!");
          } catch (err) {
            toast.error("Re-run failed, try again!");
            console.error("Re-run failed:", err);
          }
        } else {
          handleApproveTask();
        }
      };

    const handleNext = () => {
        updateCurrentJob ("questionGeneration", "WAITING");
    }
    

  return (
    <div className={`${currentJobStatus!="WAITING" && "py-12"} text-center text-gray-500`}>
        {(currentJobStatus !== "COMPLETED" || isSettingsOpen) && (
            <div className="px-6 py-4 flex items-center justify-between gap-6 border rounded-lg shadow-sm bg-card mb-5">
                <div className="flex-1">
                <Label className="text-sm font-medium dark:text-gray-100 text-gray-800">
                    Segmentation Frequency
                </Label>
                <Select
                    onValueChange={(value) => {
                    setCustomSegmentationParams((prev: any) => ({
                        ...prev,
                        lam: parseFloat(value),
                    }));
                    }}
                    disabled={isAnyLoading || isWaitingServer || isApprovingTask}
                    value={customSegmentationParams.lam.toString()}
                >
                    <SelectTrigger className="mt-2 h-10 w-full md:w-64">
                    <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="0.5" >Very Frequent</SelectItem>
                    <SelectItem value="2">Frequent</SelectItem>
                    <SelectItem value="4.5">Normal</SelectItem>
                    <SelectItem value="5.5">Less Frequent</SelectItem>
                    <SelectItem value="7">Very Less Frequent</SelectItem>
                    </SelectContent>
                </Select>
                </div>

                <div className="mt-7 text-sm dark:text-gray-200 text-gray-900 max-w-xs transition-opacity duration-300">
                {customSegmentationParams.lam === 0.5 &&
                    "Segments will be created very frequently, providing high detail and precision."}
                {customSegmentationParams.lam === 2 &&
                    "Segments will be created frequently, offering a balance between detail and performance."}
                {customSegmentationParams.lam === 4.5 &&
                    "Normal segmentation – balanced detail and efficiency for general use cases."}
                {customSegmentationParams.lam === 5.5 &&
                    "Less frequent segmentation – fewer segments, faster processing but lower detail."}
                {customSegmentationParams.lam === 7 &&
                    "Very minimal segmentation – ideal for large datasets where performance is critical."}
                </div>
            </div>
        )}
      {currentJobStatus === "FAILED" && (
              <div className="flex items-center justify-center gap-2 mb-12 text-red-600 dark:text-red-400 font-medium">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Job failed. Please try again.</span>
              </div>
      )}
      {(isAnyLoading || isWaitingServer) ? (
        <div className="flex items-center gap-2 text-primary font-medium mb-2">
          <svg
            className="animate-spin h-4 w-4 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>

          {isAnyLoading && "Preparing segmentation ..."}
          {isWaitingServer && !isAnyLoading && "Waiting for server response ..."}
      </div>
      ) : hasSegmentationData ?(
        <>
        <div className="flex justify-end mb-4">
        <Button
            size="icon"
            variant="outline"
            onClick={handleOpenEditModal}
            className={`p-2 hover:scale-105 transition-transform duration-200 shadow-sm `}
        >
            <Pencil className="h-4 w-4 dark:text-white text-black" />
        </Button>

        <Button
        variant="outline"
        size="icon"
        className={`ms-4 hover:scale-105 transition-transform duration-200 shadow-sm ${isSettingsOpen && "bg-primary "}`}
        onClick={() => setIsSettingsOpen((prev) => !prev)}
        aria-pressed={isSettingsOpen}
      >
        <Settings className="w-7 h-7 dark:text-white text-black" />
      </Button>

        </div>
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg ">
            <DialogHeader>
              <DialogTitle className="mb-4">Edit Segments</DialogTitle>
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
            <div className="space-y-3">
              {segmentationMap.map((end: number, idx: number) => {
                const start = idx === 0 ? 0 : segmentationMap[idx - 1]
                const segChunks = segmentationChunks[idx] || []

                return (
                  <div
                    key={idx}
                    className="bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-card/90 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{idx + 1}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Segment {idx + 1}</h3>
                      </div>

                      <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                        <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {start.toFixed(2)}s – {end.toFixed(2)}s
                        </span>
                      </div>
                    </div>

                    {segChunks.length > 0 && (
                      <div className="flex items-start gap-2 bg-card/90 border rounded-md p-3 shadow-md shadow-gray-300 dark:shadow-gray-900">
                        <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {segChunks.map((chunk: { text: string }) => chunk.text).join(" ")}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        </>
      ) : hasFallbackSegments ? (
        <div className="space-y-3">
          {segments.map((seg: any, idx: number) => {
            const startTime = seg.startTime ?? seg.timestamp?.[0]
            const endTime = seg.endTime ?? seg.timestamp?.[1]

            return (
              <div
                key={idx}
                className="bg-card border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-card rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{idx + 1}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Segment {idx + 1}</h3>
                  </div>

                  <div className="flex items-center gap-1 bg-card px-3 py-1 rounded-full">
                    <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {startTime}s - {endTime}s
                    </span>
                  </div>
                </div>

                {seg.text && (
                  <div className="flex items-start gap-2 bg-card border rounded-md p-3">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{seg.text}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    {currentJobStatus == "COMPLETED" && !isAnyLoading && !isWaitingServer && !error && (!segmentationMap || segmentationMap.length === 0) && segments.length === 0 && <div className="mt-2">No segments found.</div>}

        <div className="flex items-center justify-between mt-8">
            <div className="flex-1"></div>
            <div className="flex-1 flex justify-center">
                    <Button
                    // onClick={handleConfirm}
                    onClick={()=> handleApproveTask()}
                    // disabled={isLoading || isWaitingServer || isApprovingTask}
                    disabled={isLoading || isWaitingServer || isApprovingTask || currentJobStatus == "COMPLETED"}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lghover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                    { error || currentJobStatus == "FAILED" || currentJobStatus == "COMPLETED" ? (
                     <>
                      {isApprovingTask
                        ? currentJobStatus === "COMPLETED"
                          ? "Re-running..."
                          : "Retry..."
                        : currentJobStatus === "COMPLETED"
                          ? "Re - run"
                          : "Retry"}
                      <RefreshCw className="w-5 h-5" />
                    </>
                    ) : (
                      <>
                        {isApprovingTask ? "Confirming...": "Confirm"}
                        <CheckCircle className="w-5 h-5" />
                      </>
                    )}
                  </Button>
            </div>
            <div className="flex-1 flex justify-end">
                {currentJobStatus=="COMPLETED" &&
                    <Button
                        variant="secondary"
                        onClick={handleNext}
                        disabled={isAnyLoading}
                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none 
                        flex items-center justify-center gap-2"
                        >
                        Next
                    </Button>
                }
            </div>
        </div>
    </div>
  );
};
interface UploadContentProps {
  currentJobStatus: string;
  uploadParams: UploadParams;
  setUploadParams: React.Dispatch<React.SetStateAction<UploadParams>>;
  isLoading: boolean;
  handleApproveTask: (qnGenParms?: QuestionGenerationParameters) => void;
  isApprovingTask: boolean;
}

const UploadContentView: React.FC<UploadContentProps> = ({
  currentJobStatus,
  uploadParams,
  setUploadParams,
  isLoading, 
  handleApproveTask,
  isApprovingTask
}) => {
  const navigate = useNavigate();

  if(currentJobStatus !== "COMPLETED") { 
    return(<div className="space-y-6">
        {/* Upload Parameters */}
        <div className="rounded-xl border p-6 space-y-4 pb-10 mt-5">
        <h4 className="font-semibold text-base text-foreground mb-4">Upload Parameters</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
            <Label htmlFor="video-base-name" className="text-sm font-medium">
                Video Item Name
            </Label>
            <Input
                id="video-base-name"
                value={uploadParams.videoItemBaseName}
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, videoItemBaseName: e.target.value }))
                }
                placeholder="video_item"
                className="h-10"
            />
            </div>
            <div className="space-y-2">
            <Label htmlFor="quiz-base-name" className="text-sm font-medium">
                Quiz Item Name
            </Label>
            <Input
                id="quiz-base-name"
                value={uploadParams.quizItemBaseName}
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, quizItemBaseName: e.target.value }))
                }
                placeholder="quiz_item"
                className="h-10"
            />
            </div>
            <div className="space-y-2">
            <Label htmlFor="questions-per-quiz" className="text-sm font-medium">
                Questions Per Quiz
            </Label>
            <Input
                id="questions-per-quiz"
                type="number"
                min={1}
                value={uploadParams.questionsPerQuiz || 1}
                onChange={(e) =>
                setUploadParams((prev) => ({ ...prev, questionsPerQuiz: Number(e.target.value) }))
                }
                className="h-10"
            />
            </div>
        </div>
        </div>

        {/* Centered Next Button */}
        <div className="flex justify-center">
        <Button
            onClick={() => handleApproveTask()}
            disabled={isLoading || isApprovingTask}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
           {isApprovingTask ? "Upload Content ..." : "Upload Content"}
            <UploadCloud className="w-5 h-5" />
        </Button>
        </div>
    </div>)
    }


  return (
    <div className="text-center py-8">
      <p className="text-lg font-medium text-green-600">Course uploaded successfully!</p>
      <Button
        className="mt-4 px-6 py-2 bg-primary text-black rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
        onClick={() => navigate({ to: "/teacher/courses/view" })}
      >
        View Course
      </Button>
    </div>
  );
};

export default AiWorkflow

