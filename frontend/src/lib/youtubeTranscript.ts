import { apiClient } from './api-client.js';

export interface YouTubeTranscriptResult {
  status: 'ready' | 'no_transcript' | 'invalid_url' | 'error';
  videoId?: string;
  transcriptText?: string;
  message?: string;
  error?: string;
}

/**
 * Extract 11-character YouTube video ID from various URL formats.
 */
export function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If already 11-char alphanumeric ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

/**
 * Fetch and check YouTube transcript availability for a given video ID or URL.
 * Routes through the backend /notes/section/youtube-transcript endpoint to avoid CORS
 * and bypass rate-limiting while supporting auto-generated (kind: 'asr') and manual caption tracks.
 */
export async function fetchYouTubeTranscript(videoUrlOrId: string): Promise<YouTubeTranscriptResult> {
  console.log('[youtubeTranscript] Step 1: Extracting video ID from:', videoUrlOrId);
  const videoId = extractYouTubeId(videoUrlOrId);
  
  if (!videoId) {
    console.warn('[youtubeTranscript] Invalid YouTube URL or Video ID:', videoUrlOrId);
    return {
      status: 'invalid_url',
      message: 'Invalid YouTube URL or Video ID. Please provide a valid YouTube link.',
    };
  }

  console.log('[youtubeTranscript] Step 2: Extracted Video ID:', videoId);

  try {
    const endpointPath = `/notes/section/youtube-transcript?url=${encodeURIComponent(videoId)}`;
    console.log('[youtubeTranscript] Step 3: Calling backend transcript service at:', endpointPath);

    const res = await apiClient.get<YouTubeTranscriptResult>(endpointPath);
    const data = res.data;

    console.log('[youtubeTranscript] Step 4: Received backend response:', {
      status: data.status,
      videoId: data.videoId,
      message: data.message,
      hasTranscriptText: !!data.transcriptText,
      transcriptLength: data.transcriptText ? data.transcriptText.length : 0,
    });

    if (data.status === 'ready' && data.transcriptText) {
      console.log(`[youtubeTranscript] Step 5: SUCCESS - Retrieved ${data.transcriptText.length} characters of transcript text.`);
      return {
        status: 'ready',
        videoId,
        transcriptText: data.transcriptText,
      };
    } else if (data.status === 'no_transcript') {
      console.log('[youtubeTranscript] Step 5: NO TRANSCRIPT - Video has no manual or auto-generated captions.');
      return {
        status: 'no_transcript',
        videoId,
        message: data.message || 'This video does not have a transcript available, so notes cannot be generated.',
      };
    } else if (data.status === 'invalid_url') {
      console.warn('[youtubeTranscript] Step 5: INVALID URL returned from service');
      return {
        status: 'invalid_url',
        videoId,
        message: data.message || 'Invalid YouTube URL or Video ID.',
      };
    } else {
      console.warn('[youtubeTranscript] Step 5: ERROR - Backend returned error status:', data.message);
      return {
        status: 'error',
        videoId,
        message: data.message || 'Failed to verify transcript availability. Network error.',
        error: data.error,
      };
    }
  } catch (err: any) {
    console.error('[youtubeTranscript] Step 5: EXCEPTION during transcript endpoint call:', err);
    return {
      status: 'error',
      videoId,
      message: 'Failed to verify transcript availability. Network or server error.',
      error: err?.message || String(err),
    };
  }
}
