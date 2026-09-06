import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {AlertCircle, ArrowRight, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {useStartItem, useStopItem} from '@/hooks/hooks';
import {useCourseStore} from '@/store/course-store';
import {
  useEnsureCaseForItem,
  useMyCaseResponse,
  useNextComparisonPair,
  useReviseResponse,
  useSubmitCaseResponse,
  useSubmitPick,
} from '@/hooks/case-study-hooks';
import CaseComposer from './CaseComposer';
import ComparisonView from './ComparisonView';

interface CaseStudyItemPanelProps {
  courseId: string;
  courseVersionId: string;
  itemId: string;
  /** Item title, shown as the heading. */
  title?: string;
  /** Advances to the next item in the section. */
  onNext: () => void;
  isProgressUpdating?: boolean;
  /** True when this item was already completed on an earlier visit. */
  isAlreadyWatched?: boolean;
  /** Shared set of item ids completed this session, to avoid double-stopping. */
  completedItemIdsRef: React.RefObject<Set<string>>;
}

export interface CaseStudyItemPanelRef {
  /** Called by the item container when the learner navigates away. */
  stopItem: () => Promise<void>;
}

/**
 * The learner-facing view of a CASE_STUDY item.
 *
 * Writing comes first and reviewing is only offered afterwards. The case
 * record is synced from the item on open (see useEnsureCaseForItem), so the
 * peer-review runtime keys on the item's own id. Reviewing never blocks
 * `onNext` — the pressure is social, not a course gate.
 */
const CaseStudyItemPanel = forwardRef<
  CaseStudyItemPanelRef,
  CaseStudyItemPanelProps
>(function CaseStudyItemPanel(
  {
    courseId,
    courseVersionId,
    itemId,
    title,
    onNext,
    isProgressUpdating = false,
    isAlreadyWatched = false,
    completedItemIdsRef,
  },
  ref,
) {
  const ctxRef = {courseId, versionId: courseVersionId};
  const anomalyContext = {courseId, versionId: courseVersionId, itemId};
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [gateStep, setGateStep] = useState<'declaration' | 'date' | 'composing'>('declaration');
  const [declared, setDeclared] = useState(false);
  const [zoomSessionDate, setZoomSessionDate] = useState('');

  // Progress is recorded exactly as an article/reflection records it: started
  // on arrival, stopped on the way out. Without this the item never completes,
  // and with linear progression the next lesson stays locked.
  const {currentCourse, setWatchItemId} = useCourseStore();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  const itemStartedRef = useRef(false);
  const startSentRef = useRef(false);

  const alreadyDone = () =>
    isAlreadyWatched || completedItemIdsRef.current?.has(itemId);

  useEffect(() => {
    if (startSentRef.current || !currentCourse?.itemId || alreadyDone()) return;
    startSentRef.current = true;
    startItem.mutate({
      params: {path: {courseId, courseVersionId}},
      body: {
        itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
        cohortId: currentCourse.cohortId || undefined,
      },
    } as any);
  }, [itemId, currentCourse?.itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      startItem.data?.watchItemId &&
      startSentRef.current &&
      !itemStartedRef.current
    ) {
      setWatchItemId(startItem.data.watchItemId);
      itemStartedRef.current = true;
    }
  }, [startItem.data?.watchItemId, setWatchItemId]);

  useImperativeHandle(ref, () => ({
    stopItem: async () => {
      if (!currentCourse?.watchItemId || !itemStartedRef.current) return;
      if (alreadyDone()) return;
      await stopItem.mutateAsync({
        params: {path: {courseId, courseVersionId}},
        body: {
          watchItemId: currentCourse.watchItemId,
          itemId,
          moduleId: currentCourse.moduleId ?? '',
          sectionId: currentCourse.sectionId ?? '',
          cohortId: currentCourse.cohortId || undefined,
        },
      } as any);
      completedItemIdsRef.current?.add(itemId);
      itemStartedRef.current = false;
    },
  }));

  // Sync the case from the item, then drive the runtime by the item's id.
  const {
    caseStudy,
    isLoading: ensuring,
    isError: ensureError,
    refetch: refetchEnsure,
  } = useEnsureCaseForItem(ctxRef, itemId);
  const {
    response: mine,
    eligibleForRevision,
    picksRequired,
    picksCompleted,
    isLoading: mineLoading,
    isError: mineError,
    refetch: refetchMine,
  } = useMyCaseResponse(itemId, Boolean(caseStudy));
  const submit = useSubmitCaseResponse(ctxRef, itemId);
  const revise = useReviseResponse(ctxRef, itemId);

  const hasSubmitted = Boolean(mine);
  const {
    pair,
    isLoading: pairLoading,
    isError: pairError,
    refetch: refetchPair,
  } = useNextComparisonPair(itemId, hasSubmitted && isReviewing);
  const submitPick = useSubmitPick(ctxRef, itemId);

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-full justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl space-y-4">
        {title ? (
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );

  const errorBox = (message: string, onRetry: () => void) =>
    shell(
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>,
    );

  if (ensuring || (caseStudy && mineLoading)) {
    return shell(
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </div>,
    );
  }

  if (ensureError) {
    return errorBox("Couldn't load this case study.", () => refetchEnsure());
  }
  // A load failure must not look like "not submitted yet" — otherwise a learner
  // whose response simply failed to load could submit a second time.
  if (mineError) {
    return errorBox(
      "Couldn't load your response. This is a connection problem, not a lost submission — retry before writing anything new.",
      () => refetchMine(),
    );
  }

  if (!hasSubmitted) {
    if (gateStep === 'declaration') {
      return shell(
        <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <h3 className="text-base font-semibold">Before you begin</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please confirm your participation before writing your response.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              id="zoom-declaration"
              checked={declared}
              onCheckedChange={v => setDeclared(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              I confirm that I have attended the relevant session and participated
              in the breakout room discussion for this case study.
            </span>
          </label>
          <Button disabled={!declared} onClick={() => setGateStep('date')}>
            Continue
          </Button>
        </div>,
      );
    }

    if (gateStep === 'date') {
      return shell(
        <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <h3 className="text-base font-semibold">Session date</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the date of the session in which you did the breakout
              discussion. We trust what you enter — this is stored for reference.
            </p>
          </div>
          <Input
            type="date"
            value={zoomSessionDate}
            onChange={e => setZoomSessionDate(e.target.value)}
            className="max-w-xs"
          />
          <Button disabled={!zoomSessionDate} onClick={() => setGateStep('composing')}>
            OK
          </Button>
        </div>,
      );
    }

    return shell(
      <CaseComposer
        title={caseStudy!.title}
        bodyMarkdown={caseStudy!.bodyMarkdown}
        isSubmitting={submit.isPending}
        anomalyContext={anomalyContext}
        onSubmit={async response => {
          await submit.mutateAsync({...response, zoomSessionDate});
          await refetchMine();
        }}
      />,
    );
  }

  if (isRevising) {
    return shell(
      <CaseComposer
        title={caseStudy!.title}
        bodyMarkdown={caseStudy!.bodyMarkdown}
        isSubmitting={revise.isPending}
        anomalyContext={anomalyContext}
        mode="revise"
        existingResponse={mine!}
        onSubmit={async response => {
          await revise.mutateAsync(response);
          await refetchMine();
          setIsRevising(false);
        }}
      />,
    );
  }

  if (isReviewing) {
    return shell(
      <div className="space-y-3">
        {pairError ? (
          errorBox("Couldn't load the next pair to review.", () => refetchPair())
        ) : pairLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading next pair…
          </div>
        ) : pair ? (
          <ComparisonView
            key={pair.comparisonId}
            pair={pair}
            onPick={async outcome =>
              submitPick.mutateAsync({comparisonId: pair.comparisonId, outcome})
            }
            anomalyContext={anomalyContext}
          />
        ) : (
          <div className="rounded-lg border p-8 text-center text-sm text-foreground/70">
            Check back once more colleagues have submitted responses to this case.
          </div>
        )}
        <Button variant="ghost" onClick={() => setIsReviewing(false)}>
          Back to my response
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Your response</p>
        <p className="mt-1 text-muted-foreground">
          {mine!.winCount} win{mine!.winCount === 1 ? '' : 's'} ·{' '}
          {mine!.status === 'WON'
            ? 'Completed'
            : mine!.status === 'WITHDRAWN'
              ? 'Flagged for revision'
              : 'In review'}
        </p>
      </div>

      {eligibleForRevision ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Reviewers have picked other responses over yours several times in a row.
          You can revise it for another cycle.
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={() => setIsReviewing(true)}>
          {picksRequired > 0
            ? picksCompleted >= picksRequired
              ? `Review peers (${picksCompleted}/${picksRequired} done)`
              : `Review peers (${picksCompleted}/${picksRequired})`
            : 'Review peers'}
        </Button>
        {eligibleForRevision ? (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setIsRevising(true)}
          >
            Revise my response
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onNext}
          disabled={isProgressUpdating}
        >
          {isProgressUpdating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>,
  );
});

export default CaseStudyItemPanel;
