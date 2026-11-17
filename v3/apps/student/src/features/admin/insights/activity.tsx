import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ChartPanel, SrTable } from './chart-panel';
import {
  count,
  days,
  hourLabel,
  hours,
  longDay,
  shortDay,
  WEEKDAYS,
} from './format';
import { TrendBadge } from './trend';
import type { CourseInsights, Metric } from './types';

type Daily = NonNullable<CourseInsights['daily']>;
type Headline = NonNullable<CourseInsights['headline']>;

export type ActivityMetric = 'active' | 'hours' | 'enrolments' | 'students';

interface MetricDef {
  key: ActivityMetric;
  label: string;
  /** What the chart shows when this tile is selected. */
  series: string;
  value: string;
  metric?: Metric;
  format?: (n: number) => string;
  points: (daily: Daily, headline: Headline) => number[];
}

const num = (n: number) => n.toLocaleString();
const show = (m: Metric, f: (n: number) => string) =>
  m.current == null ? '–' : f(m.current);

function metricDefs(daily: Daily, headline: Headline): MetricDef[] {
  const enrolled = daily.reduce((s, d) => s + d.newEnrolments, 0);
  return [
    {
      key: 'active',
      label: 'Active this week',
      series: 'Active students per day',
      value: show(headline.activeThisWeek, num),
      metric: headline.activeThisWeek,
      points: (d) => d.map((x) => x.activeLearners),
    },
    {
      key: 'hours',
      label: 'Learning hours',
      series: 'Learning hours per day',
      value: show(headline.learningHours, hours),
      metric: headline.learningHours,
      format: hours,
      points: (d) => d.map((x) => x.learningHours),
    },
    {
      key: 'enrolments',
      label: 'New enrolments',
      series: 'New enrolments per day',
      value: num(enrolled),
      points: (d) => d.map((x) => x.newEnrolments),
    },
    {
      key: 'students',
      label: 'Students',
      series: 'Enrolled students',
      value: show(headline.students, num),
      metric: headline.students,
      // The roster on each day: today's total minus everyone who joined after it.
      points: (d, h) => {
        let total = h.students.current ?? 0;
        const out: number[] = new Array(d.length);
        for (let i = d.length - 1; i >= 0; i--) {
          out[i] = total;
          total -= d[i].newEnrolments;
        }
        return out.map((v) => Math.max(0, v));
      },
    },
  ];
}

/**
 * The Overview's hero (Plausible/Spotify-style): metric tiles that pick what
 * the one chart below shows, and the course's progress figures underneath.
 */
export function ActivityHero({
  daily,
  headline,
  range,
}: {
  daily: Daily;
  headline: Headline;
  range: number;
}) {
  const [selected, setSelected] = useState<ActivityMetric>('active');
  const defs = useMemo(() => metricDefs(daily, headline), [daily, headline]);
  const def = defs.find((d) => d.key === selected) ?? defs[0];
  const id = useId();

  const points = def.points(daily, headline);
  const data = daily.map((d, i) => ({ day: d.day, value: points[i] }));
  const config = {
    value: { label: def.series, color: 'var(--chart-1)' },
  } satisfies ChartConfig;

  const peak = daily.reduce(
    (best, d) => (d.activeLearners > (best?.activeLearners ?? -1) ? d : best),
    daily[0],
  );

  return (
    <Card size="sm" className="min-w-0 gap-0 rounded-2xl bg-card py-0 data-[size=sm]:py-0">
      <div
        role="group"
        aria-label="Chart metric"
        className="relative flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto p-3 [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:p-4"
      >
        {defs.map((d) => {
          const on = d.key === selected;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(d.key)}
              className={cn(
                'relative min-w-[9.25rem] shrink-0 snap-start rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-w-0',
                on
                  ? 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted/60',
              )}
            >
              <span
                className={cn(
                  'block truncate text-xs font-medium',
                  on ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {d.label}
              </span>
              <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {d.value}
                </span>
                {d.metric && <TrendBadge metric={d.metric} format={d.format} />}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="figure"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        className="min-w-0 border-t border-border/70 px-3 pt-3 pb-2 sm:px-5 sm:pt-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 id={`${id}-t`} className="text-sm font-semibold">
            Daily activity
          </h3>
          <p className="text-xs text-muted-foreground">
            <span className="sr-only">Showing </span>
            {def.series}
          </p>
        </div>
        <p id={`${id}-d`} className="mt-0.5 text-xs text-muted-foreground">
          {peak && peak.activeLearners > 0
            ? `Busiest day: ${shortDay(peak.day)}, with ${count(peak.activeLearners, 'active student')}.`
            : `No learning recorded in the last ${range} days.`}
        </p>
        <ChartContainer
          config={config}
          className="mt-3 aspect-auto h-44 w-full sm:h-60"
        >
          <AreaChart
            data={data}
            margin={{ left: 0, right: 4, top: 4 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-value)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              fontSize={11}
              tickFormatter={shortDay}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={30}
              fontSize={11}
              tickCount={4}
              allowDecimals={selected === 'hours'}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--border)' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => longDay(String(v))}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill={`url(#${id}-fill)`}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
        <SrTable
          caption="Active students, learning hours and new enrolments per day"
          columns={['Day', 'Active students', 'Learning hours', 'New enrolments']}
          rows={daily.map((d) => [
            longDay(d.day),
            d.activeLearners,
            d.learningHours,
            d.newEnrolments,
          ])}
        />
      </div>

      <KeyStats headline={headline} />
    </Card>
  );
}

/**
 * Average progress, finished and median time to finish: a list on a phone
 * (label left, figure right), three columns from `sm` up.
 */
export function KeyStats({ headline }: { headline: Headline }) {
  const pct = (n: number) => `${Math.round(n)}%`;
  const pts = (n: number) => `${Math.round(n)} pts`;
  const stats = [
    {
      label: 'Average progress',
      value: show(headline.averageProgress, pct),
      trend: <TrendBadge metric={headline.averageProgress} format={pts} />,
    },
    {
      label: 'Finished',
      value: show(headline.finished, num),
      trend: <TrendBadge metric={headline.finished} />,
    },
    {
      label: 'Median time to finish',
      value: show(headline.medianDaysToFinish, days),
      trend: (
        <TrendBadge
          metric={headline.medianDaysToFinish}
          format={days}
          lowerIsBetter
        />
      ),
    },
  ];
  return (
    <dl className="grid divide-y divide-border/70 border-t border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:px-5"
        >
          <dt className="text-xs font-medium text-muted-foreground">
            {s.label}
          </dt>
          <dd className="flex items-baseline gap-2 sm:mt-1">
            <span className="text-base font-semibold tabular-nums sm:text-lg">
              {s.value}
            </span>
            {s.trend}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Heat colour for a cell's share (0–1) of the busiest hour. */
const heat = (share: number) =>
  share > 0
    ? `color-mix(in oklch, var(--chart-1) ${Math.round(18 + share * 82)}%, transparent)`
    : 'var(--muted)';

/**
 * When students study: learning hours by IST weekday × hour. Each cell is a
 * focusable button whose value shows in a tooltip and is its accessible name.
 */
export function StudyHeatmap({ heatmap }: { heatmap: number[][] }) {
  const max = Math.max(0, ...heatmap.flat());
  let peak = { day: 0, hour: 0, value: 0 };
  heatmap.forEach((row, day) =>
    row.forEach((value, hour) => {
      if (value > peak.value) peak = { day, hour, value };
    }),
  );
  return (
    <ChartPanel
      title="When students study"
      summary={
        max > 0
          ? `Busiest hour: ${WEEKDAYS[peak.day]}s ${hourLabel(peak.hour)}–${hourLabel((peak.hour + 1) % 24)} IST, with ${hours(peak.value)}.`
          : 'No learning recorded in this period.'
      }
    >
      <div className="grid grid-cols-[1.25rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-muted-foreground">
        {heatmap.map((row, day) => (
          <div key={day} className="contents">
            <span className="self-center" aria-hidden>
              {WEEKDAYS[day][0]}
            </span>
            {row.map((value, hour) => {
              const label = `${WEEKDAYS[day]} ${hourLabel(hour)}: ${hours(value)}`;
              return (
                <Tooltip key={hour}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={label}
                        data-value={value}
                        className="aspect-square rounded-[2px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring"
                        style={{ background: heat(max ? value / max : 0) }}
                      />
                    }
                  />
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="pt-1 text-center tabular-nums" aria-hidden>
            {h % 6 === 0 ? h : ''}
          </span>
        ))}
      </div>
      <div
        className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground"
        aria-hidden
      >
        <span>Hour of day, IST</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 0.25, 0.5, 0.75, 1].map((s) => (
            <span
              key={s}
              className="size-2.5 rounded-[2px]"
              style={{ background: heat(s) }}
            />
          ))}
          More
        </span>
      </div>
    </ChartPanel>
  );
}
