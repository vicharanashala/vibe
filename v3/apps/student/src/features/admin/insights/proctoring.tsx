import { ShieldOffIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

import { INCIDENT_TYPES } from '../course-integrity';
import type { IncidentType } from '../integrity-api';

import { Bar as Fill } from './bars';
import { ChartPanel } from './chart-panel';
import { count, longDay, percent, shortDay } from './format';
import type { CourseInsights } from './types';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const label = (type: string) =>
  INCIDENT_TYPES[type as IncidentType]?.label ??
  type.toLowerCase().replace(/_/g, ' ');

/** Incidents per 100 learning hours by type, per day; at most 4 types plus "Other". */
export function ProctoringInsights({
  proctoring,
  range,
}: {
  proctoring: NonNullable<CourseInsights['proctoring']>;
  range: number;
}) {
  const totals = new Map<string, number>();
  for (const d of proctoring.daily)
    for (const [t, v] of Object.entries(d.per100Hours))
      totals.set(t, (totals.get(t) ?? 0) + (v ?? 0));
  const ranked = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const anyIncidents = ranked.length > 0;

  if (!proctoring.checksOn && !anyIncidents) {
    return (
      <ChartPanel
        title="Proctoring"
        summary="Proctoring is off for this course, so there are no incidents to show."
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldOffIcon aria-hidden className="size-4" /> Turn checks on in the
          Proctoring tab to see incident trends here.
        </p>
      </ChartPanel>
    );
  }

  const shown = ranked.slice(0, ranked.length > 5 ? 4 : 5).map(([t]) => t);
  const key = (t: string) => `t_${t}`;
  const config: ChartConfig = Object.fromEntries(
    shown.map((t, i) => [key(t), { label: label(t), color: COLORS[i] }]),
  );
  if (ranked.length > shown.length)
    config.other = { label: 'Other', color: 'var(--muted-foreground)' };
  const data = proctoring.daily.map((d) => {
    const row: Record<string, number | string> = { day: d.day };
    let other = 0;
    for (const [t, v] of Object.entries(d.per100Hours)) {
      if (shown.includes(t)) row[key(t)] = Math.round((v ?? 0) * 10) / 10;
      else other += v ?? 0;
    }
    if (config.other) row.other = Math.round(other * 10) / 10;
    return row;
  });
  const series = Object.keys(config);
  const maxAvg =
    Math.max(0, ...ranked.map(([, v]) => v)) /
    Math.max(1, proctoring.daily.length);

  return (
    <ChartPanel
      title="Proctoring"
      summary={
        anyIncidents
          ? `${percent(proctoring.shareWithIncident)} of students had an incident in the last ${range} days. Most common: ${label(ranked[0][0]).toLowerCase()}.`
          : `No incidents in the last ${range} days.`
      }
      table={{
        caption: 'Incidents per 100 learning hours, by day and type',
        columns: ['Day', ...series.map((s) => String(config[s].label))],
        rows: data.map((r) => [
          longDay(String(r.day)),
          ...series.map((s) => Number(r[s] ?? 0)),
        ]),
      }}
    >
      {anyIncidents && (
        <ul className="mb-4 grid gap-2.5" aria-label="Incidents by type">
          {series.map((s, i) => {
            const total =
              s === 'other'
                ? ranked.slice(shown.length).reduce((a, [, v]) => a + v, 0)
                : (totals.get(s.slice(2)) ?? 0);
            const avg = total / Math.max(1, proctoring.daily.length);
            return (
              <li key={s} className="text-sm">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: String(config[s].color) }}
                    />
                    <span className="truncate">{String(config[s].label)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <span className="font-semibold text-foreground">
                      {(Math.round(avg * 10) / 10).toLocaleString()}
                    </span>{' '}
                    per 100 h
                  </span>
                </span>
                <Fill
                  value={avg / Math.max(1e-9, maxAvg)}
                  color={String(config[s].color)}
                  className="mt-1.5"
                />
                {i === 0 && <span className="sr-only">Most common</span>}
              </li>
            );
          })}
        </ul>
      )}
      <ChartContainer config={config} className="aspect-auto h-36 w-full">
        <BarChart
          data={data}
          margin={{ left: 4, right: 4, top: 8 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={shortDay}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={30}
            fontSize={11}
            tickCount={3}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(v) => `${longDay(String(v))} · per 100 h`}
              />
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="incidents"
              fill={`var(--color-${s})`}
              radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

/** How many students use strict mode only, study mode only, or both. */
export function StudyModeSplit({
  studyMode,
}: {
  studyMode: NonNullable<CourseInsights['studyMode']>;
}) {
  const parts = [
    {
      key: 'strict',
      label: 'Strict mode only',
      value: studyMode.strictOnly,
      className: 'bg-emerald-500',
    },
    {
      key: 'both',
      label: 'Both',
      value: studyMode.both,
      className: 'bg-teal-400',
    },
    {
      key: 'study',
      label: 'Study mode only',
      value: studyMode.studyOnly,
      className: 'bg-sky-500',
    },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <ChartPanel
      title="Study mode and strict mode"
      summary={
        total
          ? `${count(studyMode.studyOnly + studyMode.both, 'student')} have used study mode; ${studyMode.both.toLocaleString()} use both.`
          : 'No student has started a lesson yet.'
      }
    >
      {total > 0 && (
        <>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            {parts.map((p) =>
              p.value ? (
                <span
                  key={p.key}
                  className={p.className}
                  style={{ width: `${(p.value / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            {parts.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${p.className}`}
                  aria-hidden
                />
                <span className="text-muted-foreground">{p.label}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {p.value.toLocaleString()}
                </span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round((p.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartPanel>
  );
}
