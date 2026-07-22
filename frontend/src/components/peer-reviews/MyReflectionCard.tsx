import {Heart, Lock, Users} from 'lucide-react';
import {Progress} from '@/components/ui/progress';
import {cn} from '@/utils/utils';
import type {MyReflection} from '@/lib/api/peer-reviews';

interface MyReflectionCardProps {
  reflection: MyReflection;
}

/**
 * The author's own reflection and its peer score.
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

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Your reflection</h3>
          <p className="text-sm text-muted-foreground">
            You rated your own understanding {confidence}/10.
          </p>
        </div>

        {averageScore !== null ? (
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {averageScore.toFixed(1)}
              <span className="text-base font-normal text-muted-foreground">
                /10
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              from {reviewsReceived} peers
            </p>
          </div>
        ) : (
          <Lock className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>

      <blockquote className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
        {reflection.text}
      </blockquote>

      {lockedReason === 'REVIEWS_PENDING' ? (
        <div className="space-y-2">
          <p className="text-sm">
            Review{' '}
            <span className="font-medium">
              {remaining} more {remaining === 1 ? 'peer' : 'peers'}
            </span>{' '}
            to unlock your score.
          </p>
          <Progress
            value={
              reviewsRequired > 0
                ? Math.min((reviewsCompleted / reviewsRequired) * 100, 100)
                : 100
            }
          />
        </div>
      ) : null}

      {lockedReason === 'AWAITING_PEERS' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          Waiting for a few more classmates to review your reflection — an
          average from {reviewsReceived} isn't reliable yet.
        </p>
      ) : null}

      {helpfulCount > 0 ? (
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
            'text-muted-foreground',
          )}
        >
          <Heart className="h-4 w-4 shrink-0 fill-current text-primary" />
          {helpfulCount} {helpfulCount === 1 ? 'peer' : 'peers'} said this
          helped them understand the topic.
        </p>
      ) : null}
    </div>
  );
}
