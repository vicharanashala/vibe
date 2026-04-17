import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { aiSectionAPI } from "@/lib/genai-api";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed";
  result?: any;
  parameters?: Record<string, unknown>;
}

function getApiUrl(path: string) {
  return `${import.meta.env.VITE_BASE_URL}${path}`;
}

export function RunTranscriptSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showTranscript, setShowTranscript] = useState(false);
    const [transcript, setTranscript] = useState<string>("");
    const [transcriptChunks, setTranscriptChunks] = useState<{ text: string }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editChunks, setEditChunks] = useState<{ timestamp: [number, number]; text: string }[]>([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    const handleShowTranscript = async () => {
      if (!aiJobId) return;
      if (!showTranscript) {
        setLoading(true);
        setError("");
        try {
          // Fetch transcript status as before
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/TRANSCRIPT_GENERATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > runIndex && arr[runIndex].fileUrl) {
            const transcriptRes = await fetch(arr[runIndex].fileUrl);
            if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
            const data = await transcriptRes.json();
            if (Array.isArray(data.chunks)) {
              setTranscriptChunks(data.chunks);
              setTranscript(data.chunks.map((chunk: { text: string }) => chunk.text).join(' '));
            } else {
              setTranscriptChunks(null);
              setTranscript(typeof data === 'string' ? data : JSON.stringify(data));
            }
          } else {
            setTranscriptChunks(null);
            setTranscript('Transcript file URL not found.');
          }
        } catch (e: any) {
          setTranscriptChunks(null);
          setTranscript(e.message || 'Unknown error');
        } finally {
          setLoading(false);
        }
      }
      setShowTranscript(v => !v);
    };

    // Fetch transcript chunks when modal opens
    useEffect(() => {
      if (editModalOpen && aiJobId) {
        setEditLoading(true);
        setEditError('');
        (async () => {
          try {
            const token = localStorage.getItem('firebase-auth-token');
            const url = getApiUrl(`/genai/${aiJobId}/tasks/TRANSCRIPT_GENERATION/status`);
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to fetch task status');
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > runIndex && arr[runIndex].fileUrl) {
              const transcriptRes = await fetch(arr[runIndex].fileUrl);
              if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
              const data = await transcriptRes.json();
              if (Array.isArray(data.chunks)) {
                setEditChunks(data.chunks.map((chunk: any) => ({ ...chunk })));
              } else {
                setEditError('Transcript format not recognized.');
              }
            } else {
              setEditError('Transcript file URL not found.');
            }
          } catch (e: any) {
            setEditError(e.message || 'Unknown error');
          } finally {
            setEditLoading(false);
          }
        })();
      }
    }, [editModalOpen, aiJobId, runIndex]);

    // Handler for saving edited transcript
    const handleSaveEditTranscript = async () => {
      if (!aiJobId) return;
      try {
        setEditLoading(true);
        setEditError('');
        if (typeof aiSectionAPI.editTranscriptData === 'function') {
          await aiSectionAPI.editTranscriptData(aiJobId, runIndex, { chunks: editChunks });
          toast.success('Transcript updated successfully!');
          setEditModalOpen(false);
        } else {
          setEditError('Transcript editing API not available.');
        }
      } catch (e: any) {
        setEditError(e.message || 'Failed to update transcript');
      } finally {
        setEditLoading(false);
      }
    };

    return (
      <div className="space-y-2">
        <Button size="sm" variant="secondary" onClick={handleShowTranscript} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </Button>
        {/* Edit button for transcript run */}
        <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          Edit
        </Button>
        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Transcript</DialogTitle>
            </DialogHeader>
            {editLoading && <div>Loading transcript...</div>}
            {editError && <div className="text-red-500">{editError}</div>}
            {!editLoading && !editError && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {editChunks.map((chunk, idx) => (
                  <div key={idx} className="flex flex-col gap-1 border-b pb-2">
                    <div className="text-xs text-gray-400">
                      Segment: {chunk.timestamp[0]}s - {chunk.timestamp[1]}s
                    </div>
                    <textarea
                      className="w-full p-2 rounded border"
                      value={chunk.text}
                      onChange={e => {
                        const newChunks = [...editChunks];
                        newChunks[idx].text = e.target.value;
                        setEditChunks(newChunks);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEditTranscript} disabled={editLoading}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {showTranscript && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-48 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700">
            <strong>Transcript:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && (
              <div className="mt-2 whitespace-pre-line">
                {transcriptChunks
                  ? transcriptChunks.map((chunk: { text: string }) => chunk.text).join(' ')
                  : transcript}
              </div>
            )}
          </div>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="w-full"
          >
            Accept This Run
          </Button>
        )}
      </div>
    );
  }