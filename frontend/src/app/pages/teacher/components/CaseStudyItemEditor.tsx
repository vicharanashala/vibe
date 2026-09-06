import {useEffect, useState} from 'react';
import {Info, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';
import {useUpdateCourseItem} from '@/hooks/hooks';

/** Mirrors the server clamps on ICaseStudyDetails (see ItemValidators). */
const LIMITS = {
  reviewsRequired: {min: 1, max: 25, fallback: 7},
  picksRequired: {min: 1, max: 25, fallback: 7},
  weakStreakThreshold: {min: 0, max: 25, fallback: 3},
} as const;

type PolicyField = keyof typeof LIMITS;

/**
 * The shared UpdateItemBody validator requires a non-empty description for
 * every item type, and this panel does not edit that field — so default it.
 */
const DEFAULT_DESCRIPTION =
  "Write a structured response to the case, then judge pairs of peers' responses";

interface CaseStudyItemEditorProps {
  itemId: string;
  courseId: string;
  versionId: string;
  name: string;
  description?: string;
  details?: {
    bodyMarkdown?: string;
    reviewsRequired?: number;
    picksRequired?: number;
    weakStreakThreshold?: number;
  };
  onSaved: () => void;
}

function NumberField({
  id,
  label,
  question,
  example,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  question: string;
  example: string;
  field: PolicyField;
  value: string;
  onChange: (next: string) => void;
}) {
  const {min, max, fallback} = LIMITS[field];
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{question}</p>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={`${fallback} (default)`}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">e.g. </span>
        {example}
      </p>
    </div>
  );
}

/**
 * Instructor settings for one case-study item.
 *
 * Case studies are scored purely by peer pairwise comparison: every learner
 * writes a response, then judges pairs of peers' responses (A vs B). A response
 * leaves the pool once it has been picked as the stronger side enough times.
 * Every field is optional; left blank the item inherits the platform default.
 */
export default function CaseStudyItemEditor({
  itemId,
  courseId,
  versionId,
  name,
  description,
  details,
  onSaved,
}: CaseStudyItemEditorProps) {
  const {mutateAsync: updateItem, isPending} = useUpdateCourseItem();

  const asText = (n?: number) => (typeof n === 'number' ? String(n) : '');

  const [body, setBody] = useState(details?.bodyMarkdown ?? '');
  const [reviewsRequired, setReviewsRequired] = useState(
    asText(details?.reviewsRequired),
  );
  const [picksRequired, setPicksRequired] = useState(
    asText(details?.picksRequired),
  );
  const [weakStreak, setWeakStreak] = useState(
    asText(details?.weakStreakThreshold),
  );

  // Selecting a different case-study item reuses this component instance.
  useEffect(() => {
    setBody(details?.bodyMarkdown ?? '');
    setReviewsRequired(asText(details?.reviewsRequired));
    setPicksRequired(asText(details?.picksRequired));
    setWeakStreak(asText(details?.weakStreakThreshold));
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const parse = (raw: string, field: PolicyField): number | undefined => {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    const {min, max} = LIMITS[field];
    return Math.min(Math.max(Math.round(n), min), max);
  };

  const handleSave = async () => {
    try {
      await updateItem({
        params: {path: {courseId, versionId, itemId}},
        body: {
          name: name?.trim() || 'Case study',
          description: description?.trim() || DEFAULT_DESCRIPTION,
          type: 'CASE_STUDY',
          // The update endpoint carries the payload on `details`, unlike create
          // which uses a per-type field (`caseStudyDetails`).
          details: {
            bodyMarkdown: body.trim() === '' ? undefined : body.trim(),
            reviewsRequired: parse(reviewsRequired, 'reviewsRequired'),
            picksRequired: parse(picksRequired, 'picksRequired'),
            weakStreakThreshold: parse(weakStreak, 'weakStreakThreshold'),
          },
        },
      } as any);
      toast.success('Case study settings saved');
      onSaved();
    } catch (error: unknown) {
      const err = error as {
        response?: {data?: {message?: string}};
        data?: {message?: string};
        message?: string;
      };
      const detail =
        err?.response?.data?.message ?? err?.data?.message ?? err?.message;
      console.error('Case study settings save failed', error);
      toast.error(
        detail
          ? `Could not save: ${detail}`
          : 'Could not save the case study settings',
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">What is a case study? </span>
          A learner reads a real-world scenario and writes a structured response,
          then anonymously judges pairs of peers' responses to decide which
          argument is stronger. There is no answer key — responses are scored
          only by how they fare in these head-to-head comparisons, so learners
          practise reasoning rather than recalling.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="case-body">The case</Label>
        <Textarea
          id="case-body"
          rows={8}
          value={body}
          placeholder="Describe the scenario the learner will respond to. Markdown is supported."
          onChange={e => setBody(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown to the learner above the response editor. This is the prompt they
          argue about.
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-muted/40 p-4">
        <p className="text-sm font-semibold">Peer review rules</p>
        <p className="text-xs text-muted-foreground">
          Every learner writes one response, then judges pairs of others'
          responses anonymously. These three numbers decide how many comparisons
          happen and when a response is considered settled. Leave any blank to
          use the default.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="reviews-required"
          label="1. Wins to settle"
          question="How many times must a response be picked as the stronger one before it leaves the pool?"
          example={`a response stops being shown once ${
            parse(reviewsRequired, 'reviewsRequired') ??
            LIMITS.reviewsRequired.fallback
          } peers have picked it as stronger.`}
          field="reviewsRequired"
          value={reviewsRequired}
          onChange={setReviewsRequired}
        />
        <NumberField
          id="picks-required"
          label="2. Comparisons to judge"
          question="How many response pairs must each learner compare?"
          example={`each learner judges ${
            parse(picksRequired, 'picksRequired') ??
            LIMITS.picksRequired.fallback
          } pairs of peers' responses.`}
          field="picksRequired"
          value={picksRequired}
          onChange={setPicksRequired}
        />
        <NumberField
          id="weak-streak"
          label="3. Losses before nudge"
          question="How many losses in a row before a learner is nudged to revise their response?"
          example={
            (parse(weakStreak, 'weakStreakThreshold') ??
              LIMITS.weakStreakThreshold.fallback) === 0
              ? 'set to 0, so learners are never nudged to revise.'
              : `after ${
                  parse(weakStreak, 'weakStreakThreshold') ??
                  LIMITS.weakStreakThreshold.fallback
                } consecutive losses, the learner is prompted to revise.`
          }
          field="weakStreakThreshold"
          value={weakStreak}
          onChange={setWeakStreak}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
        <p className="text-xs text-muted-foreground">
          Blank fields use the platform defaults ({LIMITS.reviewsRequired.fallback}/
          {LIMITS.picksRequired.fallback}/{LIMITS.weakStreakThreshold.fallback}).
        </p>
      </div>
    </div>
  );
}
