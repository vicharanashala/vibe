import { useState, useEffect } from 'react';
import { Grip, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';

interface RendererProps {
  question: AssessmentQuestion;
  answer?: unknown;
  onAnswerChange?: (value: unknown) => void;
}

// ── MCQ ──────────────────────────────────────────────────────────────────────
function McqRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const selected = answer as number | undefined;
  return (
    <RadioGroup value={selected?.toString()} onValueChange={v => onAnswerChange?.(Number(v))}>
      {question.content.options?.map((opt, idx) => (
        <label key={`${question.id}-${idx}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-accent/30">
          <RadioGroupItem value={idx.toString()} id={`${question.id}-${idx}`} />
          <span>{opt}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

// ── Multiple Response ─────────────────────────────────────────────────────────
function MultipleResponseRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const selection = (answer as number[] | undefined) ?? [];
  const toggle = (idx: number) => {
    const next = selection.includes(idx) ? selection.filter(i => i !== idx) : [...selection, idx];
    onAnswerChange?.(next);
  };
  return (
    <div className="grid gap-2">
      {question.content.options?.map((opt, idx) => (
        <label key={`${question.id}-${idx}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-accent/30">
          <Checkbox checked={selection.includes(idx)} onCheckedChange={() => toggle(idx)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function DragAndDropRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const sourceItems = question.content.items ?? question.content.dragItems ?? [];
  const [order, setOrder] = useState<string[]>(() =>
    Array.isArray(answer) && (answer as string[]).length > 0
      ? (answer as string[])
      : [...sourceItems]
  );
  const [dragging, setDragging] = useState<number | null>(null);

  // Re-sync when source items change (e.g. after editing in composer)
  useEffect(() => {
    setOrder(prev => {
      const updated = sourceItems.filter(i => prev.includes(i));
      const added = sourceItems.filter(i => !prev.includes(i));
      return [...updated, ...added];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.content.items, question.content.dragItems]);

  const move = (from: number, to: number) => {
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    onAnswerChange?.(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {order.map((item, idx) => (
        <div
          key={`${question.id}-${item}-${idx}`}
          draggable
          onDragStart={() => setDragging(idx)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (dragging !== null && dragging !== idx) move(dragging, idx); setDragging(null); }}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm bg-background cursor-grab active:cursor-grabbing"
        >
          <span className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-muted-foreground" />
            {item}
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => move(idx, Math.max(0, idx - 1))}>↑</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => move(idx, Math.min(order.length - 1, idx + 1))}>↓</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Matrix Yes/No ─────────────────────────────────────────────────────────────
function MatrixYesNoRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const statements = question.content.statements ?? [];
  const selection = (answer as (boolean | null)[] | undefined) ?? statements.map(() => null);

  const toggle = (idx: number, val: boolean) => {
    const next = [...selection];
    next[idx] = selection[idx] === val ? null : val;
    onAnswerChange?.(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Statement</th>
            <th className="w-16 text-center py-2 font-medium text-green-700">Yes</th>
            <th className="w-16 text-center py-2 font-medium text-red-700">No</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((stmt, idx) => (
            <tr key={`${question.id}-matrix-${idx}`} className="border-b border-border/50 hover:bg-accent/20">
              <td className="py-2 pr-4">{stmt}</td>
              <td className="text-center py-2">
                <button
                  type="button"
                  onClick={() => toggle(idx, true)}
                  className={`h-6 w-6 rounded-full border-2 transition-colors ${selection[idx] === true ? 'bg-green-500 border-green-500' : 'border-border hover:border-green-400'}`}
                />
              </td>
              <td className="text-center py-2">
                <button
                  type="button"
                  onClick={() => toggle(idx, false)}
                  className={`h-6 w-6 rounded-full border-2 transition-colors ${selection[idx] === false ? 'bg-red-500 border-red-500' : 'border-border hover:border-red-400'}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dropdown Fill-in-the-Blanks ───────────────────────────────────────────────
function DropdownBlankRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const text = question.content.sentence ?? question.questionText ?? '';
  const parts = text.split(/({{[^}]+}})/g).filter(Boolean);
  const answers = (answer as Record<string, string> | undefined) ?? {};

  return (
    <div className="rounded-lg border border-border p-3 text-sm leading-8">
      <div className="flex flex-wrap items-center gap-1">
        {parts.map((part, idx) => {
          const match = part.match(/{{(.*?)}}/);
          if (!match) return <span key={idx}>{part}</span>;
          const key = match[1];
          const opts = question.content.dropdownOptions?.[key] ?? [];
          return (
            <select
              key={idx}
              value={answers[key] ?? ''}
              onChange={e => onAnswerChange?.({ ...answers, [key]: e.target.value })}
              className="rounded-md border border-primary bg-background px-2 py-0.5 text-sm font-medium text-primary"
            >
              <option value="">Select…</option>
              {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          );
        })}
      </div>
    </div>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────
const registry: Partial<Record<AssessmentQuestionType, (props: RendererProps) => JSX.Element>> = {
  MCQ: McqRenderer,
  TRUE_FALSE: McqRenderer,
  MULTIPLE_RESPONSE: MultipleResponseRenderer,
  DRAG_AND_DROP: DragAndDropRenderer,
  MATRIX_YES_NO: MatrixYesNoRenderer,
  DROPDOWN_BLANK: DropdownBlankRenderer,
};

export function AssessmentQuestionRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const Renderer = registry[question.type];
  if (!Renderer) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquareQuote className="h-4 w-4 shrink-0" />
        {question.type !== 'DROPDOWN_BLANK' && question.questionText}
      </div>
      <Renderer question={question} answer={answer} onAnswerChange={onAnswerChange} />
    </div>
  );
}
