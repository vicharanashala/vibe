import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TaskRun {
  id: string;
  timestamp: Date;
  status: "loading" | "done" | "failed";
  result?: any;
  parameters?: Record<string, unknown>;
}

function getApiUrl(path: string) {
  return `https://vibe-backend-staging-239934307367.asia-south1.run.app/api${path}`;
}

// Helper to fetch segmentation file from fileUrl
const fetchSegmentationFromUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch segmentation file');
  const data = await response.json();
  // Assume data.segments or data.chunks or similar
  if (Array.isArray(data.segments)) {
    return data.segments;
  }
  if (Array.isArray(data.chunks)) {
    // fallback for chunked format
    return data.chunks;
  }
  return data;
};

// Add this function at the top-level (inside the component, before RunSegmentationSection):
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

export function RunSegmentationSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showSegmentation, setShowSegmentation] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [segmentationMap, setSegmentationMap] = useState<number[] | null>(null);
    const [segmentationChunks, setSegmentationChunks] = useState<any[][] | null>(null); // array of arrays of transcript chunks per segment
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Edit modal state for segment boundaries
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSegMap, setEditSegMap] = useState<number[]>([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");
    // Add state for transcriptChunks in the edit modal
    const [editTranscriptChunks, setEditTranscriptChunks] = useState<{ timestamp: [number, number], text: string }[]>([]);

    const handleShowSegmentation = async () => {
      if (!aiJobId) return;
      if (!showSegmentation) {
        setLoading(true);
        setError("");
        try {
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/SEGMENTATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          // Use the correct run index for this run, just like transcript section
          const segArrIdx = typeof runIndex === 'number' ? runIndex : 0;
          const segData = Array.isArray(arr) && arr.length > segArrIdx ? arr[segArrIdx] : arr[0];
          if (segData && segData.segmentationMap && Array.isArray(segData.segmentationMap) && segData.transcriptFileUrl) {
            setSegmentationMap(segData.segmentationMap);
            // Fetch transcript JSON
            const transcriptRes = await fetch(segData.transcriptFileUrl);
            if (!transcriptRes.ok) throw new Error('Failed to fetch transcript file');
            const transcriptData = await transcriptRes.json();
            const chunks = Array.isArray(transcriptData.chunks) ? transcriptData.chunks : [];
            // Group transcript chunks by segment
            const segMap = segData.segmentationMap;
            const grouped: any[][] = [];
            let segStart = 0;
            for (let i = 0; i < segMap.length; ++i) {
              const segEnd = segMap[i];
              // Chunks whose timestamp[0] >= segStart and < segEnd
              const segChunks = chunks.filter((chunk: { timestamp: [number, number], text: string }) =>
                chunk.timestamp &&
                typeof chunk.timestamp[0] === 'number' &&
                chunk.timestamp[0] >= segStart &&
                chunk.timestamp[0] < segEnd
              );
              grouped.push(segChunks);
              segStart = segEnd;
            }
            setSegmentationChunks(grouped);
          } else if (segData && segData.fileUrl) {
            // fallback: fetch segments from fileUrl as before
            const segs = await fetchSegmentationFromUrl(segData.fileUrl);
            setSegments(segs);
            setSegmentationMap(null);
            setSegmentationChunks(null);
          } else {
            setError('Segmentation data not found.');
            setSegmentationChunks(null);
          }
        } catch (e: any) {
          setError(e.message || 'Unknown error');
          setSegmentationChunks(null);
        } finally {
          setLoading(false);
        }
      }
      setShowSegmentation(v => !v);
    };

    // Edit modal logic
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
    const handleSaveEditSeg = async () => {
      if (!aiJobId) return;
      setEditLoading(true);
      setEditError("");
      try {
        // Use index 0 for the backend (fixes 500 error)
        await editSegmentMap(aiJobId, editSegMap, 0);
        toast.success('Segment map updated successfully!');
        setEditModalOpen(false);
      } catch (e: any) {
        setEditError(e.message || 'Failed to update segment map');
      } finally {
        setEditLoading(false);
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShowSegmentation}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            {showSegmentation ? 'Hide Segmentation' : 'Show Segmentation'}
          </Button>
          {/* Edit button for segmentation run */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
            disabled={run.status !== 'done'}
          >
            Edit
          </Button>
        </div>
        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Segments</DialogTitle>
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
        {showSegmentation && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700 mt-2">
            <strong>Segments:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {/* Enhanced display: segmentationMap + transcript chunks */}
            {!loading && !error && segmentationMap && segmentationMap.length > 0 && segmentationChunks && (
              <ol className="mt-2 space-y-4">
                {segmentationMap.map((end, idx) => {
                  const start = idx === 0 ? 0 : segmentationMap[idx - 1];
                  const segChunks = segmentationChunks[idx] || [];
                  return (
                    <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-2">
                      <div><b>Segment {idx + 1}:</b> {start.toFixed(2)}s – {end.toFixed(2)}s</div>
                      {segChunks.length > 0 ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {(segChunks as { text: string }[]).map((chunk: { text: string }) => chunk.text).join(' ')}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
            {/* Fallback: old display if no segmentationMap+chunks */}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0 || !segmentationChunks) && segments.length > 0 && (
              <ol className="mt-2 space-y-2">
                {segments.map((seg, idx) => (
                  <li key={idx} className="border-b border-gray-300 dark:border-gray-700 pb-1">
                    <div><b>Segment {idx + 1}</b> ({seg.startTime ?? seg.timestamp?.[0]}s - {seg.endTime ?? seg.timestamp?.[1]}s)</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">{seg.text}</div>
                  </li>
                ))}
              </ol>
            )}
            {!loading && !error && (!segmentationMap || segmentationMap.length === 0) && segments.length === 0 && <div className="mt-2">No segments found.</div>}
          </div>
        )}
        {run.status === 'done' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditModal}
            className="w-full mt-2 bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          >
            Edit Segments
          </Button>
        )}
        {acceptedRunId !== run.id && (
          <Button
            size="sm"
            onClick={onAccept}
            className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          >
            Accept This Run
          </Button>
        )}
      </div>
    );
  }