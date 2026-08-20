import {useState} from 'react';
import {AlertCircle, ArrowLeft, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {enterFullscreen} from '@/utils/fullscreen';
import {
  useMyCaseResponse,
  useMyCaseResponses,
  useNextComparisonPair,
  useReviseResponse,
  useSubmitCaseResponse,
  useSubmitPick,
} from '@/hooks/case-study-hooks';
import CaseList from './CaseList';
import CaseComposer from './CaseComposer';
import ComparisonView from './ComparisonView';
import type {CaseResponseInput} from '@/lib/api/case-studies';

interface CaseStudyWorkspaceProps {
  courseId: string;
  versionId: string;
}

/**
 * Top-level case-studies view, swapped in for `ItemContainer` when the
 * "Case Studies" drawer tab is active. Owns fullscreen entry — called
 * synchronously inside the click handler that opens a case, before any
 * `await`, per `fullscreen.ts`'s documented transient-activation window —
 * and decides write vs review vs locked-list per case, not per item type.
 */
export default function CaseStudyWorkspace({courseId, versionId}: CaseStudyWorkspaceProps) {
  const ref = {courseId, versionId};
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'review' | 'revise' | 'withdrawn'>('write');

  const {cases, isLoading, isError, refetch} = useMyCaseResponses(ref);
  const activeCase = cases.find(c => c.caseStudyId === activeCaseId) ?? null;

  const handleSelectCase = (caseStudyId: string) => {
    // Must run synchronously in the click handler, before any await/state
    // update triggers a re-render — the Fullscreen API's grant only lasts
    // for the duration of the user gesture that requested it.
    enterFullscreen();
    setActiveCaseId(caseStudyId);
    const selected = cases.find(c => c.caseStudyId === caseStudyId);
    if (selected?.state === 'writable') {
      setMode('write');
    } else if (selected?.state === 'withdrawn') {
      setMode('withdrawn');
    } else if (
      selected?.myResponse?.eligibleForRevision === true &&
      selected.state !== 'won'
    ) {
      setMode('revise');
    } else {
      setMode('review');
    }
  };

  const handleBack = () => setActiveCaseId(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading case studies…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">Couldn't load the case studies.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="mx-auto w-full max-w-2xl p-4">
        <h2 className="mb-2 px-2 text-lg font-semibold">Case Studies</h2>
        <CaseList cases={cases} activeCaseId={activeCaseId} onSelectCase={handleSelectCase} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        All cases
      </Button>

      {mode === 'write' ? (
        <CaseComposerPane
          courseId={courseId}
          versionId={versionId}
          caseStudyId={activeCase.caseStudyId}
          title={`Case ${activeCase.sequenceIndex}: ${activeCase.title}`}
          bodyMarkdown={activeCase.bodyMarkdown}
          onSubmitted={() => setMode('review')}
        />
      ) : mode === 'revise' ? (
        <RevisePane
          courseId={courseId}
          versionId={versionId}
          caseStudyId={activeCase.caseStudyId}
          title={`Case ${activeCase.sequenceIndex}: ${activeCase.title}`}
          bodyMarkdown={activeCase.bodyMarkdown}
          existingResponse={activeCase.myResponse}
          composerMode="revise"
          onRevised={() => setMode('review')}
        />
      ) : mode === 'withdrawn' ? (
        <RevisePane
          courseId={courseId}
          versionId={versionId}
          caseStudyId={activeCase.caseStudyId}
          title={`Case ${activeCase.sequenceIndex}: ${activeCase.title}`}
          bodyMarkdown={activeCase.bodyMarkdown}
          existingResponse={activeCase.myResponse}
          composerMode="withdrawn"
          onRevised={() => setMode('review')}
        />
      ) : (
        <ReviewPane courseId={courseId} versionId={versionId} caseStudyId={activeCase.caseStudyId} />
      )}
    </div>
  );
}

function CaseComposerPane({
  courseId,
  versionId,
  caseStudyId,
  title,
  bodyMarkdown,
  onSubmitted,
}: {
  courseId: string;
  versionId: string;
  caseStudyId: string;
  title: string;
  bodyMarkdown: string;
  onSubmitted: () => void;
}) {
  const submit = useSubmitCaseResponse({courseId, versionId}, caseStudyId);
  const [gateStep, setGateStep] = useState<'declaration' | 'date' | 'composing'>('declaration');
  const [declared, setDeclared] = useState(false);
  const [zoomSessionDate, setZoomSessionDate] = useState('');

  if (gateStep === 'declaration') {
    return (
      <div className="space-y-6 rounded-lg border p-6">
        <div>
          <h3 className="text-base font-semibold">Before you begin</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please confirm your participation before accessing this case study.
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
            I confirm that I have watched the relevant Zoom session and participated in the breakout discussion for this case.
          </span>
        </label>
        <Button disabled={!declared} onClick={() => setGateStep('date')}>
          Continue
        </Button>
      </div>
    );
  }

  if (gateStep === 'date') {
    return (
      <div className="space-y-6 rounded-lg border p-6">
        <div>
          <h3 className="text-base font-semibold">Zoom session date</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the date of the Zoom session you attended.
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
      </div>
    );
  }

  return (
    <CaseComposer
      title={title}
      bodyMarkdown={bodyMarkdown}
      isSubmitting={submit.isPending}
      anomalyContext={{courseId, versionId, itemId: caseStudyId}}
      onSubmit={async response => {
        await submit.mutateAsync({...response, zoomSessionDate});
        onSubmitted();
      }}
    />
  );
}

function RevisePane({
  courseId,
  versionId,
  caseStudyId,
  title,
  bodyMarkdown,
  existingResponse,
  composerMode = 'revise',
  onRevised,
}: {
  courseId: string;
  versionId: string;
  caseStudyId: string;
  title: string;
  bodyMarkdown: string;
  existingResponse?: Partial<CaseResponseInput>;
  composerMode?: 'revise' | 'withdrawn';
  onRevised: () => void;
}) {
  const revise = useReviseResponse({courseId, versionId}, caseStudyId);

  return (
    <CaseComposer
      title={title}
      bodyMarkdown={bodyMarkdown}
      isSubmitting={revise.isPending}
      anomalyContext={{courseId, versionId, itemId: caseStudyId}}
      mode={composerMode}
      existingResponse={existingResponse}
      onSubmit={async response => {
        await revise.mutateAsync(response);
        onRevised();
      }}
    />
  );
}

function ReviewPane({
  courseId,
  versionId,
  caseStudyId,
}: {
  courseId: string;
  versionId: string;
  caseStudyId: string;
}) {
  const {response: mine} = useMyCaseResponse(caseStudyId);
  const {pair, isLoading, isError, refetch} = useNextComparisonPair(caseStudyId);
  const submitPick = useSubmitPick({courseId, versionId}, caseStudyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading next pair…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">Couldn't load the next pair to review.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mine ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Your response</p>
          <p className="mt-1 text-muted-foreground">
            {mine.winCount} win{mine.winCount === 1 ? '' : 's'} ·{' '}
            {mine.status === 'WON'
              ? 'Completed'
              : mine.status === 'WITHDRAWN'
                ? 'Flagged for revision'
                : 'In review'}
          </p>
        </div>
      ) : null}

      {pair ? (
        <ComparisonView
          pair={pair}
          onPick={async outcome => {
            const result = await submitPick.mutateAsync({comparisonId: pair.comparisonId, outcome});
            return result;
          }}
          anomalyContext={{courseId, versionId, itemId: caseStudyId}}
        />
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Check back once more colleagues have submitted responses to this case.
        </div>
      )}
    </div>
  );
}
