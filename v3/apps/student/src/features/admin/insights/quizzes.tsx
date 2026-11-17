import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { BarRow, ShowMoreList, type BarTone } from './bars';
import { ChartPanel } from './chart-panel';
import { count, percent } from './format';
import type { QuizInsight } from './types';

/** Lowest first-attempt pass rate first; quizzes nobody has attempted go last. */
export function sortQuizzes(quizzes: QuizInsight[]) {
  return [...quizzes].sort(
    (a, b) => (a.firstAttemptPassRate ?? 2) - (b.firstAttemptPassRate ?? 2),
  );
}

const passTone = (rate: number | null): BarTone =>
  rate == null ? 'muted' : rate < 0.5 ? 'bad' : rate < 0.75 ? 'warn' : 'good';

const attempts = (n: number) =>
  `${(Math.round(n * 10) / 10).toLocaleString()} ${n === 1 ? 'try' : 'tries'} to pass`;

/** Every quiz's first-attempt pass rate and attempts needed, hardest first. Each opens its detail. */
export function QuizInsights({ quizzes }: { quizzes: QuizInsight[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = sortQuizzes(quizzes);
  const hardest = sorted.find((q) => q.firstAttemptPassRate != null);
  const open = sorted.find((q) => q.itemId === openId) ?? null;
  return (
    <ChartPanel
      title="Quizzes"
      summary={
        hardest
          ? `Hardest: “${hardest.name}”, ${percent(hardest.firstAttemptPassRate ?? 0)} pass first time.`
          : quizzes.length
            ? 'No quiz has been attempted yet.'
            : 'This course has no quizzes.'
      }
    >
      {sorted.length > 0 && (
        <>
          <p className="mb-1 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Quiz</span>
            <span>Passed first time</span>
          </p>
          <ShowMoreList
            items={sorted}
            noun="quizzes"
            render={(q) => (
              <li key={q.itemId}>
                <BarRow
                  onClick={() => setOpenId(q.itemId)}
                  actionLabel={`${q.name}: details`}
                  label={q.name}
                  value={
                    q.firstAttemptPassRate == null
                      ? '–'
                      : percent(q.firstAttemptPassRate)
                  }
                  bar={q.firstAttemptPassRate ?? 0}
                  tone={passTone(q.firstAttemptPassRate)}
                  detail={[
                    `${count(q.attempted, 'student')} attempted`,
                    q.avgAttemptsToPass != null && attempts(q.avgAttemptsToPass),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </li>
            )}
          />
        </>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <QuizDetail quiz={open} />}
        </SheetContent>
      </Sheet>
    </ChartPanel>
  );
}

const scoreConfig = {
  students: { label: 'Students', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function QuizDetail({ quiz }: { quiz: QuizInsight }) {
  const data = quiz.scoreBands.map((students, i) => ({
    band: i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`,
    students,
  }));
  return (
    <>
      <SheetHeader>
        <SheetTitle>{quiz.name}</SheetTitle>
        <SheetDescription>
          {count(quiz.attempted, 'student')} attempted ·{' '}
          {quiz.firstAttemptPassRate == null
            ? 'nobody passed yet'
            : `${percent(quiz.firstAttemptPassRate)} passed first time`}
          {quiz.avgAttemptsToPass != null &&
            ` · ${(Math.round(quiz.avgAttemptsToPass * 10) / 10).toLocaleString()} attempts to pass on average`}
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 px-4 pb-6">
        <section aria-labelledby="score-dist">
          <h3 id="score-dist" className="mb-2 text-sm font-semibold">
            First-attempt scores
          </h3>
          <ChartContainer
            config={scoreConfig}
            className="aspect-auto h-44 w-full"
          >
            <BarChart
              data={data}
              margin={{ left: 0, right: 4, top: 8 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="band"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                interval={1}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={24}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => `Score ${v}%`}
                    hideIndicator
                  />
                }
              />
              <Bar
                dataKey="students"
                fill="var(--color-students)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
          <div className="sr-only">
            <table>
              <caption>Students by first-attempt score</caption>
              <tbody>
                {data.map((d) => (
                  <tr key={d.band}>
                    <th scope="row">{d.band}%</th>
                    <td>{d.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="hardest-q">
          <h3 id="hardest-q" className="mb-2 text-sm font-semibold">
            Hardest questions
          </h3>
          {quiz.hardestQuestions.length ? (
            <ol className="grid gap-3">
              {quiz.hardestQuestions.map((q) => (
                <li
                  key={q.questionId}
                  className="rounded-xl border border-border p-3"
                >
                  <p className="text-sm">{q.text}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={Math.round(q.correctRate * 100)}
                      className="flex-1"
                      aria-label={`${percent(q.correctRate)} answered correctly`}
                    />
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {percent(q.correctRate)} correct ·{' '}
                      {count(q.answered, 'answer')}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No answers yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
