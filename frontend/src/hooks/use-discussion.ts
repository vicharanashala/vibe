import { useState, useEffect, useCallback } from "react";

export interface DiscussionReply {
  _id: string;
  threadId: string;
  body: string;
  author: {
    uid: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionThread {
  _id: string;
  courseId: string;
  cohortId: string;
  title: string;
  body: string;
  author: {
    uid: string;
    name: string;
    avatar?: string;
  };
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  replies?: DiscussionReply[];
}

const getHeaders = () => {
  const token = localStorage.getItem("firebase-auth-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export function useListDiscussionThreads(courseId: string | null, cohortId: string | null) {
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ courseId });
      if (cohortId) params.append("cohortId", cohortId);

      const url = `${import.meta.env.VITE_BASE_URL}/discussions/threads?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load threads: ${response.statusText}`);
      }

      const data = await response.json();
      // Sort most-recent-first (by lastActivityAt or createdAt)
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        const timeA = new Date(a.lastActivityAt || a.createdAt).getTime();
        const timeB = new Date(b.lastActivityAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      setThreads(sorted);
    } catch (err: any) {
      setError(err.message || "Failed to load discussions");
    } finally {
      setLoading(false);
    }
  }, [courseId, cohortId]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  return { threads, setThreads, loading, error, refetch: fetchThreads };
}

export function useGetDiscussionThread(threadId: string | null) {
  const [thread, setThread] = useState<DiscussionThread | null>(null);
  const [replies, setReplies] = useState<DiscussionReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreadDetails = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_BASE_URL}/discussions/threads/${threadId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load thread details: ${response.statusText}`);
      }

      const data = await response.json();
      setThread(data);
      // Flat list of replies - backend detail GET typically includes nested replies
      setReplies(data.replies || []);
    } catch (err: any) {
      setError(err.message || "Failed to load thread details");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void fetchThreadDetails();
  }, [fetchThreadDetails]);

  return { thread, replies, setReplies, setThread, loading, error, refetch: fetchThreadDetails };
}

export function useCreateDiscussionThread() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createThread = async (payload: {
    courseId: string;
    cohortId: string;
    title: string;
    body: string;
  }): Promise<DiscussionThread> => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_BASE_URL}/discussions/threads`;
      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let serverMsg = "";
        try {
          const errBody = await response.json();
          serverMsg = errBody.message || errBody.error || "";
        } catch { /* ignored */ }
        throw new Error(serverMsg || `Failed to create thread: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message || "Failed to create thread");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createThread, loading, error };
}

export function useCreateDiscussionReply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReply = async (threadId: string, body: string): Promise<DiscussionReply> => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_BASE_URL}/discussions/threads/${threadId}/replies`;
      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        let serverMsg = "";
        try {
          const errBody = await response.json();
          serverMsg = errBody.message || errBody.error || "";
        } catch { /* ignored */ }
        throw new Error(serverMsg || `Failed to reply: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message || "Failed to submit reply");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createReply, loading, error };
}

export function useDeleteDiscussionThread() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteThread = async (threadId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_BASE_URL}/discussions/threads/${threadId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete thread: ${response.statusText}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete thread");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteThread, loading, error };
}

export function useDeleteDiscussionReply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteReply = async (replyId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_BASE_URL}/discussions/replies/${replyId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete reply: ${response.statusText}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete reply");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteReply, loading, error };
}
