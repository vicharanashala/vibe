import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { ChartPanel } from './chart-panel';
import { count, hourLabel, hours, longDay, shortDay, WEEKDAYS, WEEKDAYS_SHORT } from './format';
import type { CourseInsights } from './types';

type Daily = NonNullable<CourseInsights['daily']>;

const activityConfig = {
  activeLearners: { label: 'Active students', color: 'var(--chart-1)' },
  learningHours: { label: 'Learning hours', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const enrolConfig = { newEnrolments: { label: 'New enrolments', color: 'var(--chart-2)' } } satisfies ChartConfig;

/** Daily active students and learning hours, on their own axes. */
export function ActivityChart({ daily, range }: { daily: Daily; range: number }) {
  const peak = daily.reduce((best, d) => (d.activeLearners > (best?.activeLearners ?? -1) ? d : best), daily[0]);
  const totalHours = daily.reduce((s, d) => s + d.learningHours, 0);
  return (
    <ChartPanel
      title="Daily activity"
      summary={
        peak && peak.activeLearners > 0
          ? `${hours(totalHours)} of learning in the last ${range} days. Busiest day: ${longDay(peak.day)}, with ${count(peak.activeLearners, 'active student')}.`
          : `No learning recorded in the last ${range} days.`
      }
      table={{
        caption: 'Active students and learning hours per day',
        columns: ['Day', 'Active students', 'Learning hours'],
        rows: daily.map((d) => [longDay(d.day), d.activeLearners, d.learningHours]),
      }}
    >
      <ChartContainer config={activityConfig} className="aspect-auto h-56 w-full">
        <AreaChart data={daily} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
          <defs>
            <linearGradient id="fill-active" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-activeLearners)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-activeLearners)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDay} />
          <YAxis yAxisId="students" tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <YAxis yAxisId="hours" orientation="right" tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => longDay(String(v))} indicator="dot" />} />
          <Area
            yAxisId="students"
            dataKey="activeLearners"
            type="monotone"
            stroke="var(--color-activeLearners)"
            strokeWidth={2}
            fill="url(#fill-active)"
          />
          <Area
            yAxisId="hours"
            dataKey="learningHours"
            type="monotone"
            stroke="var(--color-learningHours)"
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="transparent"
          />
        </AreaChart>
      </ChartContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-chart-1" /> Active students (left axis)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-chart-3" /> Learning hours (right axis)
        </li>
      </ul>
    </ChartPanel>
  );
}

/** New enrolments per day. */
export function EnrolmentsChart({ daily, range }: { daily: Daily; range: number }) {
  const total = daily.reduce((s, d) => s + d.newEnrolments, 0);
  return (
    <ChartPanel
      title="New enrolments"
      summary={total ? `${count(total, 'student')} joined in the last ${range} days.` : `Nobody joined in the last ${range} days.`}
      table={{
        caption: 'New enrolments per day',
        columns: ['Day', 'New enrolments'],
        rows: daily.map((d) => [longDay(d.day), d.newEnrolments]),
      }}
    >
      <ChartContainer config={enrolConfig} className="aspect-auto h-44 w-full">
        <BarChart data={daily} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDay} />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => longDay(String(v))} hideIndicator />} />
          <Bar dataKey="newEnrolments" fill="var(--color-newEnrolments)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

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
      <div className="grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-muted-foreground">
        {heatmap.map((row, day) => (
          <div key={day} className="contents">
            <span className="self-center pr-1">{WEEKDAYS_SHORT[day]}</span>
            {row.map((value, hour) => {
              const share = max ? value / max : 0;
              const label = `${WEEKDAYS[day]} ${hourLabel(hour)}: ${hours(value)}`;
              return (
                <Tooltip key={hour}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={label}
                        data-value={value}
                        className="aspect-square min-h-2.5 rounded-[3px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring"
                        style={{
                          background:
                            value > 0
                              ? `color-mix(in oklch, var(--chart-1) ${Math.round(15 + share * 85)}%, transparent)`
                              : 'var(--muted)',
                        }}
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
          <span key={h} className="text-center" aria-hidden>
            {h % 6 === 0 ? h : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <span
            key={s}
            className="size-2.5 rounded-[3px]"
            style={{ background: s ? `color-mix(in oklch, var(--chart-1) ${Math.round(15 + s * 85)}%, transparent)` : 'var(--muted)' }}
          />
        ))}
        More
      </div>
    </ChartPanel>
  );
}
