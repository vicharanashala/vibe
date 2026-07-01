import {useEffect, useState} from 'react';
import {Plus, Trash2, Loader2, CheckCircle2, XCircle, Clock, Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/utils/utils';
import type {
  StudentQuestionOptionInput,
  StudentQuestionSubmissionPayload,
  StudentQuestionSubmissionResult,
} from '@/types/student-question.types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function emptyOption(): StudentQuestionOptionInput {
  return {text: ''};
}

function initialPayload(): StudentQuestionSubmissionPayload {
  return {
    questionType: 'SELECT_ONE_IN_LOT',
    questionText: '',
    options: [emptyOption(), emptyOption()],
    correctOptionIndex: 0,
  };
}

type Phase = 'form' | 'checking' | 'verdict';

interface StudentQuestionComposerProps {
  isOpen: boolean;
  onCancel: () => void;
  /** Runs the AI screening; returns the verdict. */
  onSubmit: (payload: StudentQuestionSubmissionPayload) => Promise<StudentQuestionSubmissionResult>;
  /** Called when a terminal verdict (contributed / in review) is dismissed. */
  onDone?: (verdict: StudentQuestionSubmissionResult) => void;
}

export default function StudentQuestionComposer({
  isOpen,
  onCancel,
  onSubmit,
  onDone,
}: StudentQuestionComposerProps) {
  const [payload, setPayload] = useState<StudentQuestionSubmissionPayload>(initialPayload);
  const [phase, setPhase] = useState<Phase>('form');
  const [verdict, setVerdict] = useState<StudentQuestionSubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset everything each time the composer opens.
  useEffect(() => {
    if (isOpen) {
      setPayload(initialPayload());
      setPhase('form');
      setVerdict(null);
      setError(null);
    }
  }, [isOpen]);

  const updateOption = (index: number, text: string) => {
    setPayload(current => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? {text} : option)),
    }));
  };

  const addOption = () => {
    setPayload(current => {
      if (current.options.length >= MAX_OPTIONS) return current;
      return {...current, options: [...current.options, emptyOption()]};
    });
  };

  const removeOption = (index: number) => {
    setPayload(current => {
      if (current.options.length <= MIN_OPTIONS) return current;
      const nextOptions = current.options.filter((_, i) => i !== index);
      const nextCorrect =
        current.correctOptionIndex === index
          ? 0
          : current.correctOptionIndex > index
            ? current.correctOptionIndex - 1
            : current.correctOptionIndex;
      return {...current, options: nextOptions, correctOptionIndex: nextCorrect};
    });
  };

  const trimmedQuestion = payload.questionText.trim();
  const disabled =
    trimmedQuestion.length < 10 ||
    trimmedQuestion.length > 300 ||
    payload.options.length < MIN_OPTIONS ||
    payload.options.some(option => !option.text?.trim());

  const handleVerify = async () => {
    setError(null);
    setPhase('checking');
    try {
      const result = await onSubmit(payload);
      setVerdict(result);
      setPhase('verdict');
    } catch (err: any) {
      // A transport error still shouldn't dead-end the student.
      setError(err?.message || 'Something went wrong while checking your question.');
      setPhase('form');
    }
  };

  // ── Loading: "stay on screen while the AI checks" ──
  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-primary" />
        </div>
        <p className="text-sm font-medium">Verifying your question…</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Checking that it's clear, not a duplicate, on-topic, and correctly answered. This takes a moment.
        </p>
      </div>
    );
  }

  // ── Verdict ──
  if (phase === 'verdict' && verdict) {
    return <VerdictPanel verdict={verdict} onEdit={() => setPhase('form')} onDone={() => onDone?.(verdict)} />;
  }

  // ── Form ──
  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="student-question-text" className="text-sm font-medium">
          Question prompt
        </Label>
        <Textarea
          id="student-question-text"
          placeholder="Write the MCQ prompt students should answer (10-300 characters)"
          className="min-h-[80px] resize-none text-sm"
          maxLength={300}
          value={payload.questionText}
          onChange={event =>
            setPayload(current => ({...current, questionText: event.target.value}))
          }
        />
        <p className="text-xs text-muted-foreground">{trimmedQuestion.length}/300 characters</p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Options{' '}
            <span className="text-xs font-normal text-muted-foreground">— select the correct answer</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={addOption}
            disabled={payload.options.length >= MAX_OPTIONS}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add option
          </Button>
        </div>

        {payload.options.map((option, index) => (
          <div key={`option-${index}`} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {OPTION_LABELS[index]}
            </span>
            <Input
              placeholder="Option text"
              className="h-8 flex-1 text-sm"
              maxLength={150}
              value={option.text}
              onChange={event => updateOption(index, event.target.value)}
            />
            <input
              type="radio"
              name="student-question-correct-option"
              checked={payload.correctOptionIndex === index}
              onChange={() => setPayload(current => ({...current, correctOptionIndex: index}))}
              className="h-4 w-4 shrink-0 accent-primary"
              title="Mark as correct answer"
            />
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              onClick={() => removeOption(index)}
              disabled={payload.options.length <= MIN_OPTIONS}
              title="Remove option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleVerify} disabled={disabled} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Verify &amp; Contribute
        </Button>
      </div>
    </div>
  );
}

function VerdictPanel({
  verdict,
  onEdit,
  onDone,
}: {
  verdict: StudentQuestionSubmissionResult;
  onEdit: () => void;
  onDone: () => void;
}) {
  const tone =
    verdict.decision === 'pass'
      ? {icon: CheckCircle2, ring: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'Contributed! 🎉'}
      : verdict.decision === 'hold'
        ? {icon: Clock, ring: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', title: 'Sent for review'}
        : {icon: XCircle, ring: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20', title: 'Needs a small fix'};
  const Icon = tone.icon;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-full border', tone.bg)}>
        <Icon className={cn('h-7 w-7', tone.ring)} />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{tone.title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{verdict.message}</p>
      </div>

      {verdict.decision === 'reject' ? (
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onDone}>
            Discard
          </Button>
          <Button size="sm" onClick={onEdit}>
            Edit &amp; retry
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={onDone} className="mt-1">
          Done
        </Button>
      )}
    </div>
  );
}
