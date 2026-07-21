import {useState} from 'react';
import {Loader2, PenLine} from 'lucide-react';
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

/**
 * Where a student writes what they took away from a section.
 *
 * The self-confidence rating is asked for *before* submission and never shown
 * again alongside peer scores, so it records what the student believed at the
 * time rather than a number revised in hindsight.
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
  const canSubmit = !tooShort && confidence !== null && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({text: text.trim(), confidence: confidence!});
  };

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">
            {prompt || 'What did you take away from this section?'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Explain it in your own words, as if to someone who has not watched it
            yet. Peers will read this anonymously and rate it.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="The key idea was..."
          rows={8}
          disabled={isSubmitting}
          aria-label="Your reflection"
        />
        <p
          className={cn(
            'text-right text-xs',
            tooShort ? 'text-muted-foreground' : 'text-muted-foreground',
          )}
        >
          {tooShort
            ? `${MIN_LENGTH - trimmedLength} more characters needed`
            : `${trimmedLength} / ${MAX_LENGTH}`}
        </p>
      </div>

      <ScoreScale
        label="How well do you think you understood this section?"
        hint="Your own honest estimate. Peers never see this."
        value={confidence}
        onChange={setConfidence}
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          You can only submit once for this section.
        </p>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting
            </>
          ) : (
            'Submit reflection'
          )}
        </Button>
      </div>
    </div>
  );
}
