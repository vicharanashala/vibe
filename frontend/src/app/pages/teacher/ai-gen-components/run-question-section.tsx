import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionEditForm } from "./question-form";
import { aiSectionAPI } from "@/lib/genai-api";

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

export function RunQuestionSection({ aiJobId, run, acceptedRunId, onAccept, runIndex = 0 }: { aiJobId: string | null, run: TaskRun, acceptedRunId?: string, onAccept: () => void, runIndex?: number }) {
    const [showQuestions, setShowQuestions] = useState(false);
    const [questionsByRun, setQuestionsByRun] = useState<{ [runId: string]: any[] }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editQuestion, setEditQuestion] = useState<any>(null);

    // Clear cached questions when run.result or run.status changes (e.g., after refresh)
    useEffect(() => {
      setQuestionsByRun(prev => {
        if (prev[run.id]) {
          const newObj = { ...prev };
          delete newObj[run.id];
          return newObj;
        }
        return prev;
      });
    }, [run.result, run.status, run.id]);

    const questions = questionsByRun[run.id] || [];

    const handleShowQuestions = async () => {
      if (!aiJobId) return;
      if (!showQuestions && !questionsByRun[run.id]) {
        setLoading(true);
        setError("");
        try {
          // Fetch question generation status for this run
          const token = localStorage.getItem('firebase-auth-token');
          const url = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error('Failed to fetch task status');
          const arr = await res.json();
          // Use runIndex if available, else fallback to 0
          const idx = typeof runIndex === 'number' ? runIndex : 0;
          if (Array.isArray(arr) && arr.length > idx && arr[idx]?.fileUrl) {
            const questionsRes = await fetch(arr[idx].fileUrl);
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
            setQuestionsByRun(prev => ({ ...prev, [run.id]: questionsArr }));
          } else {
            setQuestionsByRun(prev => ({ ...prev, [run.id]: [] }));
            setError('Questions file URL not found.');
          }
        } catch (e: any) {
          setQuestionsByRun(prev => ({ ...prev, [run.id]: [] }));
          setError(e.message || 'Unknown error');
        } finally {
          setLoading(false);
        }
      }
      setShowQuestions(v => !v);
    };

    if (run.status !== 'done') {
      return <div className="flex items-center gap-2 text-blue-400"><Loader2 className="animate-spin" /> Generating questions...</div>;
    }

    const segmentIds = Array.from(new Set(questions.map((q: any) => q.segmentId).filter((sid: any) => typeof sid === 'number'))).sort((a, b) => a - b);

    return (
      <div className="space-y-2">
        <Button size="sm" variant="secondary" onClick={handleShowQuestions} className="w-full bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful">
          {showQuestions ? 'Hide Questions' : 'Show Questions'}
        </Button>
        {/* Export PDF Button: appears below Show Questions, opens print-friendly HTML in new tab */}
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 bg-background border-primary/30 text-primary hover:bg-primary/10 hover:border-primary font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 btn-beautiful"
          onClick={async () => {
            if (!aiJobId) return;
            try {
              // Fetch question generation status for this run
              const token = localStorage.getItem('firebase-auth-token');
              const url = getApiUrl(`/genai/${aiJobId}/tasks/QUESTION_GENERATION/status`);
              const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
              if (!res.ok) throw new Error('Failed to fetch task status');
              const arr = await res.json();
              const idx = typeof runIndex === 'number' ? runIndex : 0;
              if (Array.isArray(arr) && arr.length > idx && arr[idx]?.fileUrl) {
                // Fetch the JSON content
                const questionsRes = await fetch(arr[idx].fileUrl);
                if (!questionsRes.ok) throw new Error('Failed to fetch questions file');
                const data = await questionsRes.json();
                let questionsArr = [];
                if (Array.isArray(data)) {
                  questionsArr = data.filter((q: any) => typeof q === 'object' && q !== null && q.question);
                } else if (data.segments && Array.isArray(data.segments)) {
                  questionsArr = data.segments.flatMap((seg: any) => seg.questions || []);
                } else {
                  toast.error('Questions format not recognized.');
                  return;
                }
                if (!questionsArr.length) {
                  toast.error('No questions found to export.');
                  return;
                }
                // Build HTML with ViBe logo and gradient heading
                let html = `<html><head><title>ViBe</title><style>
                  body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; }
                  .vibe-header { text-align: center; margin-top: 24px; margin-bottom: 18px; }
                  .vibe-logo { width: 48px; height: 48px; border-radius: 10px; box-shadow: 0 2px 8px #0002; margin-bottom: 8px; background: #fff; border: 1.5px solid #c084fc; object-fit: contain; display: block; margin-left: auto; margin-right: auto; }
                  .vibe-title { font-size: 1.2em; font-weight: 600; letter-spacing: 0.5px; margin-top: 6px; }
                  .vibe-vibe {
                    font-weight: bold;
                    background: linear-gradient(90deg, #c084fc 0%, #fca4a6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    color: transparent;
                  }
                  @media print {
                    .vibe-vibe {
                      background: none !important;
                      -webkit-background-clip: initial !important;
                      -webkit-text-fill-color: initial !important;
                      background-clip: initial !important;
                      color: #c084fc !important;
                    }
                  }
                  .question-block { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; margin: 18px auto; padding: 18px 24px; max-width: 700px; }
                  .question-title { font-weight: bold; font-size: 1.1em; margin-bottom: 8px; }
                  .option { margin-left: 24px; margin-bottom: 2px; }
                  .option.correct { color: #218838; font-weight: bold; }
                  .option.incorrect { color: #c82333; }
                  .hint { margin-left: 24px; color: #0056b3; font-style: italic; margin-top: 4px; }
                  .answer-label { font-weight: bold; color: #218838; }
                </style></head><body>`;
                html += `<div class='vibe-header'>
                  <img src='/img/vibe_logo_img.ico' class='vibe-logo' alt='ViBe Logo' />
                  <div class='vibe-title'>Generated Questions with <span class='vibe-vibe'>ViBe</span></div>
                </div>`;
                questionsArr.forEach((q: any, i: number) => {
                  html += `<div class='question-block'><div class='question-title'>${i + 1}. ${q.question?.text || q.question || ''}</div>`;
                  // Gather options and mark correct/incorrect
                  let options: { text: string, correct: boolean }[] = [];
                  // For new format (solution.correctLotItem/correctLotItems/incorrectLotItems)
                  if (q.solution) {
                    if (Array.isArray(q.solution.correctLotItems)) {
                      options = options.concat(q.solution.correctLotItems.map((o: any) => ({ text: o.text, correct: true })));
                    }
                    if (q.solution.correctLotItem) {
                      options.push({ text: q.solution.correctLotItem.text, correct: true });
                    }
                    if (Array.isArray(q.solution.incorrectLotItems)) {
                      options = options.concat(q.solution.incorrectLotItems.map((o: any) => ({ text: o.text, correct: false })));
                    }
                  }
                  // Fallback to question.options if no solution
                  if ((!options.length) && (q.question?.options || q.options)) {
                    const opts = q.question?.options || q.options || [];
                    // Try to infer correct answer index/indices
                    let correctIndices: number[] = [];
                    if (typeof q.question?.correctAnswer === 'number') correctIndices = [q.question.correctAnswer];
                    else if (Array.isArray(q.question?.correctAnswer)) correctIndices = q.question.correctAnswer;
                    else if (typeof q.correctAnswer === 'number') correctIndices = [q.correctAnswer];
                    else if (Array.isArray(q.correctAnswer)) correctIndices = q.correctAnswer;
                    options = opts.map((text: string, idx: number) => ({ text, correct: correctIndices.includes(idx) }));
                  }
                  // Render options
                  if (options.length) {
                    options.forEach((opt, j) => {
                      html += `<div class='option ${opt.correct ? 'correct' : 'incorrect'}'>${String.fromCharCode(65 + j)}. ${opt.text}</div>`;
                    });
                  }
                  // Hint
                  if (q.question?.hint || q.hint) {
                    html += `<div class='hint'><b>Hint:</b> ${q.question?.hint || q.hint}</div>`;
                  }
                  html += `</div>`;
                });
                html += `</body></html>`;
                // Open new window and print
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => {
                    printWindow.print();
                  }, 500);
                }
              } else {
                toast.error('Questions file URL not found for this run.');
              }
            } catch (e: any) {
              toast.error(e.message || 'Failed to export PDF');
            }
          }}
        >
          Export PDF
        </Button>
        {showQuestions && (
          <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded max-h-96 overflow-y-auto text-sm border border-gray-300 dark:border-gray-700 mt-2">
            <strong>Questions:</strong>
            {loading && <div className="mt-2">Loading...</div>}
            {error && <div className="mt-2 text-red-600 dark:text-red-400">{error}</div>}
            {!loading && !error && questions.length > 0 && (
              <ol className="mt-2 space-y-4">
                {questions.map((q: any, idx: number) => {
                  const segIdx = segmentIds.findIndex((sid: any) => sid === q.segmentId);
                  const segStart = segIdx === 0 ? 0 : segmentIds[segIdx - 1];
                  const segEnd = q.segmentId;
                  return (
                    <li key={q.question?.text || idx} className="border-b border-gray-300 dark:border-gray-700 pb-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Segment: {typeof segStart === 'number' && typeof segEnd === 'number' ? `${segStart}–${segEnd}s` : 'N/A'} | Type: {q.questionType || q.question?.type || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold flex-1">Q{idx + 1}: {q.question?.text}</div>
                        <Button size="sm" variant="outline" onClick={() => { setEditingIdx(idx); setEditQuestion(JSON.parse(JSON.stringify(q))); setEditModalOpen(true); }}>
                          <Edit className="w-4 h-4" /> Edit
                        </Button>
                      </div>
                      {q.question?.hint && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hint: {q.question.hint}</div>}
                      {q.solution && (
                        <>
                          <div className="mt-1"><b>Options:</b></div>
                          <ul className="list-disc ml-6">
                            {q.solution.incorrectLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`inc-${oIdx}`} className="text-red-600 dark:text-red-300">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItems?.map((opt: any, oIdx: number) => (
                              <li key={`cor-${oIdx}`} className="text-green-600 dark:text-green-400 font-semibold">{opt.text}</li>
                            ))}
                            {q.solution.correctLotItem && (
                              <li className="text-green-600 dark:text-green-400 font-semibold">{q.solution.correctLotItem.text}</li>
                            )}
                          </ul>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!loading && !error && questions.length === 0 && <div className="mt-2">No questions found.</div>}
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
        {/* Edit Question Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>
            {editQuestion && (
              <QuestionEditForm
                question={editQuestion}
                onSave={async (edited) => {
                  if (!aiJobId || typeof aiSectionAPI.editQuestionData !== 'function') return;
                  try {
                    // Deep clone the original questions array
                    const originalQuestions = questionsByRun[run.id] || [];
                    const updatedQuestions = originalQuestions.map((q, idx) => {
                      if (idx !== editingIdx) return q;
                      return {
                        ...q,
                        question: {
                          ...q.question,
                          text: edited.text, // explicitly update text
                        },
                        solution: edited.solution, // replace solution entirely
                      };
                    });
                    await aiSectionAPI.editQuestionData(aiJobId, runIndex, updatedQuestions);
                    setEditingQuestion(null);
                    setEditModalOpen(false);
                  } catch (e) {
                    toast.error('Question Updated.');
                    setEditModalOpen(false);
                  }
                }}
                onCancel={() => setEditModalOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }