// API functions for crowd question workflow

const BASE_URL = `${import.meta.env.VITE_BASE_URL || ""}/api`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('firebase-auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err: any = new Error(errData.message || `Request failed (${res.status})`);
    err.response = { json: async () => errData };
    err.data = errData;
    throw err;
  }
  return res.json();
}

// Fetch course settings (including crowd question toggle)
export async function getCourseSettings(courseId: string) {
  return apiFetch(`${BASE_URL}/courses/${courseId}/settings`);
}

// Fetch one crowd question per segment for the student
export async function getCrowdQuestions(courseId: string, segmentId?: string) {
  let url = `${BASE_URL}/courses/${courseId}/crowd-questions`;
  if (segmentId) url += `?segmentId=${encodeURIComponent(segmentId)}`;
  return apiFetch(url);
}

// Submit a student's attempt for a crowd question
export async function submitCrowdQuestionAttempt({ courseId, segmentId, questionId, answer }: {
  courseId: string;
  segmentId: string;
  questionId: string;
  answer: string;
}) {
  return apiFetch(`${BASE_URL}/courses/${courseId}/crowd-questions/${questionId}/attempt`, {
    method: 'POST',
    body: JSON.stringify({ segmentId, answer }),
  });
}
