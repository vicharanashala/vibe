import {useState} from 'react';
import {AlertTriangle, Flag, Loader2, ThumbsUp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cn} from '@/utils/utils';
import type {PickOutcome, PickResult, ServedPair, ServedPairSide} from '@/lib/api/case-studies';
import ReadingTimerGate from './ReadingTimerGate';

interface ComparisonViewProps {
  pair: ServedPair;
  onPick: (outcome: PickOutcome) => Promise<PickResult>;
  anomalyContext: {courseId: string; versionId: string; itemId: string};
}

function Field({label, value}: {label: string; value: string}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function ResponseCard({side, label}: {side: ServedPairSide; label: string}) {
  return (
    <div className="flex-1 space-y-4 rounded-lg border bg-card p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="space-y-3 border-t pt-3">
        <Field label="What I thought going in" value={side.beat1a} />
        <Field label="What challenged it" value={side.beat1b} />
        <Field label="Where I ended up" value={side.beat1c} />
      </div>
      <div className="space-y-0.5 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Strongest case against my view</p>
        <p className="whitespace-pre-line text-sm leading-relaxed">{side.steelman}</p>
      </div>
      <div className="space-y-3 border-t pt-3">
        <Field label="One perspective from the room" value={side.roomPerspective} />
        <Field label="One thing I'll change" value={side.changeCommitment} />
      </div>
    </div>
  );
}

/**
 * Split-view pair showing two steelman arguments (element 2a only — no other
 * response fields are exposed to reviewers). Pick buttons stay disabled until
 * `ReadingTimerGate` clears; that is UX only — the server independently
 * re-validates the real elapsed time (§4.8).
 */
export default function ComparisonView({pair, onPick, anomalyContext}: ComparisonViewProps) {
  const [locked, setLocked] = useState(true);
  const [pending, setPending] = useState<PickOutcome | null>(null);
  const [result, setResult] = useState<PickResult | null>(null);

  const handlePick = async (outcome: PickOutcome) => {
    // FLAGGED can fire while locked — a broken/unreadable pair can't be "read"
    if (pending || (locked && outcome !== 'FLAGGED')) return;
    setPending(outcome);
    try {
      const r = await onPick(outcome);
      setResult(r);
    } finally {
      setPending(null);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
        <ThumbsUp className="h-6 w-6 text-primary" />
        <p className="font-medium">Verdict recorded</p>
        {result.totalJudged > 0 ? (
          <p className="text-sm text-muted-foreground">
            {result.agreementCount} of {result.totalJudged} reader{result.totalJudged === 1 ? '' : 's'} who have
            judged this pair so far chose the same one.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReadingTimerGate
        servedAt={pair.servedAt}
        minimumScreenTimeSeconds={pair.minimumScreenTimeSeconds}
        anomalyContext={anomalyContext}
        onLockChange={setLocked}
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <ResponseCard side={pair.left} label="Response A" />
        <ResponseCard side={pair.right} label="Response B" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          data-testid="pick-left"
          variant="outline"
          disabled={locked || Boolean(pending)}
          onClick={() => handlePick(pair.left.outcome)}
          className={cn('h-auto py-3 pick-option')}
        >
          {pending === pair.left.outcome ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Response A is better
        </Button>
        <Button
          data-testid="pick-right"
          variant="outline"
          disabled={locked || Boolean(pending)}
          onClick={() => handlePick(pair.right.outcome)}
          className={cn('h-auto py-3 pick-option')}
        >
          {pending === pair.right.outcome ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Response B is better
        </Button>
        <Button
          data-testid="pick-both-weak"
          variant="outline"
          disabled={locked || Boolean(pending)}
          onClick={() => handlePick('BOTH_WEAK')}
          className={cn('h-auto py-3 pick-option')}
        >
          {pending === 'BOTH_WEAK' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Both are too weak
        </Button>
        <Button
          data-testid="pick-flagged"
          variant="outline"
          disabled={Boolean(pending)}
          onClick={() => handlePick('FLAGGED')}
          className={cn('h-auto gap-1.5 py-3 text-muted-foreground hover:text-foreground')}
        >
          {pending === 'FLAGGED' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Flag className="h-4 w-4" />
          )}
          Report as unreadable
        </Button>
      </div>

      {locked ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Leaving this tab restarts the reading timer.
        </p>
      ) : null}
    </div>
  );
}
