// Smart Bloom direct path: runs Smart Bloom without the AI server.
// The instructor pastes the transcript (from YouTube's "Show transcript" panel)
// or uploads a file; segmentation and questions come from MiniMax on the ViBe
// backend. Stateless: the page keeps the transcript, segment map and questions
// between calls.

export type TranscriptChunk = { timestamp: [number, number]; text: string };

export interface IDirectTranscriptResult {
  transcript: { chunks: TranscriptChunk[] };
}

export interface IDirectSegmentResult {
  segmentMap: number[];
  method: "MODEL" | "EVEN_SPLIT";
  warning?: string;
}

export interface IDirectQuestionsResult {
  questions: Record<string, unknown>[];
  failedLevels: string[];
  dropped: number;
}

export interface IDirectUploadSummary {
  videoItems: number;
  quizItems: number;
  questionBanks: number;
  questionsCreated: number;
  questionsSkipped: number;
}

const BASE_URL = import.meta.env.VITE_BASE_URL;

/** An error from the direct routes, keeping the HTTP status (503 = not set up on the server). */
export class DirectApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem("firebase-auth-token");
  if (!token) throw new Error("You are signed out. Please sign in again.");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/smart-bloom/direct${path}`, {
      method,
      mode: "cors",
      credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the ViBe server. Check your connection and try again.");
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const errorBody = (data ?? {}) as { message?: unknown; error?: unknown };
    const message = errorBody.message || errorBody.error || text || response.statusText;
    throw new DirectApiError(String(message), response.status);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);

export const smartBloomDirectAPI = {
  status: () => request<{ minimaxConfigured: boolean }>("GET", "/status"),

  /** Read a pasted or uploaded transcript in any layout that has timestamps. */
  transcript: (versionId: string, content: string) =>
    post<IDirectTranscriptResult>("/transcript", { versionId, content }),

  segment: (params: {
    versionId: string;
    chunks: TranscriptChunk[];
    strategy: "DEFAULT" | "CONCEPT_END";
    minSegmentSeconds: number;
  }) => post<IDirectSegmentResult>("/segments", params),

  generateQuestions: (params: {
    versionId: string;
    segmentNumber: number;
    startSeconds: number;
    endSeconds: number;
    segmentText: string;
    bloomTargets: Record<string, number>;
    questionTypes: string[];
    instructions?: string;
  }) => post<IDirectQuestionsResult>("/questions", params),

  upload: (params: {
    versionId: string;
    moduleId: string;
    sectionId: string;
    videoUrl: string;
    segmentMap: number[];
    questions: unknown[];
    distribution?: Record<string, number>;
    videoItemBaseName?: string;
    quizItemBaseName?: string;
  }) => post<IDirectUploadSummary>("/upload", params),
};

/** Transcript text spoken inside [start, end), by chunk start time. */
export const textInWindow = (chunks: TranscriptChunk[], start: number, end: number): string =>
  chunks
    .filter((chunk) => chunk.timestamp[0] >= start && chunk.timestamp[0] < end)
    .map((chunk) => chunk.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
