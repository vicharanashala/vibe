import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  RotateCcwIcon,
  SearchIcon,
  XCircleIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { RichText } from '@/components/rich-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ConfirmDialog, ErrorText, formatDate, StatStrip } from '../studio-ui';
import {
  useQuizAnalytics,
  useQuizAttempts,
  useResetQuizAttempts,
  type AttemptSort,
  type DraftQuestion,
  type QuizAttemptResult,
} from './lesson-api';

const pct = (a: QuizAttemptResult) =>
  a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0;
const studentName = (a: QuizAttemptResult) =>
  [a.user.firstName, a.user.lastName].filter(Boolean).join(' ') || 'Student';

/** Pass / fail / pending as icon + label (never colour alone). */
export function AttemptStatus({ status }: { status: string }) {
  if (status === 'PASSED')
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-600/30 text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2Icon aria-hidden /> Passed
      </Badge>
    );
  if (status === 'FAILED')
    return (
      <Badge
        variant="outline"
        className="gap-1 border-destructive/30 text-destructive"
      >
        <XCircleIcon aria-hidden /> Failed
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <ClockIcon aria-hidden /> Grading
    </Badge>
  );
}

/**
 * Teacher view of a quiz's results: a Summary (headline numbers, score
 * distribution, hardest questions) and every submitted Attempt with its
 * per-question breakdown.
 */
export function QuizResults({
  quizId,
  questions,
  passThreshold,
  maxAttempts,
}: {
  quizId: string;
  questions: DraftQuestion[];
  passThreshold: number;
  maxAttempts: number;
}) {
  const [view, setView] = useState<'summary' | 'attempts'>('summary');
  // Every attempt (one large page) feeds the distribution and student counts.
  const all = useQuizAttempts(quizId, { page: 1, limit: 1000 });

  if (all.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (all.isError) return <ErrorText error={all.error} />;
  if (all.data.total === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClockIcon />
          </EmptyMedia>
          <EmptyTitle>No attempts yet</EmptyTitle>
          <EmptyDescription>
            Results appear here once students submit this quiz in certified
            mode.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4">
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as 'summary' | 'attempts')}
      >
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="attempts">
            Attempts{' '}
            <span className="text-muted-foreground tabular-nums">
              {all.data.total}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'summary' ? (
        <ResultsSummary
          quizId={quizId}
          attempts={all.data.attempts}
          questions={questions}
          passThreshold={passThreshold}
        />
      ) : (
        <AttemptsList
          quizId={quizId}
          questions={questions}
          canReset={maxAttempts !== -1}
        />
      )}
    </div>
  );
}

function ResultsSummary({
  quizId,
  attempts,
  questions,
  passThreshold,
}: {
  quizId: string;
  attempts: QuizAttemptResult[];
  questions: DraftQuestion[];
  passThreshold: number;
}) {
  const stats = useQuizAnalytics(quizId);
  const students = new Set(attempts.map((a) => a.userId)).size;

  // Ten 10-point buckets; 100% goes in the last one.
  const buckets = useMemo(() => {
    const b = Array.from({ length: 10 }, (_, i) => ({
      from: i * 10,
      to: i === 9 ? 100 : i * 10 + 9,
      count: 0,
    }));
    for (const a of attempts) b[Math.min(9, Math.floor(pct(a) / 10))].count++;
    return b;
  }, [attempts]);
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const passPct = Math.round(passThreshold * 100);

  const byQuestion = new Map(
    questions.filter((q) => q.id).map((q, i) => [q.id!, { q, n: i + 1 }]),
  );
  const hardest = [...(stats.data?.performance ?? [])].sort(
    (a, b) => a.correctRate - b.correctRate,
  );

  return (
    <div className="grid gap-4">
      <StatStrip
        stats={[
          { label: 'Students', value: students },
          {
            label: 'Attempts',
            value: stats.data?.analytics.totalAttempts ?? attempts.length,
          },
          {
            label: 'Pass rate',
            value: stats.data
              ? `${Math.round(stats.data.analytics.passRate)}%`
              : '–',
          },
          {
            label: 'Average score',
            value: stats.data
              ? `${Math.round(stats.data.analytics.averagePercentage)}%`
              : '–',
          },
        ]}
      />

      <Card className="gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="font-medium">Score distribution</p>
          <p className="text-sm text-muted-foreground">
            How many attempts scored in each range. The dashed line is the pass
            mark ({passPct}%).
          </p>
        </div>
        <div className="relative">
          <div
            role="img"
            aria-label="Score distribution"
            className="flex h-40 items-end gap-0.5"
          >
            {buckets.map((b) => (
              <Tooltip key={b.from}>
                <TooltipTrigger
                  render={
                    <div
                      className="flex h-full flex-1 cursor-default items-end"
                      aria-label={`${b.from}–${b.to}%: ${b.count} ${b.count === 1 ? 'attempt' : 'attempts'}`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-t-[4px] bg-primary transition-opacity hover:opacity-80',
                          b.count === 0 && 'bg-muted',
                        )}
                        style={{
                          height: b.count
                            ? `${(b.count / peak) * 100}%`
                            : '2px',
                        }}
                      />
                    </div>
                  }
                />
                <TooltipContent>
                  {b.from}–{b.to}%: {b.count}{' '}
                  {b.count === 1 ? 'attempt' : 'attempts'}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-foreground/40"
            style={{ left: `${passPct}%` }}
          />
        </div>
        <div
          className="flex justify-between text-xs text-muted-foreground tabular-nums"
          aria-hidden
        >
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </Card>

      <Card className="gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="font-medium">Questions, hardest first</p>
          <p className="text-sm text-muted-foreground">
            Share of attempts that got each question right.
          </p>
        </div>
        {stats.isPending && <Skeleton className="h-24" />}
        <ul className="grid gap-3">
          {hardest.map((p) => {
            const match = byQuestion.get(p.questionId);
            const rate = Math.round(p.correctRate * 100);
            return (
              <li key={p.questionId} className="grid gap-1.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 gap-1.5">
                    <span className="text-muted-foreground tabular-nums">
                      {match ? `${match.n}.` : '•'}
                    </span>
                    {match ? (
                      <RichText
                        text={match.q.text}
                        inline
                        className="line-clamp-2"
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        A question no longer in this quiz
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {rate}% correct
                  </span>
                </div>
                <Progress
                  value={rate}
                  aria-label={`${rate}% correct`}
                  className="h-2"
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

const SORTS: { value: AttemptSort; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'score_desc', label: 'Highest score' },
  { value: 'score_asc', label: 'Lowest score' },
];

function AttemptsList({
  quizId,
  questions,
  canReset,
}: {
  quizId: string;
  questions: DraftQuestion[];
  canReset: boolean;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'PASSED' | 'FAILED'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<AttemptSort>('date_desc');
  const [open, setOpen] = useState<QuizAttemptResult | null>(null);
  const attempts = useQuizAttempts(quizId, {
    page,
    limit: 20,
    status: status === 'all' ? undefined : status,
    search: search.trim() || undefined,
    sort,
  });

  const row = (a: QuizAttemptResult) => ({
    onClick: () => setOpen(a),
    onKeyDown: (e: React.KeyboardEvent) =>
      (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(a)),
    tabIndex: 0,
    role: 'button' as const,
    'aria-label': `${studentName(a)}, ${pct(a)}%, ${a.status.toLowerCase()}: view answers`,
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="PASSED">Passed</TabsTrigger>
            <TabsTrigger value="FAILED">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="min-w-48 flex-1 bg-card sm:max-w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search students"
            placeholder="Search students…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
        <NativeSelect
          aria-label="Sort attempts"
          value={sort}
          onChange={(e) => setSort(e.target.value as AttemptSort)}
        >
          {SORTS.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {attempts.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {attempts.isError && <ErrorText error={attempts.error} />}
      {attempts.data && attempts.data.attempts.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No attempts match.
        </p>
      )}

      {attempts.data && attempts.data.attempts.length > 0 && (
        <>
          {/* Phones: one card per attempt. */}
          <div className="grid gap-3 md:hidden">
            {attempts.data.attempts.map((a) => (
              <Card
                key={a.id}
                {...row(a)}
                className="cursor-pointer gap-3 px-4 py-4"
              >
                <div className="flex items-center gap-2.5">
                  <GeneratedAvatar seed={a.userId} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{studentName(a)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.user.email}
                    </p>
                  </div>
                  <ChevronRightIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm tabular-nums">
                    <span className="font-semibold">{pct(a)}%</span>{' '}
                    <span className="text-muted-foreground">
                      ({a.score}/{a.maxScore})
                    </span>
                  </span>
                  <AttemptStatus status={a.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(a.submittedAt)}
                </p>
              </Card>
            ))}
          </div>
          {/* Larger screens: a table. */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.data.attempts.map((a) => (
                  <TableRow key={a.id} {...row(a)} className="cursor-pointer">
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <GeneratedAvatar seed={a.userId} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {studentName(a)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex w-36 items-center gap-2">
                        <Progress
                          value={pct(a)}
                          className="h-1.5 flex-1"
                          aria-hidden
                        />
                        <span className="w-20 text-right text-sm tabular-nums">
                          {pct(a)}%{' '}
                          <span className="text-xs text-muted-foreground">
                            ({a.score}/{a.maxScore})
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AttemptStatus status={a.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {formatDate(a.submittedAt)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <ChevronRightIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {attempts.data && attempts.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {attempts.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= attempts.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <AttemptSheet
        quizId={quizId}
        attempt={open}
        onClose={() => setOpen(null)}
        questions={questions}
        canReset={canReset}
      />
    </div>
  );
}

function AttemptSheet({
  quizId,
  attempt,
  onClose,
  questions,
  canReset,
}: {
  quizId: string;
  attempt: QuizAttemptResult | null;
  onClose: () => void;
  questions: DraftQuestion[];
  canReset: boolean;
}) {
  const reset = useResetQuizAttempts(quizId);
  const [confirming, setConfirming] = useState(false);
  const byId = new Map(
    questions.filter((q) => q.id).map((q, i) => [q.id!, { q, n: i + 1 }]),
  );

  return (
    <Sheet open={!!attempt} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {attempt && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <GeneratedAvatar seed={attempt.userId} size={40} />
                <div className="min-w-0">
                  <SheetTitle className="truncate">
                    {studentName(attempt)}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {attempt.user.email}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold tabular-nums">
                  {pct(attempt)}%
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {attempt.score} of {attempt.maxScore} points
                </span>
                <AttemptStatus status={attempt.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted {formatDate(attempt.submittedAt)}
              </p>
            </SheetHeader>
            <ol className="grid gap-3 px-4 pb-4">
              {[...attempt.questions]
                // Quiz order, not the order this student happened to see them in.
                .sort(
                  (x, y) =>
                    (byId.get(x.questionId)?.n ?? 99) -
                    (byId.get(y.questionId)?.n ?? 99),
                )
                .map((r, i) => {
                  const match = byId.get(r.questionId);
                  const correct = r.status === 'CORRECT';
                  const partial =
                    r.status === 'PARTIAL' || r.status === 'PARTIALLY_CORRECT';
                  return (
                    <li key={`${r.questionId}-${i}`}>
                      <Card className="gap-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3 text-sm">
                          <span className="flex min-w-0 gap-1.5">
                            <span className="text-muted-foreground tabular-nums">
                              {match ? match.n : i + 1}.
                            </span>
                            {match ? (
                              <RichText text={match.q.text} inline />
                            ) : (
                              <span className="text-muted-foreground">
                                A question no longer in this quiz
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {r.score} pts
                          </span>
                        </div>
                        <p
                          className={cn(
                            'flex items-center gap-1.5 text-sm font-medium',
                            correct
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : partial
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-destructive',
                          )}
                        >
                          {correct ? (
                            <CheckCircle2Icon className="size-4" aria-hidden />
                          ) : (
                            <XCircleIcon className="size-4" aria-hidden />
                          )}
                          {correct
                            ? 'Correct'
                            : partial
                              ? 'Partly correct'
                              : 'Incorrect'}
                        </p>
                        {r.feedback && (
                          <p className="text-sm text-muted-foreground">
                            {r.feedback}
                          </p>
                        )}
                      </Card>
                    </li>
                  );
                })}
            </ol>
            {canReset && (
              <SheetFooter>
                <Button variant="outline" onClick={() => setConfirming(true)}>
                  <RotateCcwIcon aria-hidden /> Reset attempts
                </Button>
              </SheetFooter>
            )}
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={`Reset ${studentName(attempt)}’s attempts?`}
              description="They get their full number of attempts again. Their past attempts stay in the results."
              confirmLabel="Reset attempts"
              destructive={false}
              onConfirm={async () => {
                await reset.mutateAsync(attempt.userId);
                toast.success('Attempts reset.');
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
