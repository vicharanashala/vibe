import {useState} from 'react';
import {AlertCircle, AlertTriangle, Ban, Loader2, PenLine} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/utils/utils';
import {countWords} from '@/utils/wordCount';
import {reportCaseStudyAnomaly} from '@/lib/api/anomaly-events';

const MAX_WORDS = 150;

interface CaseComposerProps {
  title: string;
  bodyMarkdown: string;
  onSubmit: (text: string) => Promise<unknown>;
  isSubmitting?: boolean;
  anomalyContext: {courseId: string; versionId: string; itemId: string};
  mode?: 'write' | 'revise' | 'withdrawn';
  existingText?: string;
}

/**
 * The flashcard-style write UI. Word counter mirrors the server's exact
 * counting logic (`countWords`) so the displayed number never disagrees with
 * what the server will accept. No paste allowed while composing
 * (PLANNING.md §4.6) — blocked visibly, not as a silent no-op, so a
 * participant who tried to paste notices and retypes by hand instead of
 * assuming it worked.
 */
export default function CaseComposer({
  title,
  bodyMarkdown,
  onSubmit,
  isSubmitting = false,
  anomalyContext,
  mode = 'write',
  existingText = '',
}: CaseComposerProps) {
  const [text, setText] = useState(existingText);
  const [blockedNotice, setBlockedNotice] = useState(false);

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;
  const canSubmit = wordCount > 0 && !overLimit && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(text.trim());
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

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Your response</span>
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              overLimit ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {wordCount} / {MAX_WORDS} words
          </span>
        </div>

        <Textarea
          data-testid="case-composer-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={handleBlockedAttempt}
          onCopy={handleBlockedAttempt}
          onCut={handleBlockedAttempt}
          onContextMenu={handleBlockedAttempt}
          placeholder="Write your response here…"
          rows={8}
          disabled={isSubmitting}
          aria-label="Your case study response"
          className={cn(
            'resize-y bg-background text-base leading-relaxed',
            'min-h-40 rounded-lg border-2 shadow-inner',
            'focus-visible:ring-2 focus-visible:ring-primary/40',
            overLimit && 'border-destructive/60',
          )}
        />

        {blockedNotice ? (
          <p
            data-testid="case-composer-paste-blocked-notice"
            className="flex items-center gap-1.5 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Paste/copy is disabled here — please type your own response.
          </p>
        ) : null}

        {overLimit ? (
          <p className="text-xs font-medium text-destructive">
            Your response is {wordCount - MAX_WORDS} word{wordCount - MAX_WORDS === 1 ? '' : 's'} over the{' '}
            {MAX_WORDS}-word limit.
          </p>
        ) : null}

        <div className="flex justify-end border-t pt-4">
          <Button data-testid="case-composer-submit" onClick={handleSubmit} disabled={!canSubmit} size="lg">
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
