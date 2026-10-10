import { ArrowDownIcon, ArrowUpIcon, CheckCircle2Icon, CircleAlertIcon, ClockIcon, KeyboardIcon, LightbulbIcon, ListChecksIcon, RotateCcwIcon, TargetIcon, XCircleIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { cn } from '@/lib/utils';

import { createAttempt, submitAttempt, toAnswers, type QuizDetails, type QuizQuestion, type QuizResult } from './quiz-api';
import type { LessonItem, LessonRef } from './queries';

type Stage =
  | { kind: 'intro' }
  | { kind: 'starting' }
  | { kind: 'answering'; attemptId: string; questions: QuizQuestion[] }
  | { kind: 'submitting'; attemptId: string; questions: QuizQuestion[] }
  | { kind: 'result'; questions: QuizQuestion[]; result: QuizResult }
  | { kind: 'blocked'; message: string };

const TYPE_HINT: Record<string, string> = {
  SELECT_ONE_IN_LOT: 'Choose one answer.',
  SELECT_MANY_IN_LOT: 'Select all that apply.',
  NUMERIC_ANSWER_TYPE: 'Enter a number.',
  DESCRIPTIVE: 'Write your answer.',
  ORDER_THE_LOTS: 'Put these in the right order.',
};

function minutes(hms?: string) {
  if (!hms) return null;
  const [h = 0, m = 0, s = 0] = hms.split(':').map(Number);
  const total = Math.round(h * 60 + m + s / 60);
  return total > 0 ? total : null;
}

/**
 * Green-track quiz, Uxcel style: intro card → one question per screen with
 * number-key shortcuts and Enter to continue → graded review.
 * `ensureWatchItem` opens the item's watch-time record (green progress) so the
 * backend can advance progress when the attempt passes.
 */
export function QuizRunner({
  lessonRef,
  item,
  ensureWatchItem,
  onPassed,
  onExit,
  onAnsweringChange,
}: {
  lessonRef: LessonRef;
  item: LessonItem;
  ensureWatchItem: () => Promise<string | undefined>;
  onPassed: () => void;
  onExit: () => void;
  /** True while an attempt is open with answers not yet submitted. */
  onAnsweringChange?: (answering: boolean) => void;
}) {
  const details = item.details as unknown as QuizDetails;
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const answering = stage.kind === 'answering';
  useEffect(() => onAnsweringChange?.(answering), [answering, onAnsweringChange]);
  const [error, setError] = useState<string | null>(null);
  const watchItemId = useRef<string | undefined>(undefined);

  async function start() {
    setError(null);
    setStage({ kind: 'starting' });
    try {
      watchItemId.current = await ensureWatchItem();
      const attempt = await createAttempt(lessonRef.itemId);
      if ('noAttemptsLeft' in attempt) return setStage({ kind: 'blocked', message: attempt.noAttemptsLeft });
      if (attempt.questions.length === 0) return setStage({ kind: 'blocked', message: 'This quiz has no questions yet.' });
      setStage({ kind: 'answering', attemptId: attempt.attemptId, questions: attempt.questions });
    } catch (e) {
      setError((e as Error).message);
      setStage({ kind: 'intro' });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== 'answering') return;
    const answers = toAnswers(stage.questions, new FormData(event.currentTarget));
    setError(null);
    setStage({ kind: 'submitting', attemptId: stage.attemptId, questions: stage.questions });
    try {
      const result = await submitAttempt(lessonRef.itemId, stage.attemptId, answers, { ...lessonRef, watchItemId: watchItemId.current });
      setStage({ kind: 'result', questions: stage.questions, result });
    } catch (e) {
      setError((e as Error).message);
      setStage({ kind: 'answering', attemptId: stage.attemptId, questions: stage.questions });
    }
  }

  if (stage.kind === 'intro' || stage.kind === 'starting') {
    return <QuizIntro item={item} details={details} starting={stage.kind === 'starting'} error={error} onStart={start} />;
  }
  if (stage.kind === 'blocked') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <CircleAlertIcon className="mb-4 size-10 text-primary" aria-hidden />
        <h1 className="font-aleo text-2xl">You can’t take this quiz right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">{stage.message}</p>
        <Button variant="outline" className="mt-6" onClick={onExit}>
          Back to the course
        </Button>
      </div>
    );
  }
  if (stage.kind === 'result') {
    return <QuizReview details={details} questions={stage.questions} result={stage.result} onRetry={start} onContinue={onPassed} onExit={onExit} />;
  }

  const { questions } = stage;
  return (
    <AnsweringQuestionnaire>
    <Questionnaire
      items={questions.map((q) => ({
        name: q.type === 'ORDER_THE_LOTS' ? `${q.id}:order` : q.id,
        required: q.type !== 'ORDER_THE_LOTS',
        ...(q.type === 'SELECT_ONE_IN_LOT' || q.type === 'SELECT_MANY_IN_LOT' ? { choices: q.options.map((o) => ({ value: o.id })) } : {}),
      }))}
      shortcuts="numbers"
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-2xl flex-1 gap-0 px-4 pt-8 pb-32"
      aria-label={item.name}
    >
      <QuizProgress questions={questions} />
      {questions.map((q, i) => (
        <QuestionnaireItem
          key={q.id}
          name={q.type === 'ORDER_THE_LOTS' ? `${q.id}:order` : q.id}
          required={q.type !== 'ORDER_THE_LOTS'}
          multiple={q.type === 'SELECT_MANY_IN_LOT'}
          className="mt-6"
        >
          <QuestionnaireTitle className="font-aleo text-2xl leading-snug font-normal tracking-tight sm:text-[1.7rem]">
            <span className="mb-2 block font-sans text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Question {i + 1} of {questions.length}
            </span>
            {q.text}
          </QuestionnaireTitle>
          <QuestionnaireDescription>{TYPE_HINT[q.type]}</QuestionnaireDescription>
          {details.allowHint && q.hint && <Hint text={q.hint} />}
          <QuestionBody question={q} />
          <QuestionnaireError />
        </QuestionnaireItem>
      ))}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-muted/70 backdrop-blur-md">
        <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
          <QuestionnairePrevious variant="ghost" size="lg" className="col-start-1 justify-self-start">
            Previous
          </QuestionnairePrevious>
          <span className="col-start-1 row-start-1 hidden justify-self-center text-xs text-muted-foreground sm:inline">
            1–{Math.max(2, Math.min(9, Math.max(...questions.map((q) => q.options.length))))} to choose · Enter to continue
          </span>
          <QuestionnaireNext size="lg" className="col-start-2 row-start-1">
            Next
          </QuestionnaireNext>
          <QuestionnaireSubmit size="lg" className="col-start-2 row-start-1" disabled={stage.kind === 'submitting'}>
            {stage.kind === 'submitting' && <Spinner />}
            Submit answers
          </QuestionnaireSubmit>
        </div>
      </div>
    </Questionnaire>
    </AnsweringQuestionnaire>
  );
}

/**
 * The questionnaire handles its 1–9 / Enter shortcuts on the form, so they only
 * work while focus is inside it. Focus the active question when the quiz starts,
 * and bring focus back if it drops to the page (e.g. after clicking blank space).
 */
function AnsweringQuestionnaire({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    const focusActive = () =>
      host?.querySelector<HTMLElement>('[data-slot=questionnaire-item]:not([hidden])')?.focus({ preventScroll: true });
    focusActive();
    // Fallback when focus has left the quiz: act on the visible controls directly.
    const onKey = (e: KeyboardEvent) => {
      // Only when the key press started outside the quiz; otherwise the questionnaire handles it.
      if (!host || e.defaultPrevented || host.contains(e.target as Node) || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = host.querySelector<HTMLElement>('[data-slot=questionnaire-item]:not([hidden])');
      if (e.key === 'Enter') {
        e.preventDefault();
        host.querySelector<HTMLButtonElement>('[data-slot=questionnaire-next]:not([hidden]), [data-slot=questionnaire-submit]:not([hidden])')?.click();
      } else if (/^[1-9]$/.test(e.key) && active) {
        const inputs = active.querySelectorAll<HTMLInputElement>('[data-slot=questionnaire-choice-input]');
        const target = inputs[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          target.click();
          target.focus({ preventScroll: true });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

/** Uxcel-style segmented bar, driven by the questionnaire's own progress state. */
function QuizProgress({ questions }: { questions: QuizQuestion[] }) {
  return (
    <QuestionnaireProgress
      className="w-full min-w-0"
      render={(props, state) => (
        <div {...props} className="flex w-full items-center gap-1.5">
          {questions.map((q, i) => (
            <span
              key={q.id}
              className={cn('h-1.5 flex-1 rounded-full transition-colors', i < Number(state.current) ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      )}
    />
  );
}

function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <LightbulbIcon aria-hidden />
      <AlertDescription className="text-inherit">{text}</AlertDescription>
    </Alert>
  ) : (
    <Button variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground hover:bg-transparent" onClick={() => setOpen(true)}>
      <LightbulbIcon data-icon="inline-start" aria-hidden /> Show hint
    </Button>
  );
}

function QuestionBody({ question: q }: { question: QuizQuestion }) {
  if (q.type === 'SELECT_ONE_IN_LOT' || q.type === 'SELECT_MANY_IN_LOT') {
    return (
      <QuestionnaireChoices>
        {q.options.map((o) => (
          <QuestionnaireChoice key={o.id} value={o.id} className="min-h-12 rounded-xl bg-card text-base">
            {o.text}
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
    );
  }
  if (q.type === 'NUMERIC_ANSWER_TYPE') {
    return <QuestionnaireInput type="number" step="any" inputMode="decimal" aria-label="Your answer" placeholder="Type a number" className="h-12 max-w-xs text-base" />;
  }
  if (q.type === 'DESCRIPTIVE') {
    return <QuestionnaireInput type="text" aria-label="Your answer" placeholder="Type your answer" className="h-12 text-base" />;
  }
  if (q.type === 'ORDER_THE_LOTS') return <OrderList options={q.options} />;
  return <p className="text-sm text-muted-foreground">This question type isn’t supported yet.</p>;
}

/** "Put in order" — up/down buttons (keyboard friendly); hidden inputs carry the order. */
function OrderList({ options }: { options: QuizQuestion['options'] }) {
  const [order, setOrder] = useState(options);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => setOrder(options), [options]);
  const move = (index: number, delta: number) => {
    const movedId = order[index]?.id;
    // Keep focus on the moved item (its other arrow if this one becomes disabled).
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-item-id="${movedId}"]`);
      const preferred = row?.querySelector<HTMLButtonElement>(delta < 0 ? '[data-dir=up]' : '[data-dir=down]');
      (preferred && !preferred.disabled ? preferred : row?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    });
    setOrder((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // Enter means "next question" everywhere in the quiz; on these buttons only Space moves.
  const enterGoesForward = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const form = e.currentTarget.closest('form');
    form?.querySelector<HTMLButtonElement>('[data-slot=questionnaire-next]:not([hidden]), [data-slot=questionnaire-submit]:not([hidden])')?.click();
  };

  return (
    <>
    {/* The questionnaire only counts answers from its own inputs, so the current order lives here. */}
    <QuestionnaireInput type="text" readOnly value={order.map((o) => o.id).join(',')} aria-label="Current order" tabIndex={-1} className="sr-only" />
    <ol ref={listRef} className="flex flex-col gap-2" aria-label="Order the items">
      {order.map((o, i) => (
        <Item key={o.id} data-item-id={o.id} variant="outline" size="sm" className="bg-card text-base shadow-xs" render={<li />}>
          <ItemMedia variant="icon" className="font-mono text-xs font-medium">
            {i + 1}
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-base font-normal">{o.text}</ItemTitle>
          </ItemContent>
          <Button type="button" variant="ghost" size="icon-sm" data-dir="up" aria-label={`Move “${o.text}” up`} disabled={i === 0} onClick={() => move(i, -1)} onKeyDown={enterGoesForward}>
            <ArrowUpIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" data-dir="down" aria-label={`Move “${o.text}” down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} onKeyDown={enterGoesForward}>
            <ArrowDownIcon />
          </Button>
        </Item>
      ))}
    </ol>
    </>
  );
}

function QuizIntro({ item, details, starting, error, onStart }: { item: LessonItem; details: QuizDetails; starting: boolean; error: string | null; onStart: () => void }) {
  const mins = minutes(details.approximateTimeToComplete);
  const meta = [
    details.questionVisibility ? { icon: ListChecksIcon, text: `${details.questionVisibility} questions` } : null,
    mins ? { icon: ClockIcon, text: `About ${mins} min` } : null,
    { icon: TargetIcon, text: `Pass mark ${Math.round((details.passThreshold ?? 0) * 100)}%` },
    { icon: RotateCcwIcon, text: details.maxAttempts === -1 ? 'Unlimited attempts' : `${details.maxAttempts} attempt${details.maxAttempts === 1 ? '' : 's'}` },
  ].filter(Boolean) as { icon: typeof ClockIcon; text: string }[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card className="px-6 sm:px-8 sm:py-8">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Quiz</p>
        <h1 className="mt-1 font-aleo text-3xl tracking-tight">{item.name}</h1>
        {item.description && item.description !== item.name && <p className="mt-2 text-muted-foreground">{item.description}</p>}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {meta.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm">
              <Icon className="size-4 text-primary" aria-hidden /> {text}
            </li>
          ))}
        </ul>
        <Alert className="mt-6 bg-muted/50">
          <KeyboardIcon aria-hidden />
          <AlertDescription>
            <span>
              Press <Kbd>1</Kbd>–<Kbd>9</Kbd> to pick an answer and <Kbd>Enter</Kbd> to continue.
            </span>
          </AlertDescription>
        </Alert>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={onStart} disabled={starting}>
          {starting && <Spinner />}
          Start quiz
        </Button>
      </Card>
    </div>
  );
}

function QuizReview({
  details,
  questions,
  result,
  onRetry,
  onContinue,
  onExit,
}: {
  details: QuizDetails;
  questions: QuizQuestion[];
  result: QuizResult;
  onRetry: () => void;
  onContinue: () => void;
  onExit: () => void;
}) {
  const passed = result.gradingStatus === 'PASSED';
  const pending = result.gradingStatus === 'PENDING';
  const pct = result.totalMaxScore ? Math.round(((result.totalScore ?? 0) / result.totalMaxScore) * 100) : null;
  const feedbackFor = (id: string) => result.overallFeedback.find((f) => f.questionId === id);
  const showDetails = details.showCorrectAnswersAfterSubmission || details.showExplanationAfterSubmission;

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-10 pb-32">
        <div className="text-center">
          {passed ? (
            <CheckCircle2Icon className="mx-auto size-12 text-emerald-600" aria-hidden />
          ) : (
            <XCircleIcon className={cn('mx-auto size-12', pending ? 'text-amber-500' : 'text-red-500')} aria-hidden />
          )}
          <h1 className="mt-3 font-aleo text-3xl tracking-tight">{passed ? 'Quiz passed' : pending ? 'Submitted for review' : 'Not passed yet'}</h1>
          {details.showScoreAfterSubmission !== false && pct !== null && (
            <p className="mt-2 text-muted-foreground">
              You scored <span className="font-semibold text-foreground">{pct}%</span> ({result.totalScore} of {result.totalMaxScore} points) · pass mark{' '}
              {Math.round((details.passThreshold ?? 0) * 100)}%
            </p>
          )}
        </div>

        <ol className="mt-8 flex flex-col gap-3" aria-label="Your answers">
          {questions.map((q, i) => {
            const f = feedbackFor(q.id);
            const ok = f?.status === 'CORRECT';
            const partial = f?.status === 'PARTIAL';
            return (
              <li key={q.id}>
                <Card size="sm" className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}.</span> {q.text}
                  </p>
                  {f && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 border-transparent',
                        ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : partial ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
                      )}
                    >
                      {ok ? 'Correct' : partial ? 'Partly correct' : 'Incorrect'}
                    </Badge>
                  )}
                </div>
                {showDetails && f?.answerFeedback && <p className="mt-2 text-sm text-muted-foreground">{f.answerFeedback}</p>}
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={cn('fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md', passed ? 'border-emerald-600/20 bg-emerald-50/90 dark:bg-emerald-950/60' : 'border-red-600/20 bg-red-50/90 dark:bg-red-950/50')}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <span className={cn('inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold', passed ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-red-500 text-red-700 dark:text-red-300')}>
            {passed ? <CheckCircle2Icon className="size-4" aria-hidden /> : <XCircleIcon className="size-4" aria-hidden />}
            {passed ? 'Passed!' : 'Try again'}
          </span>
          {passed ? (
            <Button size="lg" onClick={onContinue} autoFocus>
              Continue
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="lg" variant="ghost" onClick={onExit}>
                Back to course
              </Button>
              <Button size="lg" onClick={onRetry} autoFocus>
                <RotateCcwIcon /> Retry quiz
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
