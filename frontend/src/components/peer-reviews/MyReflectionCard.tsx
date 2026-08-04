import {CheckCircle2, Heart, Lock, Users} from 'lucide-react';
import {cn} from '@/utils/utils';
import type {MyReflection} from '@/lib/api/peer-reviews';

interface MyReflectionCardProps {
  reflection: MyReflection;
}

/** One node of the three-stage tracker across the top of the card. */
function Stage({
  label,
  state,
}: {
  label: string;
  state: 'done' | 'current' | 'todo';
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span
        className={cn(
          'h-1.5 rounded-full transition-colors',
          state === 'done' && 'bg-primary',
          state === 'current' && 'bg-primary/40',
          state === 'todo' && 'bg-muted',
        )}
      />
      <span
        className={cn(
          'text-[11px] leading-tight',
          state === 'todo' ? 'text-muted-foreground' : 'font-medium text-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The author's own reflection and its peer score.
 *
 * Opens with an explicit "Submitted" banner and a three-stage tracker. The
 * earlier version led with the reflection text alone, and testers could not tell
 * whether their answer had saved — the absence of an error was the only signal
 * that it had.
 *
 * When the score is withheld the card says which of the two conditions is
 * outstanding and how far off it is. A bare "locked" would read as a penalty;
 * naming the remaining step is what makes reviewing feel worth finishing.
 */
export default function MyReflectionCard({reflection}: MyReflectionCardProps) {
  const {
    averageScore,
    lockedReason,
    reviewsCompleted,
    reviewsRequired,
    reviewsReceived,
    helpfulCount,
    confidence,
  } = reflection;

  const remaining = Math.max(reviewsRequired - reviewsCompleted, 0);
  const scored = averageScore !== null;
  const quotaDone = remaining === 0;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Unambiguous confirmation that the answer is saved */}
      <div className="flex items-center gap-2.5 border-b border-emerald-600/20 bg-emerald-500/10 px-5 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Reflection submitted
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Saved and shared anonymously with classmates.
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex gap-2" aria-label="Progress">
          <Stage label="Written" state="done" />
          <Stage
            label={`Reviews (${reviewsCompleted}/${reviewsRequired})`}
            state={quotaDone ? 'done' : 'current'}
          />
          <Stage
            label="Score"
            state={scored ? 'done' : quotaDone ? 'current' : 'todo'}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Your answer</h3>
            <p className="text-sm text-muted-foreground">
              You rated your own understanding {confidence}/10.
            </p>
          </div>

          {scored ? (
            <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-right">
              <p className="text-2xl font-semibold leading-none tabular-nums text-primary">
                {averageScore.toFixed(1)}
                <span className="text-sm font-normal text-primary/70">/10</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                from {reviewsReceived}{' '}
                {reviewsReceived === 1 ? 'peer' : 'peers'}
              </p>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Score locked
            </div>
          )}
        </div>

        <blockquote className="whitespace-pre-wrap rounded-lg border-l-2 border-primary/40 bg-muted/50 p-4 text-sm leading-relaxed">
          {reflection.text}
        </blockquote>

        {lockedReason === 'REVIEWS_PENDING' ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm">
              Review{' '}
              <span className="font-semibold text-foreground">
                {remaining} more {remaining === 1 ? 'classmate' : 'classmates'}
              </span>{' '}
              to unlock your score.
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    reviewsRequired > 0
                      ? Math.min((reviewsCompleted / reviewsRequired) * 100, 100)
                      : 100
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {reviewsCompleted} of {reviewsRequired} reviews done
            </p>
          </div>
        ) : null}

        {lockedReason === 'AWAITING_PEERS' ? (
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-4">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Waiting on classmates to review your answer
              </p>
              <p className="text-xs text-muted-foreground">
                {reviewsReceived} so far. Your score appears once a few more
                come in — an average from this many isn't reliable yet.
              </p>
            </div>
          </div>
        ) : null}

        {helpfulCount > 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 shrink-0 fill-current text-primary" />
            {helpfulCount} {helpfulCount === 1 ? 'classmate' : 'classmates'} said
            this helped them understand the topic.
          </p>
        ) : null}
      </div>
    </div>
  );
}
