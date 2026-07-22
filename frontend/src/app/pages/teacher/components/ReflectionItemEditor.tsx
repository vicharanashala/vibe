import {useEffect, useState} from 'react';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';
import {useUpdateCourseItem} from '@/hooks/hooks';

/** Mirrors POLICY_LIMITS on the server, which clamps anything out of range. */
const LIMITS = {
  maxReviewsPerReflection: {min: 1, max: 25, fallback: 10},
  requiredReviewsToUnlock: {min: 0, max: 25, fallback: 10},
  minReviewsToReveal: {min: 1, max: 25, fallback: 3},
} as const;

type PolicyField = keyof typeof LIMITS;

/**
 * Stands in when the item carries no description of its own.
 *
 * The shared UpdateItemBody validator requires a non-empty description for
 * every item type, and this panel does not edit that field — so an item created
 * without one could never be saved. Defaulting here keeps the constraint intact
 * for the item types that rely on it.
 */
const DEFAULT_DESCRIPTION =
  'Write what you learned, then review your peers anonymously';

interface ReflectionItemEditorProps {
  itemId: string;
  courseId: string;
  versionId: string;
  name: string;
  description?: string;
  details?: {
    prompt?: string;
    maxReviewsPerReflection?: number;
    requiredReviewsToUnlock?: number;
    minReviewsToReveal?: number;
  };
  onSaved: () => void;
}

function NumberField({
  id,
  label,
  hint,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  field: PolicyField;
  value: string;
  onChange: (next: string) => void;
}) {
  const {min, max} = LIMITS[field];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={String(LIMITS[field].fallback)}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Instructor settings for one reflection item.
 *
 * Every field is optional: left blank, the item inherits the platform default,
 * which is why empty is stored as undefined rather than coerced to a number.
 */
export default function ReflectionItemEditor({
  itemId,
  courseId,
  versionId,
  name,
  description,
  details,
  onSaved,
}: ReflectionItemEditorProps) {
  const {mutateAsync: updateItem, isPending} = useUpdateCourseItem();

  const asText = (n?: number) => (typeof n === 'number' ? String(n) : '');

  const [prompt, setPrompt] = useState(details?.prompt ?? '');
  const [maxReviews, setMaxReviews] = useState(
    asText(details?.maxReviewsPerReflection),
  );
  const [requiredReviews, setRequiredReviews] = useState(
    asText(details?.requiredReviewsToUnlock),
  );
  const [minReveal, setMinReveal] = useState(
    asText(details?.minReviewsToReveal),
  );

  // Selecting a different reflection item reuses this component instance.
  useEffect(() => {
    setPrompt(details?.prompt ?? '');
    setMaxReviews(asText(details?.maxReviewsPerReflection));
    setRequiredReviews(asText(details?.requiredReviewsToUnlock));
    setMinReveal(asText(details?.minReviewsToReveal));
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const parse = (raw: string, field: PolicyField): number | undefined => {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    const {min, max} = LIMITS[field];
    return Math.min(Math.max(Math.round(n), min), max);
  };

  const effectiveMax =
    parse(maxReviews, 'maxReviewsPerReflection') ??
    LIMITS.maxReviewsPerReflection.fallback;
  const effectiveReveal =
    parse(minReveal, 'minReviewsToReveal') ?? LIMITS.minReviewsToReveal.fallback;
  const revealExceedsCap = effectiveReveal > effectiveMax;

  const handleSave = async () => {
    try {
      await updateItem({
        params: {path: {courseId, versionId, itemId}},
        body: {
          name: name?.trim() || 'Reflection',
          description: description?.trim() || DEFAULT_DESCRIPTION,
          type: 'REFLECTION',
          // The update endpoint carries the payload on `details`, unlike create
          // which uses a per-type field (`reflectionDetails`).
          details: {
            prompt: prompt.trim() === '' ? undefined : prompt.trim(),
            maxReviewsPerReflection: parse(
              maxReviews,
              'maxReviewsPerReflection',
            ),
            requiredReviewsToUnlock: parse(
              requiredReviews,
              'requiredReviewsToUnlock',
            ),
            minReviewsToReveal: parse(minReveal, 'minReviewsToReveal'),
          },
        },
      } as any);
      toast.success('Reflection settings saved');
      onSaved();
    } catch (error: any) {
      // Surface what the server actually objected to; a bare "could not save"
      // leaves no way to tell a validation error from a permission one.
      const detail =
        error?.response?.data?.message ??
        error?.data?.message ??
        error?.message;
      console.error('Reflection settings save failed', error);
      toast.error(
        detail
          ? `Could not save: ${detail}`
          : 'Could not save the reflection settings',
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="reflection-prompt">Prompt</Label>
        <Textarea
          id="reflection-prompt"
          rows={3}
          value={prompt}
          placeholder="What did you take away from this section?"
          onChange={e => setPrompt(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown above the editor. Left blank, students see the default question.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="max-reviews"
          label="Peers per reflection"
          hint="How many peers may score one reflection before it leaves the pool."
          field="maxReviewsPerReflection"
          value={maxReviews}
          onChange={setMaxReviews}
        />
        <NumberField
          id="required-reviews"
          label="Reviews to unlock"
          hint="Reviews a student owes before their own score appears. 0 turns reciprocity off."
          field="requiredReviewsToUnlock"
          value={requiredReviews}
          onChange={setRequiredReviews}
        />
        <NumberField
          id="min-reveal"
          label="Reviews before a score"
          hint="Below this, an average is too noisy to show."
          field="minReviewsToReveal"
          value={minReveal}
          onChange={setMinReveal}
        />
      </div>

      {revealExceedsCap ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          A score needs {effectiveReveal} reviews but only {effectiveMax} can be
          given, so it would never appear. The server will lower the threshold to{' '}
          {effectiveMax}.
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
        <p className="text-xs text-muted-foreground">
          Blank fields use the platform defaults ({
            LIMITS.maxReviewsPerReflection.fallback
          }
          /{LIMITS.requiredReviewsToUnlock.fallback}/
          {LIMITS.minReviewsToReveal.fallback}).
        </p>
      </div>
    </div>
  );
}
