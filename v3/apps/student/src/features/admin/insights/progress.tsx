import { TrendingDownIcon } from 'lucide-react';
import { Fragment } from 'react';

import { BarList, BarRow, type BarTone } from './bars';
import { ChartPanel } from './chart-panel';
import { count } from './format';
import type { CourseInsights, ProgressBand } from './types';

const BAND_LABELS: Record<ProgressBand, string> = {
  '0': 'Not started',
  '1-24': '1–24%',
  '25-49': '25–49%',
  '50-74': '50–74%',
  '75-99': '75–99%',
  finished: 'Finished',
};
const BAND_ORDER: ProgressBand[] = [
  '0',
  '1-24',
  '25-49',
  '50-74',
  '75-99',
  'finished',
];
const BAND_TONE: Partial<Record<ProgressBand, BarTone>> = {
  '0': 'muted',
  finished: 'good',
};

/** How far students have got, in bands. */
export function ProgressBands({
  bands,
}: {
  bands: NonNullable<CourseInsights['progressBands']>;
}) {
  const data = BAND_ORDER.map((band) => ({
    band,
    label: BAND_LABELS[band],
    students: bands.find((b) => b.band === band)?.students ?? 0,
  }));
  const total = data.reduce((s, d) => s + d.students, 0);
  const max = Math.max(1, ...data.map((d) => d.students));
  return (
    <ChartPanel
      title="Progress"
      summary={
        total
          ? `${data[5].students.toLocaleString()} finished and ${data[0].students.toLocaleString()} not started, of ${count(total, 'student')}.`
          : 'No students yet.'
      }
      table={{
        caption: 'Students by progress',
        columns: ['Progress', 'Students'],
        rows: data.map((d) => [d.label, d.students]),
      }}
    >
      <BarList>
        {data.map((d) => (
          <li key={d.band}>
            <BarRow
              label={d.label}
              value={
                <>
                  {d.students.toLocaleString()}
                  <span className="ml-2 inline-block w-9 text-right text-xs font-normal text-muted-foreground">
                    {total ? Math.round((d.students / total) * 100) : 0}%
                  </span>
                </>
              }
              bar={d.students / max}
              tone={BAND_TONE[d.band] ?? 'primary'}
            />
          </li>
        ))}
      </BarList>
    </ChartPanel>
  );
}

export interface FunnelDrop {
  /** Index of the module students were lost after. */
  from: number;
  lost: number;
}

/** The largest fall from "finished module i" to "reached module i+1", if any students were lost. */
export function biggestDrop(
  funnel: { reached: number; completed: number }[],
): FunnelDrop | null {
  let best: FunnelDrop | null = null;
  for (let i = 0; i + 1 < funnel.length; i++) {
    const lost = funnel[i].completed - funnel[i + 1].reached;
    if (lost > 0 && (!best || lost > best.lost)) best = { from: i, lost };
  }
  return best;
}

/**
 * Module by module: one track per module, its faint part the students who
 * reached it and its solid part those who finished it. The biggest drop
 * between two modules is called out where it happens.
 */
export function ModuleFunnel({
  funnel,
}: {
  funnel: NonNullable<CourseInsights['funnel']>;
}) {
  const drop = biggestDrop(funnel);
  const max = Math.max(1, ...funnel.map((m) => m.reached));
  return (
    <ChartPanel
      title="Module by module"
      summary={
        drop
          ? `Biggest drop: ${count(drop.lost, 'student')} finished “${funnel[drop.from].name}” but haven’t started the next module.`
          : funnel.length
            ? 'No module loses students on the way to the next.'
            : 'This course has no modules yet.'
      }
      table={{
        caption: 'Students who reached and finished each module',
        columns: ['Module', 'Reached', 'Finished'],
        rows: funnel.map((m, i) => [`${i + 1}. ${m.name}`, m.reached, m.completed]),
      }}
    >
      <BarList>
        {funnel.map((m, i) => (
          <Fragment key={m.moduleId}>
            {drop && i === drop.from + 1 && (
              <li
                data-testid="funnel-drop"
                className="flex items-center gap-2 py-2 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                <TrendingDownIcon aria-hidden className="size-3.5" />−
                {drop.lost.toLocaleString()} between module {drop.from + 1} and
                module {drop.from + 2}
              </li>
            )}
            <li>
              <div className="flex min-w-0 items-start gap-3 py-2.5">
                <span className="mt-px w-4 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {m.completed.toLocaleString()}
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        / {m.reached.toLocaleString()}
                      </span>
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-chart-1/30"
                      style={{ width: `${(m.reached / max) * 100}%` }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-chart-1"
                      style={{ width: `${(m.completed / max) * 100}%` }}
                    />
                  </span>
                </span>
              </div>
            </li>
          </Fragment>
        ))}
      </BarList>
      {funnel.length > 0 && (
        <p
          className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground"
          aria-hidden
        >
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-chart-1" /> Finished
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-chart-1/30" /> Reached
          </span>
        </p>
      )}
    </ChartPanel>
  );
}
