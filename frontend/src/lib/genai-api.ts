// GenAI API utility functions
// Updated to use job+task system

// Environment-based API configuration
const getApiBaseUrl = (): string => {
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
export interface JobStatus {
  _id: string;
  type: 'VIDEO';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  sourceUrl: string;
  currentTask?: {
    type: 'AUDIO_EXTRACTION' | 'TRANSCRIPT_GENERATION' | 'SEGMENTATION' | 'QUESTION_GENERATION';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  };
  tasksCompleted: number;
  createdAt: string;
  updatedAt: string;
  result?: any; // Final result when job is completed
  jobStatus?: {
    audioExtraction: 'COMPLETED' | 'FAILED' | 'PENDING' | 'WAITING' | 'RUNNING';
    transcriptGeneration?: 'COMPLETED' | 'FAILED' | 'PENDING' | 'WAITING' | 'RUNNING';
    segmentation?: 'COMPLETED' | 'FAILED' | 'PENDING' | 'WAITING' | 'RUNNING';
    questionGeneration?: 'COMPLETED' | 'FAILED' | 'PENDING' | 'WAITING' | 'RUNNING';
    uploadContent?: 'COMPLETED' | 'FAILED' | 'PENDING' | 'WAITING' | 'RUNNING';
  };
}

// 1. Create GenAI Job
export const createGenAIJob = async (
  params: {
    videoUrl: string;
    courseId: string;
    versionId: string;
    moduleId?: string | null;
    sectionId?: string | null;
    videoItemBaseName?: string;
    quizItemBaseName?: string;
  }
): Promise<{ jobId: string }> => {
  const {
    videoUrl,
    courseId,
    versionId,
    moduleId,
    sectionId,
    videoItemBaseName = 'video_item',
    quizItemBaseName = 'quiz_item',
  } = params;
  const uploadParameters: Record<string, any> = {
    courseId,
    versionId,
    videoItemBaseName,
    quizItemBaseName,
  };
  if (moduleId) uploadParameters.moduleId = moduleId;
  if (sectionId) uploadParameters.sectionId = sectionId;
  const response = await makeAuthenticatedRequest('/genai/jobs', {
    method: 'POST',
    body: JSON.stringify({
      type: 'VIDEO',
      url: videoUrl,
      uploadParameters,
    }),
  });
  const result = await response.json();
  return { jobId: result.jobId };
};

// 2. Get Job Status
export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
  console.log('Getting job status for:', jobId);
  
  const response = await makeAuthenticatedRequest(`/genai/jobs/${jobId}`, {
    method: 'GET',
  });
  
  const result = await response.json();
  console.log('Job status:', result);
  return result;
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
      console.log('Job completed successfully:', status);
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
    
    console.log('Health check response:', response.status, response.statusText);
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

export const postJobTask = async (
  jobId: string,
  taskType: string,
  params?: Record<string, any>,
  usePrevious?: number
) => {
  if (taskType === 'TRANSCRIPTION' || taskType === 'TRANSCRIPT_GENERATION') {
    // For reruns, params?.isRerun will be true
    if (params && params.isRerun) {
      return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'TRANSCRIPT_GENERATION',
          parameters: {
            language: 'en',
            modelSize: 'large',
          },
          usePrevious: 1,
        }),
      });
    } else {
      // First run: do NOT send usePrevious or parameters
      return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'TRANSCRIPT_GENERATION',
        }),
      });
    }
  }
  if (taskType === 'AUDIO_EXTRACTION') {
    return startAudioExtractionTask(jobId);
  }
  // Add support for other tasks
  if (
    taskType === 'SEGMENTATION'
  ) {
    return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
      method: 'POST',
      body: JSON.stringify({
        type: taskType,
        parameters: params || {},
        usePrevious: typeof usePrevious === 'number' ? usePrevious : 1,
      }),
    });
  }
  if (taskType === 'UPLOAD_CONTENT') {
    return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
      method: 'POST',
      body: JSON.stringify({
        type: taskType,
        parameters: params || {},
        usePrevious: typeof usePrevious === 'number' ? usePrevious : 0,
      }),
    });
  }
  if (taskType === 'QUESTION_GENERATION') {
    return makeAuthenticatedRequest(`/genai/${jobId}/tasks/approve/start`, {
      method: 'POST',
      body: JSON.stringify({
        type: taskType,
        parameters: params || {},
      }),
    });
  }
  throw new Error('Unsupported task type: ' + taskType);
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
  params?: Record<string, any>
) => {
  const token = localStorage.getItem('firebase-auth-token');
  const url = getApiUrl(`/genai/jobs/${jobId}/tasks/rerun`);
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: taskType,
    parameters: params || {},
  }),
});
return res;
};


export const editQuestionData = async (jobId: string, index: number, questionData: any) => {
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
  editQuestionData?: typeof editQuestionData;
  editTranscriptData?: typeof editTranscriptData;
} = {
  createJob: createGenAIJob,
  getJobStatus,
  postJobTask,
  pollForTaskCompletion,
  runTranscriptionWorkflow,
  approveContinueTask,
  startAudioExtractionTask,
  rerunJobTask,
  approveStartTask,
};

aiSectionAPI.editQuestionData = editQuestionData;
aiSectionAPI.editTranscriptData = editTranscriptData; 