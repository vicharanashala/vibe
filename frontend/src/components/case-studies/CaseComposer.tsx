import {useState} from 'react';
import {AlertCircle, AlertTriangle, Ban, Loader2, PenLine} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/utils/utils';
import {countWords} from '@/utils/wordCount';
import {reportCaseStudyAnomaly} from '@/lib/api/anomaly-events';
import type {CaseResponseInput} from '@/lib/api/case-studies';

const STEELMAN_MIN_WORDS = 25;
const FIELD_MIN_WORDS = 5;
const TOTAL_GUIDANCE_MAX = 200;

interface CaseComposerProps {
  title: string;
  bodyMarkdown: string;
  onSubmit: (response: CaseResponseInput) => Promise<unknown>;
  isSubmitting?: boolean;
  anomalyContext: {courseId: string; versionId: string; itemId: string};
  mode?: 'write' | 'revise' | 'withdrawn';
  existingResponse?: Partial<CaseResponseInput>;
}

/**
 * Four-section write UI (FR-12). Word counter mirrors the server's exact
 * counting logic (`countWords`). No paste/copy on any field — blocked
 * visibly so participants notice and retype instead of assuming it worked.
 */
export default function CaseComposer({
  title,
  bodyMarkdown,
  onSubmit,
  isSubmitting = false,
  anomalyContext,
  mode = 'write',
  existingResponse,
}: CaseComposerProps) {
  const [beat1a, setBeat1a] = useState(existingResponse?.beat1a ?? '');
  const [beat1b, setBeat1b] = useState(existingResponse?.beat1b ?? '');
  const [beat1c, setBeat1c] = useState(existingResponse?.beat1c ?? '');
  const [steelman, setSteelman] = useState(existingResponse?.steelman ?? '');
  const [roomPerspective, setRoomPerspective] = useState(existingResponse?.roomPerspective ?? '');
  const [changeCommitment, setChangeCommitment] = useState(existingResponse?.changeCommitment ?? '');
  const [blockedNotice, setBlockedNotice] = useState(false);

  const steelmanWords = countWords(steelman);
  const totalWords =
    countWords(beat1a) +
    countWords(beat1b) +
    countWords(beat1c) +
    steelmanWords +
    countWords(roomPerspective) +
    countWords(changeCommitment);

  const beat1aWords = countWords(beat1a);
  const beat1bWords = countWords(beat1b);
  const beat1cWords = countWords(beat1c);
  const roomWords = countWords(roomPerspective);
  const changeWords = countWords(changeCommitment);

  const steelmanTooShort = steelmanWords > 0 && steelmanWords < STEELMAN_MIN_WORDS;
  const singleFieldsTooShort =
    (beat1a.trim() && beat1aWords < FIELD_MIN_WORDS) ||
    (beat1b.trim() && beat1bWords < FIELD_MIN_WORDS) ||
    (beat1c.trim() && beat1cWords < FIELD_MIN_WORDS) ||
    (roomPerspective.trim() && roomWords < FIELD_MIN_WORDS) ||
    (changeCommitment.trim() && changeWords < FIELD_MIN_WORDS);
  const allFilled =
    beat1aWords >= FIELD_MIN_WORDS && beat1bWords >= FIELD_MIN_WORDS && beat1cWords >= FIELD_MIN_WORDS &&
    steelman.trim() && roomWords >= FIELD_MIN_WORDS && changeWords >= FIELD_MIN_WORDS;
  const canSubmit = allFilled && steelmanWords >= STEELMAN_MIN_WORDS && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      beat1a: beat1a.trim(),
      beat1b: beat1b.trim(),
      beat1c: beat1c.trim(),
      steelman: steelman.trim(),
      roomPerspective: roomPerspective.trim(),
      changeCommitment: changeCommitment.trim(),
    });
  };

  const handleBlockedAttempt = (e: React.ClipboardEvent | React.MouseEvent) => {
    e.preventDefault();
    setBlockedNotice(true);
    reportCaseStudyAnomaly({
      type: 'PASTE_ATTEMPTED',
      courseId: anomalyContext.courseId,
      versionId: anomalyContext.versionId,
      itemId: anomalyContext.itemId,
    });
    window.setTimeout(() => setBlockedNotice(false), 4000);
  };

  const blockProps = {
    onPaste: handleBlockedAttempt,
    onCopy: handleBlockedAttempt,
    onCut: handleBlockedAttempt,
    onContextMenu: handleBlockedAttempt,
    disabled: isSubmitting,
  } as const;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {mode === 'revise' ? (
        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your peers have flagged this response as consistently weak. Revise and resubmit below.
          </p>
        </div>
      ) : null}
      {mode === 'withdrawn' ? (
        <div className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/5 p-4">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            Your response was flagged as unjudgeable by other reviewers. Please revise and resubmit a clear, substantive response.
          </p>
        </div>
      ) : null}

      <div className="flex items-start gap-3 border-b bg-muted/40 p-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PenLine className="h-4.5 w-4.5" />
        </span>
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-snug">{title}</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{bodyMarkdown}</p>
        </div>
      </div>

      <div className="divide-y">
        {/* Element 1 — Where I landed */}
        <section className="space-y-3 p-5">
          <p className="text-sm font-semibold text-foreground">Element 1 — Where I landed</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">a) What I thought going in</label>
              {beat1a.trim() && beat1aWords < FIELD_MIN_WORDS && (
                <span className="text-xs font-medium text-destructive">{beat1aWords}/{FIELD_MIN_WORDS}+ words</span>
              )}
            </div>
            <Input
              data-testid="beat1a"
              value={beat1a}
              onChange={e => setBeat1a(e.target.value)}
              placeholder="~1 sentence (min 5 words)"
              aria-label="What I thought going in"
              className={cn(beat1a.trim() && beat1aWords < FIELD_MIN_WORDS && 'border-destructive/60')}
              {...blockProps}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">b) What challenged it — or what gave most pause if nothing did</label>
              {beat1b.trim() && beat1bWords < FIELD_MIN_WORDS && (
                <span className="text-xs font-medium text-destructive">{beat1bWords}/{FIELD_MIN_WORDS}+ words</span>
              )}
            </div>
            <Input
              data-testid="beat1b"
              value={beat1b}
              onChange={e => setBeat1b(e.target.value)}
              placeholder="~1 sentence (min 5 words)"
              aria-label="What challenged my initial view"
              className={cn(beat1b.trim() && beat1bWords < FIELD_MIN_WORDS && 'border-destructive/60')}
              {...blockProps}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">c) Where I ended up</label>
              {beat1c.trim() && beat1cWords < FIELD_MIN_WORDS && (
                <span className="text-xs font-medium text-destructive">{beat1cWords}/{FIELD_MIN_WORDS}+ words</span>
              )}
            </div>
            <Input
              data-testid="beat1c"
              value={beat1c}
              onChange={e => setBeat1c(e.target.value)}
              placeholder="~1 sentence (min 5 words)"
              aria-label="Where I ended up"
              className={cn(beat1c.trim() && beat1cWords < FIELD_MIN_WORDS && 'border-destructive/60')}
              {...blockProps}
            />
          </div>
        </section>

        {/* Element 2a — Steelman */}
        <section className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">2a — The strongest case against my view</p>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                steelmanTooShort ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {steelmanWords} / {STEELMAN_MIN_WORDS}+ words
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            The case's turn names what each choice costs — use that framing, not what was said in the breakout.
          </p>
          <Textarea
            data-testid="steelman"
            value={steelman}
            onChange={e => setSteelman(e.target.value)}
            placeholder="Argue the other side as forcefully as you can…"
            rows={5}
            aria-label="Steelman — strongest case against my view"
            className={cn(
              'resize-y bg-background text-base leading-relaxed',
              'min-h-28 rounded-lg border-2 shadow-inner',
              'focus-visible:ring-2 focus-visible:ring-primary/40',
              steelmanTooShort && 'border-destructive/60',
            )}
            {...blockProps}
          />
          {steelmanTooShort ? (
            <p className="text-xs font-medium text-destructive">
              Steelman needs at least {STEELMAN_MIN_WORDS} words ({STEELMAN_MIN_WORDS - steelmanWords} more to go).
            </p>
          ) : null}
        </section>

        {/* Element 2b — Room perspective */}
        <section className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">2b — One perspective from the room</p>
            {roomPerspective.trim() && roomWords < FIELD_MIN_WORDS && (
              <span className="text-xs font-medium text-destructive">{roomWords}/{FIELD_MIN_WORDS}+ words</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            "Room broadly agreed with me" is a valid answer. This is not shown to reviewers.
          </p>
          <Input
            data-testid="roomPerspective"
            value={roomPerspective}
            onChange={e => setRoomPerspective(e.target.value)}
            placeholder="~1 sentence (min 5 words)"
            aria-label="One perspective from the room"
            className={cn(roomPerspective.trim() && roomWords < FIELD_MIN_WORDS && 'border-destructive/60')}
            {...blockProps}
          />
        </section>

        {/* Element 3 — Change commitment */}
        <section className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">3 — One thing I'll change</p>
            {changeCommitment.trim() && changeWords < FIELD_MIN_WORDS && (
              <span className="text-xs font-medium text-destructive">{changeWords}/{FIELD_MIN_WORDS}+ words</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Answer the cost you named in your steelman above.
          </p>
          <Input
            data-testid="changeCommitment"
            value={changeCommitment}
            onChange={e => setChangeCommitment(e.target.value)}
            placeholder="~1 sentence (min 5 words)"
            aria-label="One thing I will change"
            className={cn(changeCommitment.trim() && changeWords < FIELD_MIN_WORDS && 'border-destructive/60')}
            {...blockProps}
          />
        </section>
      </div>

      <div className="space-y-3 border-t bg-muted/20 p-5">
        {blockedNotice ? (
          <p
            data-testid="case-composer-paste-blocked-notice"
            className="flex items-center gap-1.5 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Paste/copy is disabled here — please type your own response.
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <span
            className={cn(
              'text-xs tabular-nums',
              totalWords > TOTAL_GUIDANCE_MAX ? 'font-medium text-amber-600' : 'text-muted-foreground',
            )}
          >
            total: {totalWords} / {TOTAL_GUIDANCE_MAX} words{totalWords > TOTAL_GUIDANCE_MAX ? ' (over guidance)' : ''}
          </span>
          <Button
            data-testid="case-composer-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'revise' || mode === 'withdrawn' ? 'Resubmitting…' : 'Submitting…'}
              </>
            ) : mode === 'revise' || mode === 'withdrawn' ? (
              'Resubmit'
            ) : (
              'Submit response'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
