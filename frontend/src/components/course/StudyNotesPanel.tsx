import React, { useState, useEffect, useRef } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { studyNotesApi, SectionStudyNoteResponse, TranscriptInput } from '../../lib/api/studyNotesApi.js';
import { apiClient } from '../../lib/api-client.js';
import { fetchYouTubeTranscript } from '../../lib/youtubeTranscript.js';
import { StudyNotesViewer } from './StudyNotesViewer.js';
import { StudyNotesPdfDocument } from './StudyNotesPdfDocument.js';
import { Download, RefreshCw, FileText, AlertCircle, Loader2, Info } from 'lucide-react';

interface StudyNotesPanelProps {
  courseId?: string;
  courseVersionId: string;
  moduleId?: string;
  sectionId: string;
  sectionTitle: string;
  items?: any[];
  transcripts?: TranscriptInput[];
  isInstructor?: boolean;
}

export const StudyNotesPanel: React.FC<StudyNotesPanelProps> = ({
  courseId,
  courseVersionId,
  moduleId,
  sectionId,
  sectionTitle,
  items = [],
  transcripts = [],
  isInstructor = true,
}) => {
  const [noteData, setNoteData] = useState<SectionStudyNoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingTranscripts, setCheckingTranscripts] = useState<boolean>(false);
  const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'available' | 'no_transcript' | 'error'>('idle');
  const [transcriptMessage, setTranscriptMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[] | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to ensure valid video transcripts are resolved automatically
  const getEffectiveTranscripts = async (): Promise<{
    transcripts: TranscriptInput[];
    status: 'available' | 'no_transcript' | 'error' | 'empty';
    message?: string;
  }> => {
    // 1. If transcripts prop already has items with transcriptText, use them
    if (transcripts && transcripts.length > 0 && transcripts.some(t => t.transcriptText)) {
      return { transcripts, status: 'available' };
    }

    // 2. Extract from items array directly if available
    const videoItems = (items || []).filter((i: any) => i.type?.toUpperCase() === 'VIDEO');
    if (videoItems.length === 0) {
      return {
        transcripts: [],
        status: 'empty',
        message: 'No video items found in this section.',
      };
    }

    const resolved: TranscriptInput[] = [];
    let hasNoTranscriptVideo = false;
    let detectionErrorMsg: string | null = null;

    for (const item of videoItems) {
      let transcriptText = item.details?.transcript;
      let videoUrl = item.details?.URL || item.videoUrl || item.details?.url;

      if (!transcriptText && item._id && courseId && courseVersionId && moduleId && sectionId) {
        try {
          const res = await apiClient.get<any>(
            `/courses/${courseId}/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/item/${item._id}`
          );
          const fullItem = res.data?.item || res.data;
          transcriptText = fullItem?.details?.transcript;
          videoUrl = videoUrl || fullItem?.details?.URL || fullItem?.details?.url;
        } catch (err) {
          console.warn(`[StudyNotesPanel] Failed to fetch item details for ${item._id}:`, err);
        }
      }

      // If transcript text still missing, run client-side YouTube transcript fetcher
      if (!transcriptText && videoUrl) {
        const ytRes = await fetchYouTubeTranscript(videoUrl);
        if (ytRes.status === 'ready' && ytRes.transcriptText) {
          transcriptText = ytRes.transcriptText;
        } else if (ytRes.status === 'no_transcript') {
          hasNoTranscriptVideo = true;
        } else if (ytRes.status === 'error') {
          detectionErrorMsg = ytRes.message || 'Error fetching YouTube transcript';
        }
      }

      if (transcriptText) {
        resolved.push({
          videoId: item._id,
          videoTitle: item.name || 'Video',
          transcriptText,
        });
      }
    }

    if (resolved.length > 0) {
      return { transcripts: resolved, status: 'available' };
    } else if (hasNoTranscriptVideo) {
      return {
        transcripts: [],
        status: 'no_transcript',
        message: 'This video does not have a transcript available, so notes cannot be generated.',
      };
    } else if (detectionErrorMsg) {
      return {
        transcripts: [],
        status: 'error',
        message: detectionErrorMsg,
      };
    }

    return {
      transcripts: [],
      status: 'no_transcript',
      message: 'This video does not have a transcript available, so notes cannot be generated.',
    };
  };

  // Stop polling helper
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Fetch current section study note
  const fetchNote = async () => {
    try {
      const data = await studyNotesApi.getNotes(courseVersionId, sectionId);
      setNoteData(data);
      setError(null);

      // If status is ready or error, stop polling
      if (data.status === 'ready' || data.status === 'error') {
        stopPolling();
      }
    } catch (err: any) {
      // Note may not exist yet
      if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        setNoteData(null);
      } else {
        setError(err?.message || 'Failed to load study notes');
      }
      stopPolling();
    } finally {
      setLoading(false);
    }
  };

  // Run automatic transcript detection and notes sync on mount or items change
  const checkTranscriptsAndSync = async () => {
    setCheckingTranscripts(true);
    setTranscriptMessage(null);
    try {
      const res = await getEffectiveTranscripts();
      if (res.status === 'available' && res.transcripts.length > 0) {
        setTranscriptStatus('available');
        // Auto-generate if no note exists yet
        if (!noteData && isInstructor) {
          handleGenerateWithTranscripts(res.transcripts);
        }
      } else if (res.status === 'no_transcript') {
        setTranscriptStatus('no_transcript');
        setTranscriptMessage(res.message || 'This video does not have a transcript available, so notes cannot be generated.');
      } else if (res.status === 'error') {
        setTranscriptStatus('error');
        setTranscriptMessage(res.message || 'Failed to check transcript availability.');
      } else {
        setTranscriptStatus('idle');
      }
    } catch (err: any) {
      setTranscriptStatus('error');
      setTranscriptMessage(err?.message || 'Transcript check failed.');
    } finally {
      setCheckingTranscripts(false);
    }
  };

  // Setup initial load and polling when pending
  useEffect(() => {
    setLoading(true);
    fetchNote().then(() => {
      checkTranscriptsAndSync();
    });

    return () => {
      stopPolling();
    };
  }, [courseVersionId, sectionId, items?.length]);

  // Handle status polling state machine
  useEffect(() => {
    if (noteData?.status === 'pending' && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        fetchNote();
      }, 3000);
    } else if (noteData?.status !== 'pending') {
      stopPolling();
    }
  }, [noteData?.status]);

  // Handle trigger with pre-resolved transcripts
  const handleGenerateWithTranscripts = async (resolvedTranscripts?: TranscriptInput[]) => {
    try {
      setLoading(true);
      setError(null);
      setValidationErrors(null);

      const effectiveResult = resolvedTranscripts && resolvedTranscripts.length > 0
        ? { transcripts: resolvedTranscripts, status: 'available' as const }
        : await getEffectiveTranscripts();

      if (effectiveResult.status === 'no_transcript') {
        setTranscriptStatus('no_transcript');
        setTranscriptMessage(effectiveResult.message || 'This video does not have a transcript available, so notes cannot be generated.');
        setLoading(false);
        return;
      }

      if (!effectiveResult.transcripts || effectiveResult.transcripts.length === 0) {
        setTranscriptStatus('no_transcript');
        setTranscriptMessage('This video does not have a transcript available, so notes cannot be generated.');
        setLoading(false);
        return;
      }

      await studyNotesApi.generateNotes({
        courseVersionId,
        sectionId,
        sectionTitle,
        transcripts: effectiveResult.transcripts,
      });

      // Optimistically update status to pending and start polling
      setNoteData({
        courseVersionId,
        sectionId,
        sectionTitle,
        generatedAt: new Date().toISOString(),
        status: 'pending',
      });
    } catch (err: any) {
      console.error('[StudyNotesPanel] Error triggering notes generation:', err);
      setError(err?.message || 'Failed to trigger notes generation');
      if (err?.errors) {
        setValidationErrors(err.errors);
      }
      setLoading(false);
    }
  };

  const handleGenerate = () => handleGenerateWithTranscripts();
  const handleRegenerate = () => handleGenerateWithTranscripts();

  // Checking transcript state
  if (checkingTranscripts) {
    return (
      <div className="flex items-center justify-center p-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-3" />
        <span className="text-slate-600 dark:text-slate-400 font-medium">Checking YouTube video transcript availability...</span>
      </div>
    );
  }

  if (loading && !noteData) {
    return (
      <div className="flex items-center justify-center p-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-3" />
        <span className="text-slate-600 dark:text-slate-400 font-medium">Checking section study notes...</span>
      </div>
    );
  }

  // Pending State: Polling in progress
  if (noteData?.status === 'pending') {
    return (
      <div className="p-8 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-center">
        <div className="inline-flex p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 mb-4">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          Generating Instructor Study Notes...
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          AI is analyzing transcript(s) for "{sectionTitle}", removing fluff, and crafting structured revision notes.
          This page will automatically update once ready.
        </p>
      </div>
    );
  }

  // Explicit No Transcript State (Non-retryable)
  if (transcriptStatus === 'no_transcript' && (!noteData || !noteData.contentMarkdown)) {
    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
        <div className="flex items-start space-x-3">
          <Info className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-base font-semibold text-amber-900 dark:text-amber-200">Transcript Unavailable</h4>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {transcriptMessage || 'This video does not have a transcript available, so notes cannot be generated.'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 italic">
              Note: Notes generation requires video captions or transcripts. Retrying will not work unless captions are enabled for the YouTube video.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (noteData?.status === 'error' || error || transcriptStatus === 'error') {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-base font-semibold text-red-900 dark:text-red-200">Notes Generation Failed</h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {noteData?.errorMessage || error || transcriptMessage || 'An unexpected error occurred while generating notes.'}
            </p>
            {validationErrors && validationErrors.length > 0 && (
              <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/40 rounded text-xs font-mono text-red-800 dark:text-red-200 space-y-1">
                <div className="font-semibold text-red-900 dark:text-red-100">Validation Details:</div>
                {validationErrors.map((ve: any, idx: number) => (
                  <div key={idx}>
                    • Field <code className="font-bold">{ve.property}</code>:{' '}
                    {ve.constraints ? Object.values(ve.constraints).join(', ') : 'Invalid value'}
                  </div>
                ))}
              </div>
            )}
            {isInstructor && (
              <button
                onClick={transcriptStatus === 'error' ? checkTranscriptsAndSync : handleRegenerate}
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {transcriptStatus === 'error' ? 'Retry Transcript Check' : 'Retry Generation'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Not Found State (No notes generated yet)
  if (!noteData || !noteData.contentMarkdown) {
    return (
      <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center">
        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Study Notes Generated Yet</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
          Convert all video transcripts in section "{sectionTitle}" into structured instructor notes.
        </p>
        {isInstructor ? (
          <button
            onClick={handleGenerate}
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all hover:scale-105"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Section Study Notes
          </button>
        ) : (
          <p className="text-xs text-slate-500 italic">Instructor has not generated study notes for this section yet.</p>
        )}
      </div>
    );
  }

  // Ready State: Render notes & PDF Download link
  return (
    <div className="space-y-6">
      {/* Header bar with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{sectionTitle} — Study Notes</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generated on {new Date(noteData.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isInstructor && (
            <button
              onClick={handleRegenerate}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Regenerate
            </button>
          )}

          {/* Client-side PDF Download using @react-pdf/renderer */}
          <PDFDownloadLink
            document={
              <StudyNotesPdfDocument
                title={noteData.sectionTitle || sectionTitle}
                markdownContent={noteData.contentMarkdown}
              />
            }
            fileName={`${(sectionTitle || 'section-notes').toLowerCase().replace(/\s+/g, '-')}-notes.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <button
                disabled={pdfLoading}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {pdfLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Preparing PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download PDF
                  </>
                )}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Main Markdown Content View */}
      <div className="p-6 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <StudyNotesViewer markdownContent={noteData.contentMarkdown} />
      </div>
    </div>
  );
};
