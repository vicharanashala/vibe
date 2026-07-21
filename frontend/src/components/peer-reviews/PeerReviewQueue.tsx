import {useEffect, useState} from 'react';
import {CheckCircle2, Heart, Loader2, ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {cn} from '@/utils/utils';
import type {
  AnonymousReflection,
  ReflectionScores,
} from '@/lib/api/peer-reviews';
import ScoreScale from './ScoreScale';

const CRITERIA: {
  key: keyof ReflectionScores;
  label: string;
  hint: string;
}[] = [
  {
    key: 'understanding',
    label: 'Understanding',
    hint: 'Did they actually grasp the concept?',
  },
  {
    key: 'depth',
    label: 'Depth',
    hint: 'A surface summary, or real insight?',
  },
  {
    key: 'clarity',
    label: 'Clarity',
    hint: 'Is it readable and well expressed?',
  },
];

const emptyScores = (): Partial<ReflectionScores> => ({});

interface PeerReviewQueueProps {
  reflection: AnonymousReflection | null;
  isLoading?: boolean;
  isSubmitting?: boolean;
  onSubmit: (input: {
    reflectionId: string;
    scores: ReflectionScores;
    helpful: boolean;
  }) => Promise<unknown>;
}

/**
 * Reviews one anonymous peer reflection at a time.
 *
 * Deliberately single-item: showing a list would let a reviewer rank peers
 * against each other, which turns an absolute rubric into a relative one.
 */
export default function PeerReviewQueue({
  reflection,
  isLoading = false,
  isSubmitting = false,
  onSubmit,
}: PeerReviewQueueProps) {
  const [scores, setScores] = useState<Partial<ReflectionScores>>(emptyScores);
  const [helpful, setHelpful] = useState(false);

  // Clear the form whenever a different reflection arrives, so a score is never
  // carried over onto the next peer's work.
  useEffect(() => {
    setScores(emptyScores());
    setHelpful(false);
  }, [reflection?.reflectionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finding a reflection to review
      </div>
    );
  }

  if (!reflection) {
    return (
      <div className="space-y-2 rounded-lg border p-8 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="font-medium">Nothing left to review right now</p>
        <p className="text-sm text-muted-foreground">
          Check back once more classmates have submitted their reflections.
        </p>
      </div>
    );
  }

  const complete = CRITERIA.every(c => scores[c.key] !== undefined);
  const done = reflection.reviewsCompleted;
  const required = reflection.reviewsRequired;

  const handleSubmit = async () => {
    if (!complete || isSubmitting) return;
    await onSubmit({
      reflectionId: reflection.reflectionId,
      scores: scores as ReflectionScores,
      helpful,
    });
  };

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Anonymous — you cannot see who wrote this
          </span>
          <span className="tabular-nums text-muted-foreground">
            {Math.min(done, required)} of {required} reviewed
          </span>
        </div>
        <Progress value={Math.min((done / required) * 100, 100)} />
      </div>

      <blockquote className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
        {reflection.text}
      </blockquote>

      <div className="space-y-4">
        {CRITERIA.map(criterion => (
          <ScoreScale
            key={criterion.key}
            label={criterion.label}
            hint={criterion.hint}
            value={scores[criterion.key] ?? null}
            onChange={value =>
              setScores(prev => ({...prev, [criterion.key]: value}))
            }
            disabled={isSubmitting}
          />
        ))}
      </div>

      <button
        type="button"
        aria-pressed={helpful}
        disabled={isSubmitting}
        onClick={() => setHelpful(v => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          helpful
            ? 'border-primary bg-primary/5'
            : 'border-input hover:bg-accent',
        )}
      >
        <Heart
          className={cn(
            'h-4 w-4 shrink-0',
            helpful ? 'fill-current text-primary' : 'text-muted-foreground',
          )}
        />
        <span>
          This helped me understand it better
          <span className="block text-xs text-muted-foreground">
            Separate from the score — a rough explanation can still be the one
            that makes it click.
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {complete ? 'Ready to submit.' : 'Rate all three to continue.'}
        </p>
        <Button onClick={handleSubmit} disabled={!complete || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting
            </>
          ) : (
            'Submit and show next'
          )}
        </Button>
      </div>
    </div>
  );
}
