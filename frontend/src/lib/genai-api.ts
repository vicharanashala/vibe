import { EventSourcePolyfill } from 'event-source-polyfill';

// GenAI API utility functions
// Updated to use job+task system



// Environment-based API configuration
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_BASE_URL;
};

const API_BASE_URL = getApiBaseUrl();

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('firebase-auth-token');
};

export function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

// Helper function to make authenticated API calls
const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication token not found');
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Origin': window.location.origin,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`CORS or network error: Unable to connect to ${API_BASE_URL}. Please check if the backend is accessible and CORS is properly configured.`);
    }
    throw error;
  }
};

// Job status types

type JobStatusValue = "COMPLETED" | "FAILED" | "PENDING" | "WAITING" | "RUNNING" | "STOPPED";

export interface JobStatus {
  _id: string;
  type: 'VIDEO';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  sourceUrl: string;
  currentTask?: {
    type: 'AUDIO_EXTRACTION' | 'TRANSCRIPT_GENERATION' | 'SEGMENTATION' | 'QUESTION_GENERATION';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  };
  task: string;
  tasksCompleted: number;
  createdAt: string;
  updatedAt: string;
  result?: any; // Final result when job is completed
  jobStatus?: {
    audioExtraction: JobStatusValue;
    transcriptGeneration?: JobStatusValue;
    segmentation?: JobStatusValue;
    questionGeneration?: JobStatusValue;
    uploadContent?: JobStatusValue;
  };
  audioExtraction?: any[];
  transcriptGeneration?: any[];
  segmentation?: any[];
  questionGeneration?: any[];
  uploadContent?: any[];
}

// Types for optional task parameters
export interface TranscriptParameters {
  language?: string;
  modelSize?: string;
}

export interface SegmentationParameters {
  lam?: number;
  runs?: number;
  noiseId?: number;
}

export interface QuestionGenerationParameters {
  model?: string;
  SOL?: number;
  SML?: number;
  NAT?: number;
  DES?: number;
  BIN?: number;
  prompt?: string;
  numberOfQuestions?: number;
  smartBloom?: {
    enabled?: boolean;
    segmentationStrategy?: 'DEFAULT' | 'CONCEPT_END';
    distribution?: {
      knowledge: number;
      understanding: number;
      application: number;
      analysis?: number;
      evaluation?: number;
      creation?: number;
    };
  };
}

export interface Chunk {
  timestamp: number[];
  text: string;
}

export interface Transcript {
  chunks: Chunk[];
}

// 1. Create GenAI Job
export const createGenAIJob = async (
  params: {
    videoUrl: string;
    transcript?: Transcript;
    courseId: string;
    versionId: string;
    moduleId?: string | null;
    sectionId?: string | null;
    videoItemBaseName?: string;
    quizItemBaseName?: string;
    questionsPerQuiz?: number | null;

    // optional parameters
    transcriptParameters?: TranscriptParameters;
    segmentationParameters?: SegmentationParameters;
    questionGenerationParameters?: QuestionGenerationParameters;

  }
): Promise<{ jobId: string }> => {
  const {
    videoUrl,
    transcript,
    courseId,
    versionId,
    moduleId,
    sectionId,
    videoItemBaseName = 'video_item',
    quizItemBaseName = 'quiz_item',
    questionsPerQuiz,
    transcriptParameters,
    segmentationParameters,
    questionGenerationParameters,
  } = params;
  const uploadParameters: Record<string, any> = {
    courseId,
    versionId,
    videoItemBaseName,
    quizItemBaseName,
  };

  // Setting optional parameters
  if (moduleId) uploadParameters.moduleId = moduleId;
  if (sectionId) uploadParameters.sectionId = sectionId;
  if (questionsPerQuiz) uploadParameters.questionsPerQuiz = questionsPerQuiz;

  const body: Record<string, any> = {
    type: 'VIDEO',
    url: videoUrl,
    uploadParameters,
  };

  // Add transcription chunks
  if (transcript)
    body.transcript = transcript

  // Add optional task parameters if provided
  if (transcriptParameters)
    body.transcriptParameters = transcriptParameters;

  if (segmentationParameters)
    body.segmentationParameters = segmentationParameters;

  if (questionGenerationParameters)
    body.questionGenerationParameters = questionGenerationParameters;


  const response = await makeAuthenticatedRequest('/genai/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result = await response.json();
  return { jobId: result.jobId };

}

// 2. Get Job Status
export const getJobStatus = async (jobId: string): Promise<JobStatus> => {

  const response = await makeAuthenticatedRequest(`/genai/jobs/${jobId}`, {
    method: 'GET',
  });

  const result = await response.json();
  return result;
};

// 2.1 Get Task Status
export const getTaskStatus = async (jobId: string | null, taskType: string): Promise<any> => {
  if (!jobId || !taskType) {
    throw new Error('Job ID and Task Type are required to get task status');
  }
  const response = await makeAuthenticatedRequest(`/genai/${jobId}/tasks/${taskType}/status`, {
    method: 'GET',
  });

  const result = await response.json();
  return result;
};

export const stopJobTask = async (jobId: string): Promise<void> => {

  const response = await makeAuthenticatedRequest(`/genai/jobs/${jobId}/tasks/abort`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to stop job task: ${response.status} ${response.statusText}`);
  }

  console.log('Job task stopped successfully');
  return response.json();
};

export const connectToLiveStatusUpdates = (
  jobId: string,
  setAiJobStatus: (status: JobStatus) => void
  // onMessage: (status: JobStatus) => void,
  // onError?: (error: any) => void
): EventSource => {

  const url = `${API_BASE_URL}/genai/${jobId}/live`;


  const eventSource = new EventSourcePolyfill(url, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    // Some tasks can run >45s without emitting status updates.
    // Keep the connection alive longer before the polyfill treats it as dead.
    heartbeatTimeout: 180000,
  });

  eventSource.onmessage = (event) => {
    try {

      // onMessage(data);
    } catch (err) {
      console.error('Failed to parse SSE message:', err);
    }
  };

  eventSource.addEventListener('jobStatus', (event) => {
    const messageEvent = event as MessageEvent;
    let data: JobStatus = JSON.parse(messageEvent.data);
    setAiJobStatus(data);
  });

  eventSource.onerror = (error) => {
    // EventSource may emit transient reconnect errors; keep this as warning noise only.
    console.warn('SSE reconnecting...', error);
    // if (onError) onError(error);
  };

  return eventSource;
};


// 3. Poll Job Status (with automatic polling)
export const pollJobStatus = async (
  jobId: string,
  onStatusUpdate?: (status: JobStatus) => void,
  maxAttempts: number = 60, // 5 minutes with 5-second intervals
  intervalMs: number = 5000
): Promise<JobStatus> => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getJobStatus(jobId);

    if (onStatusUpdate) {
      onStatusUpdate(status);
    }

    if (status.status === 'COMPLETED') {
      return status;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Job failed: ${status.currentTask?.type || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error(`Job polling timeout after ${maxAttempts} attempts`);
};

// 5. Upload Anomaly (Image)
export const uploadAnomalyImage = async (
  file: File,
  type: string,
  courseId: string,
  versionId: string,
  itemId: string
): Promise<any> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication token not found');
  }

  const formData = new FormData();
  formData.append('type', type);
  formData.append('courseId', courseId);
  formData.append('versionId', versionId);
  formData.append('itemId', itemId);
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/anomalies/record/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// 6. Upload Anomaly (Audio)
export const uploadAnomalyAudio = async (
  file: File,
  type: string,
  courseId: string,
  versionId: string,
  itemId: string
): Promise<any> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication token not found');
  }

  const formData = new FormData();
  formData.append('type', type);
  formData.append('courseId', courseId);
  formData.append('versionId', versionId);
  formData.append('itemId', itemId);
  formData.append('audio', file);

  const response = await fetch(`${API_BASE_URL}/anomalies/record/audio`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Test function to check available endpoints
export const testApiConnection = async (): Promise<any> => {
  try {
    // Test a simple GET request to see if the API is accessible
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return { status: response.status, ok: response.ok };
  } catch (error) {
    console.error('Health check failed:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const startTranscriptTask = async (jobId: string) => {
  return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'TRANSCRIPT_GENERATION',
    }),
  });
};

export const startAudioExtractionTask = async (jobId: string) => {
  return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'AUDIO_EXTRACTION',
      parameters: {},
      usePrevious: 1,
    }),
  });
};

export const approveContinueTask = async (jobId: string) => {
  return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/continue`, {
    method: 'POST',
  });
};

export const approveStartTask = async (jobId: string, payload: any) => {
  console.log(`Starting task (approve) ${payload.type} for job ${jobId}`, payload);
  return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const runTranscriptionWorkflow = async (
  jobId: string,
  onStatusUpdate?: (status: JobStatus) => void
) => {
  // 1. Check job status
  let status = await getJobStatus(jobId);

  // 2. If audio extraction not done, start it and poll for completion
  if (!status.jobStatus || status.jobStatus.audioExtraction !== 'COMPLETED') {
    await startAudioExtractionTask(jobId);
    // Wait for audio extraction to complete
    await pollForTaskCompletion(jobId, 'AUDIO_EXTRACTION', onStatusUpdate);
  }

  // 3. Re-check job status to ensure audio extraction is completed
  status = await getJobStatus(jobId);
  if (status.jobStatus && status.jobStatus.audioExtraction === 'COMPLETED') {
    // 4. Approve to continue to the next task
    await approveContinueTask(jobId);
    // 5. POST to start transcript generation
    await startTranscriptTask(jobId);
    // 6. Poll for transcript completion
    return pollForTaskCompletion(jobId, 'TRANSCRIPT_GENERATION', onStatusUpdate);
  } else {
    throw new Error('Audio extraction did not complete successfully.');
  }
};

// 5. Start/Approve a specific task in a job
export const postJobTask = async (
  jobId: string,
  taskType: string,
  parameters?: Record<string, any>,
  usePrevious?: number
) => {
  const payload = {
    type: taskType,
    usePrevious: typeof usePrevious === 'number' ? usePrevious : 0,
    parameters: parameters || {},
  };
  console.log(`Starting task ${taskType} for job ${jobId}`, payload);
  return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// Poll for a specific task type to complete
export const pollForTaskCompletion = async (
  jobId: string,
  taskType: string,
  onStatusUpdate?: (status: JobStatus) => void,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<JobStatus> => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const status = await getJobStatus(jobId);
    if (onStatusUpdate) onStatusUpdate(status);
    if (
      status.currentTask?.type === taskType &&
      status.currentTask.status === 'COMPLETED'
    ) {
      return status;
    }
    if (status.currentTask?.type === taskType && status.currentTask.status === 'FAILED') {
      throw new Error(`Task ${taskType} failed`);
    }
    await new Promise(res => setTimeout(res, intervalMs));
    attempts++;
  }
  throw new Error(`Polling timeout for task ${taskType}`);
};

// Rerun a specific task in a job
export const rerunJobTask = async (
  jobId: string,
  taskType: string,
  parameters?: Record<string, any>,
  usePrevious?: number
) => {
  const payload = {
    type: taskType,
    usePrevious: typeof usePrevious === 'number' ? usePrevious : 0, // Default 0 to avoid index issues
    parameters: parameters || {},
  };
  console.log(`Rerunning task ${taskType} for job ${jobId}`, payload);
  return makeAuthenticatedRequest(`/genai/jobs/${jobId}/tasks/rerun`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};


export const editQuestionData = async (jobId: string, questionData: any, index?: number,) => {
  return makeAuthenticatedRequest(`/genai/jobs/${jobId}/edit/question`, {
    method: 'PATCH',
    body: JSON.stringify({ index, questionData }),
  });
};

export const editTranscriptData = async (jobId: string, index: number, transcript: any) => {
  return makeAuthenticatedRequest(`/genai/jobs/${jobId}/edit/transcript`, {
    method: 'PATCH',
    body: JSON.stringify({ index, transcript }),
  });
};

export const editSegmentMap = async (jobId: string, segmentMap: number[], index?: number) => {
  return makeAuthenticatedRequest(`/genai/jobs/${jobId}/edit/segment-map`, {
    method: 'PATCH',
    body: JSON.stringify({ index, segmentMap }),
  });
};

// aiSectionAPI for modal usage
export const aiSectionAPI: {
  createJob: typeof createGenAIJob;
  getJobStatus: typeof getJobStatus;
  postJobTask: typeof postJobTask;
  pollForTaskCompletion: typeof pollForTaskCompletion;
  runTranscriptionWorkflow: typeof runTranscriptionWorkflow;
  approveContinueTask: typeof approveContinueTask;
  startAudioExtractionTask: typeof startAudioExtractionTask;
  rerunJobTask: typeof rerunJobTask;
  approveStartTask: typeof approveStartTask;
  editQuestionData: typeof editQuestionData;
  editTranscriptData: typeof editTranscriptData;
  editSegmentMap: typeof editSegmentMap;
  stopJobTask: typeof stopJobTask;
  getTaskStatus: typeof getTaskStatus;
} = {
  createJob: createGenAIJob,
  getJobStatus,
  postJobTask,
  stopJobTask,
  pollForTaskCompletion,
  runTranscriptionWorkflow,
  approveContinueTask,
  startAudioExtractionTask,
  rerunJobTask,
  approveStartTask,
  editSegmentMap,
  editQuestionData,
  editTranscriptData,
  getTaskStatus,
};

aiSectionAPI.editQuestionData = editQuestionData;
aiSectionAPI.editTranscriptData = editTranscriptData; 