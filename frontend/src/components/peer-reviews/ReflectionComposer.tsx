import {useState} from 'react';
import {Check, Loader2, PenLine} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/utils/utils';
import ScoreScale from './ScoreScale';

const MIN_LENGTH = 100;
const MAX_LENGTH = 3000;

interface ReflectionComposerProps {
  /** Instructor-configured prompt; falls back to a generic ask when absent. */
  prompt?: string;
  onSubmit: (input: {text: string; confidence: number}) => Promise<unknown>;
  isSubmitting?: boolean;
}

/** A numbered step heading, so the two things being asked for stay distinct. */
function StepHeading({
  step,
  title,
  done,
}: {
  step: number;
  title: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
          done
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </span>
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
  );
}

/**
 * Where a student writes what they took away from a section.
 *
 * The self-confidence rating is asked for *before* submission and never shown
 * again alongside peer scores, so it records what the student believed at the
 * time rather than a number revised in hindsight.
 *
 * The brief and the answer are deliberately different surfaces: instructions sit
 * on a tinted panel, the writing area is a bordered field on the page ground
 * with its own label. An earlier version ran them together and testers could not
 * tell which text was theirs to replace.
 */
export default function ReflectionComposer({
  prompt,
  onSubmit,
  isSubmitting = false,
}: ReflectionComposerProps) {
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);

  const trimmedLength = text.trim().length;
  const tooShort = trimmedLength < MIN_LENGTH;
  const missing = trimmedLength === 0;
  const canSubmit = !tooShort && confidence !== null && !isSubmitting;

  const progress = Math.min((trimmedLength / MIN_LENGTH) * 100, 100);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({text: text.trim(), confidence: confidence!});
  };

  const blocker = tooShort
    ? `Write ${MIN_LENGTH - trimmedLength} more characters`
    : confidence === null
      ? 'Rate your understanding above'
      : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* The brief — tinted so it reads as instruction, not as content to edit */}
      <div className="flex items-start gap-3 border-b bg-muted/40 p-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PenLine className="h-4.5 w-4.5" />
        </span>
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-snug">
            {prompt || 'What did you take away from this section?'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Explain it in your own words, as if to someone who has not watched it
            yet. Classmates read it anonymously and rate it.
          </p>
        </div>
      </div>

      <div className="space-y-7 p-5">
        {/* Step 1 — writing */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <StepHeading step={1} title="Your answer" done={!tooShort} />
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                tooShort ? 'text-muted-foreground' : 'text-muted-foreground',
              )}
            >
              {trimmedLength} / {MAX_LENGTH}
            </span>
          </div>

          <Textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Start typing here — the key idea was…"
            rows={9}
            disabled={isSubmitting}
            aria-label="Your reflection"
            className={cn(
              'resize-y bg-background text-base leading-relaxed',
              'min-h-44 rounded-lg border-2 shadow-inner',
              'focus-visible:ring-2 focus-visible:ring-primary/40',
              !tooShort && 'border-primary/40',
            )}
          />

          {/* Length is a goal to reach, so show it filling rather than counting down */}
          <div className="flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Minimum length progress"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  tooShort ? 'bg-muted-foreground/40' : 'bg-primary',
                )}
                style={{width: `${progress}%`}}
              />
            </div>
            <p
              className={cn(
                'shrink-0 text-xs',
                tooShort ? 'text-muted-foreground' : 'font-medium text-primary',
              )}
            >
              {missing
                ? `${MIN_LENGTH} characters minimum`
                : tooShort
                  ? `${MIN_LENGTH - trimmedLength} more to go`
                  : 'Long enough'}
            </p>
          </div>
        </div>

        {/* Step 2 — self rating */}
        <div className="space-y-3">
          <StepHeading
            step={2}
            title="Rate your own understanding"
            done={confidence !== null}
          />
          <div className="rounded-lg border bg-muted/30 p-4">
            <ScoreScale
              label="How well do you think you understood this section?"
              hint="Your honest estimate. Classmates never see this number."
              lowLabel="1 — Barely followed it"
              highLabel="10 — Could teach it"
              value={confidence}
              onChange={setConfidence}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            You can submit once. Your answer cannot be edited after that.
          </p>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit reflection'
            )}
          </Button>
        </div>

        {blocker && !isSubmitting ? (
          <p className="-mt-4 text-right text-xs text-muted-foreground">
            {blocker} to submit.
          </p>
        ) : null}
      </div>
    </div>
  );
}
