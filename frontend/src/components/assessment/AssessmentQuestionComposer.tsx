import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';
import { createAssessmentQuestion } from '@/utils/assessmentQuestions';

interface AssessmentQuestionComposerProps {
  value: AssessmentQuestion;
  onChange: (next: AssessmentQuestion) => void;
}

const questionTypes: AssessmentQuestionType[] = [
  'MCQ',
  'MULTIPLE_RESPONSE',
  'DRAG_AND_DROP',
  'MATRIX_YES_NO',
  'DROPDOWN_BLANK',
];

const TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  MCQ: 'MCQ (Single Answer)',
  TRUE_FALSE: 'True / False',
  MULTIPLE_RESPONSE: 'Multiple Response (Checkbox)',
  DRAG_AND_DROP: 'Drag & Drop (Match)',
  MATRIX_YES_NO: 'Matrix Yes/No',
  DROPDOWN_BLANK: 'Dropdown Fill-in-the-Blanks',
};

export function AssessmentQuestionComposer({ value, onChange }: AssessmentQuestionComposerProps) {
  const [draft, setDraft] = useState<AssessmentQuestion>(value);

  useEffect(() => { setDraft(value); }, [value]);

  const emit = (next: AssessmentQuestion) => { setDraft(next); onChange(next); };

  const updateType = (type: AssessmentQuestionType) => {
    const next = createAssessmentQuestion(type);
    next.id = draft.id;
    next.questionText = draft.questionText || next.questionText;
    emit(next);
  };

  const options = useMemo(() => draft.content.options ?? [], [draft.content.options]);
  const items = useMemo(() => draft.content.items ?? draft.content.dragItems ?? [], [draft.content.items, draft.content.dragItems]);
  const statements = useMemo(() => draft.content.statements ?? [], [draft.content.statements]);
  const targets = useMemo(() => draft.content.targets ?? {}, [draft.content.targets]);
  const correctAnswers = useMemo(() => draft.content.correctAnswers ?? [], [draft.content.correctAnswers]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/70 p-4 shadow-sm">
      {/* Type selector */}
      <div className="grid gap-2">
        <Label>Question Type</Label>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={draft.type}
          onChange={e => updateType(e.target.value as AssessmentQuestionType)}
        >
          {questionTypes.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Question text */}
      <div className="grid gap-2">
        <Label>
          {draft.type === 'DROPDOWN_BLANK'
            ? 'Sentence (use {{blank_1}}, {{blank_2}} … for blanks)'
            : 'Question Text'}
        </Label>
        <Textarea
          value={draft.questionText}
          onChange={e => {
            const text = e.target.value;
            emit({
              ...draft,
              questionText: text,
              content: draft.type === 'DROPDOWN_BLANK'
                ? { ...draft.content, sentence: text }
                : draft.content,
            });
          }}
          placeholder={
            draft.type === 'DROPDOWN_BLANK'
              ? 'e.g. The capital of France is {{blank_1}}.'
              : 'Prompt for the learner'
          }
        />
      </div>

      {/* ── MCQ / Multiple Response ── */}
      {(draft.type === 'MCQ' || draft.type === 'MULTIPLE_RESPONSE') && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Options {draft.type === 'MCQ' ? '(select one correct)' : '(check all correct)'}</Label>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => emit({
                ...draft,
                content: { ...draft.content, options: [...options, `Option ${options.length + 1}`] },
              })}
            >
              <Plus className="mr-1 h-3 w-3" /> Add option
            </Button>
          </div>
          {options.map((opt, idx) => {
            const isCorrect = draft.type === 'MCQ'
              ? correctAnswers[0] === idx
              : correctAnswers.includes(idx);
            return (
              <div key={`${draft.id}-opt-${idx}`} className="flex items-center gap-2">
                <input
                  type={draft.type === 'MCQ' ? 'radio' : 'checkbox'}
                  checked={isCorrect}
                  onChange={() => {
                    const next = draft.type === 'MCQ'
                      ? [idx]
                      : isCorrect
                        ? correctAnswers.filter(v => v !== idx)
                        : [...correctAnswers, idx];
                    emit({ ...draft, content: { ...draft.content, correctAnswers: next } });
                  }}
                  className="h-4 w-4 accent-primary"
                  title="Mark as correct"
                />
                <Input
                  value={opt}
                  onChange={e => {
                    const next = [...options];
                    next[idx] = e.target.value;
                    emit({ ...draft, content: { ...draft.content, options: next } });
                  }}
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => {
                    const nextOpts = options.filter((_, i) => i !== idx);
                    const nextCorrect = correctAnswers
                      .filter(v => v !== idx)
                      .map(v => (typeof v === 'number' && v > idx ? v - 1 : v));
                    emit({ ...draft, content: { ...draft.content, options: nextOpts, correctAnswers: nextCorrect } });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drag & Drop ── */}
      {draft.type === 'DRAG_AND_DROP' && (
        <div className="grid gap-3">
          <Label>Items → Targets (each item maps to a target label)</Label>
          {items.map((item, idx) => (
            <div key={`${draft.id}-dnd-${idx}`} className="flex items-center gap-2">
              <Input
                placeholder={`Item ${idx + 1}`}
                value={item}
                onChange={e => {
                  const nextItems = [...items];
                  const oldKey = nextItems[idx];
                  nextItems[idx] = e.target.value;
                  const nextTargets = { ...targets };
                  if (oldKey in nextTargets) {
                    nextTargets[e.target.value] = nextTargets[oldKey];
                    delete nextTargets[oldKey];
                  }
                  emit({ ...draft, content: { ...draft.content, items: nextItems, dragItems: nextItems, targets: nextTargets } });
                }}
              />
              <span className="text-muted-foreground text-sm shrink-0">→</span>
              <Input
                placeholder="Target label"
                value={targets[item] ?? ''}
                onChange={e => {
                  emit({ ...draft, content: { ...draft.content, targets: { ...targets, [item]: e.target.value } } });
                }}
              />
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => {
                  const nextItems = items.filter((_, i) => i !== idx);
                  const nextTargets = { ...targets };
                  delete nextTargets[item];
                  emit({ ...draft, content: { ...draft.content, items: nextItems, dragItems: nextItems, targets: nextTargets } });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              const label = `Item ${items.length + 1}`;
              emit({ ...draft, content: { ...draft.content, items: [...items, label], dragItems: [...items, label], targets: { ...targets, [label]: '' } } });
            }}
          >
            <Plus className="mr-1 h-3 w-3" /> Add item
          </Button>
        </div>
      )}

      {/* ── Matrix Yes/No ── */}
      {draft.type === 'MATRIX_YES_NO' && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Statements (toggle correct answer: Yes / No)</Label>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => emit({
                ...draft,
                content: {
                  ...draft.content,
                  statements: [...statements, `Statement ${statements.length + 1}`],
                  correctAnswers: [...correctAnswers, true],
                },
              })}
            >
              <Plus className="mr-1 h-3 w-3" /> Add statement
            </Button>
          </div>
          {statements.map((stmt, idx) => (
            <div key={`${draft.id}-matrix-${idx}`} className="flex items-center gap-2">
              <Input
                value={stmt}
                onChange={e => {
                  const next = [...statements];
                  next[idx] = e.target.value;
                  emit({ ...draft, content: { ...draft.content, statements: next } });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = [...correctAnswers];
                  next[idx] = !next[idx];
                  emit({ ...draft, content: { ...draft.content, correctAnswers: next } });
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  correctAnswers[idx]
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-red-100 text-red-700 border-red-300'
                }`}
              >
                {correctAnswers[idx] ? 'Yes' : 'No'}
              </button>
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => {
                  emit({
                    ...draft,
                    content: {
                      ...draft.content,
                      statements: statements.filter((_, i) => i !== idx),
                      correctAnswers: correctAnswers.filter((_, i) => i !== idx),
                    },
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Dropdown Fill-in-the-Blanks ── */}
      {draft.type === 'DROPDOWN_BLANK' && (
        <div className="grid gap-3">
          <Label className="text-sm text-muted-foreground">
            Blanks detected from sentence: {
              [...(draft.questionText.matchAll(/\{\{([^}]+)\}\}/g))].map(m => m[1]).join(', ') || 'none'
            }
          </Label>
          {Object.entries(draft.content.dropdownOptions ?? {}).map(([blankKey, opts]) => (
            <div key={blankKey} className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-sm font-medium text-foreground">{`{{${blankKey}}}`}</div>
              {opts.map((opt, optIdx) => (
                <div key={`${blankKey}-${optIdx}`} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={e => {
                      const next = [...opts];
                      next[optIdx] = e.target.value;
                      emit({ ...draft, content: { ...draft.content, dropdownOptions: { ...draft.content.dropdownOptions, [blankKey]: next } } });
                    }}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => {
                      const next = opts.filter((_, i) => i !== optIdx);
                      emit({ ...draft, content: { ...draft.content, dropdownOptions: { ...draft.content.dropdownOptions, [blankKey]: next } } });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => {
                  emit({ ...draft, content: { ...draft.content, dropdownOptions: { ...draft.content.dropdownOptions, [blankKey]: [...opts, `Option ${opts.length + 1}`] } } });
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> Add option
              </Button>
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              const blanks = [...(draft.questionText.matchAll(/\{\{([^}]+)\}\}/g))].map(m => m[1]);
              const existing = Object.keys(draft.content.dropdownOptions ?? {});
              const nextKey = blanks.find(b => !existing.includes(b)) ?? `blank_${existing.length + 1}`;
              emit({ ...draft, content: { ...draft.content, dropdownOptions: { ...(draft.content.dropdownOptions ?? {}), [nextKey]: ['Option 1'] } } });
            }}
          >
            <Plus className="mr-1 h-3 w-3" /> Add blank options
          </Button>
        </div>
      )}
    </div>
  );
}
