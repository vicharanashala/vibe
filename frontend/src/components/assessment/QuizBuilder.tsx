/**
 * QuizBuilder — Teacher Portal
 *
 * Allows teachers to compose questions of all five types and preview them.
 * The saved JSON matches the unified schema required by the AI service.
 */
import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Save, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { AssessmentQuestionComposer } from '@/components/assessment/AssessmentQuestionComposer';
import { AssessmentQuestionRenderer } from '@/components/assessment/AssessmentQuestionRenderer';
import { createAssessmentQuestion } from '@/utils/assessmentQuestions';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';

const TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'True/False',
  MULTIPLE_RESPONSE: 'Multi-Response',
  DRAG_AND_DROP: 'Drag & Drop',
  MATRIX_YES_NO: 'Matrix Yes/No',
  DROPDOWN_BLANK: 'Dropdown Blank',
};

const TYPE_COLORS: Record<AssessmentQuestionType, string> = {
  MCQ: 'bg-blue-100 text-blue-700 border-blue-200',
  TRUE_FALSE: 'bg-slate-100 text-slate-700 border-slate-200',
  MULTIPLE_RESPONSE: 'bg-purple-100 text-purple-700 border-purple-200',
  DRAG_AND_DROP: 'bg-orange-100 text-orange-700 border-orange-200',
  MATRIX_YES_NO: 'bg-teal-100 text-teal-700 border-teal-200',
  DROPDOWN_BLANK: 'bg-pink-100 text-pink-700 border-pink-200',
};

interface QuizBuilderProps {
  /** Called when teacher saves the question set */
  onSave?: (questions: AssessmentQuestion[]) => void;
  /** Pre-populate with AI-generated questions */
  initialQuestions?: AssessmentQuestion[];
}

export function QuizBuilder({ onSave, initialQuestions = [] }: QuizBuilderProps) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(
    initialQuestions.length > 0 ? initialQuestions : [createAssessmentQuestion('MCQ')]
  );
  const [activeId, setActiveId] = useState<string>(questions[0]?.id ?? '');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const activeQuestion = questions.find(q => q.id === activeId) ?? questions[0];

  const addQuestion = (type: AssessmentQuestionType) => {
    const q = createAssessmentQuestion(type);
    setQuestions(prev => [...prev, q]);
    setActiveId(q.id);
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => {
      const next = prev.filter(q => q.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? '');
      return next;
    });
  };

  const updateQuestion = (updated: AssessmentQuestion) => {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
  };

  const handleSave = () => {
    onSave?.(questions);
    toast.success(`Saved ${questions.length} question${questions.length !== 1 ? 's' : ''}`);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(questions, null, 2));
    toast.success('JSON copied to clipboard');
  };

  return (
    <div className="flex h-full gap-4">
      {/* ── Left: Question list + add buttons ── */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Questions ({questions.length})</span>
          <Button variant="ghost" size="icon" onClick={handleCopyJSON} title="Copy JSON">
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 rounded-lg border border-border">
          <div className="p-2 space-y-1">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => { setActiveId(q.id); setPreviewId(null); }}
                className={`group flex items-center justify-between rounded-md px-2 py-2 cursor-pointer text-sm transition-colors ${
                  activeId === q.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent/40'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-xs text-muted-foreground w-5">{idx + 1}.</span>
                  <div className="min-w-0">
                    <Badge className={`text-[10px] px-1.5 py-0 border ${TYPE_COLORS[q.type]}`}>
                      {TYPE_LABELS[q.type]}
                    </Badge>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[120px]">
                      {q.questionText || 'Untitled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-6 w-6"
                    onClick={e => { e.stopPropagation(); setPreviewId(previewId === q.id ? null : q.id); }}
                    title="Preview"
                  >
                    {previewId === q.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={e => { e.stopPropagation(); removeQuestion(q.id); }}
                    title="Delete"
                    disabled={questions.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add question type buttons */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium px-1">Add question</p>
          {(Object.keys(TYPE_LABELS) as AssessmentQuestionType[])
            .filter(t => t !== 'TRUE_FALSE')
            .map(type => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-7"
                onClick={() => addQuestion(type)}
              >
                <Plus className="mr-1.5 h-3 w-3" />
                {TYPE_LABELS[type]}
              </Button>
            ))}
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Save Quiz
        </Button>
      </div>

      {/* ── Right: Composer or Preview ── */}
      <div className="flex-1 min-w-0">
        {previewId ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Preview
                <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>
                  <EyeOff className="mr-1 h-3 w-3" /> Close preview
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const q = questions.find(x => x.id === previewId);
                if (!q) return null;
                return (
                  <AssessmentQuestionRenderer
                    question={q}
                    answer={answers[q.id]}
                    onAnswerChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                  />
                );
              })()}
            </CardContent>
          </Card>
        ) : activeQuestion ? (
          <AssessmentQuestionComposer
            key={activeQuestion.id}
            value={activeQuestion}
            onChange={updateQuestion}
          />
        ) : null}
      </div>
    </div>
  );
}

export default QuizBuilder;
